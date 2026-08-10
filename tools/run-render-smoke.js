import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { validateQaReportName } from '../src/qa/qa-report-name.js';
import {
  parseRenderSmokeMode,
  parseRenderSmokePort,
} from './render-smoke-options.js';

const MAX_QA_REPORT_BYTES = 16 * 1024 * 1024;
const port = parseRenderSmokePort(process.env.RENDER_SMOKE_PORT);
const outputDirectory = path.resolve(
  process.env.RENDER_SMOKE_OUTPUT ?? 'qa-results/render-smoke',
);
const rootDirectory = process.cwd();
const qaMode = parseRenderSmokeMode(process.env.RENDER_SMOKE_QA_MODE);
const query = new URLSearchParams({ qa: qaMode });
const additionalQuery = new URLSearchParams(
  process.env.RENDER_SMOKE_QUERY ?? '',
);
additionalQuery.forEach((value, key) => query.set(key, value));
const url = `http://127.0.0.1:${port}/?${query}`;
const nonScreenshotQaModes = new Set(['solidity', 'manifold']);
const mimeTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.yaml', 'text/yaml'],
  ['.yml', 'text/yaml'],
]);
let activeCapture = null;

function findBrowser() {
  const configured = process.env.CHROME_BIN;
  const candidates = configured
    ? [configured]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function collectReport(request, response, requestUrl) {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' }).end('Method Not Allowed');
    return;
  }

  let name;
  try {
    name = validateQaReportName(
      requestUrl.searchParams.get('name') ?? 'qa-report',
    );
  } catch (error) {
    response.writeHead(400).end(error.message);
    return;
  }

  const chunks = [];
  let size = 0;
  let tooLarge = false;
  request.on('data', (chunk) => {
    if (tooLarge) return;
    size += chunk.length;
    if (size > MAX_QA_REPORT_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => {
    if (tooLarge) {
      response.writeHead(413).end('QA report is too large.');
      return;
    }

    fs.writeFileSync(
      path.join(outputDirectory, `${name}.json`),
      Buffer.concat(chunks),
    );
    response.writeHead(204).end();
  });
}

function serve(request, response) {
  let requestUrl;
  let pathname;

  try {
    requestUrl = new URL(request.url ?? '/', url);
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end('Bad Request');
    return;
  }

  if (pathname === '/__qa-report') {
    collectReport(request, response, requestUrl);
    return;
  }
  if (pathname === '/__render-smoke-status') {
    if (activeCapture) {
      activeCapture.status = requestUrl.searchParams.get('status');
      activeCapture.error = requestUrl.searchParams.get('error') ?? '';
    }
    response.writeHead(204).end();
    return;
  }
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(rootDirectory, relativePath);
  const relative = path.relative(rootDirectory, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.message);
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  });
}

function runBrowser(browser, name, size) {
  return new Promise((resolve, reject) => {
    const screenshot = path.join(outputDirectory, `${name}.png`);
    const profile = path.join(outputDirectory, `${name}-profile`);
    fs.rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 125,
    });
    fs.rmSync(screenshot, { force: true });
    activeCapture = { status: 'pending', error: '' };
    const child = spawn(
      browser,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--no-first-run',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--force-device-scale-factor=1',
        `--user-data-dir=${profile}`,
        `--window-size=${size}`,
        `--virtual-time-budget=${qaMode === 'render-smoke' ? 20000 : 120000}`,
        `--screenshot=${screenshot}`,
        '--dump-dom',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let html = '';
    let diagnostics = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      html += chunk;
    });
    child.stderr.on('data', (chunk) => {
      diagnostics += chunk;
    });
    let settled = false;
    let exitCode = null;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      if (exitCode === null) child.kill();
      fs.writeFileSync(path.join(outputDirectory, `${name}.html`), html);
      activeCapture = null;
      if (error) reject(error);
      else resolve();
    };
    const hasScreenshot = () =>
      fs.existsSync(screenshot) && fs.statSync(screenshot).size > 0;
    const requiresScreenshot = !nonScreenshotQaModes.has(qaMode);
    const poll = setInterval(() => {
      if (activeCapture?.status === 'error') {
        finish(new Error(`${name} render failed: ${activeCapture.error}`));
      } else if (
        activeCapture?.status === 'ready' &&
        (!requiresScreenshot || hasScreenshot())
      ) {
        finish();
      }
    }, 250);
    const timer = setTimeout(() => {
      if (
        activeCapture?.status === 'ready' &&
        (!requiresScreenshot || hasScreenshot())
      ) {
        finish();
        return;
      }
      finish(
        new Error(
          `${name} browser capture timed out (${activeCapture?.status}): ${diagnostics}`,
        ),
      );
    }, 300000);
    child.on('error', finish);
    child.on('close', (code) => {
      exitCode = code;
      if (code !== 0) {
        finish(new Error(`${name} browser exited ${code}: ${diagnostics}`));
        return;
      }
      if (activeCapture?.status === 'error') {
        finish(new Error(`${name} render failed: ${activeCapture.error}`));
        return;
      }
      if (activeCapture?.status !== 'ready') {
        finish(
          new Error(
            `${name} browser exited before QA reported ready (${activeCapture?.status ?? 'missing'}): ${diagnostics}`,
          ),
        );
        return;
      }
      if (requiresScreenshot && !hasScreenshot()) {
        finish(
          new Error(`${name} browser exited before writing its screenshot: ${diagnostics}`),
        );
        return;
      }
      finish();
    });
  });
}

fs.mkdirSync(outputDirectory, { recursive: true });
const browser = findBrowser();
if (!browser) throw new Error('No supported Chrome, Chromium, or Edge executable was found.');

const server = http.createServer(serve);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

try {
  if (qaMode === 'stress') {
    await runBrowser(browser, 'stress-720p', '1280,720');
    console.log(
      `Stress render passed: ${path.join(outputDirectory, 'stress-720p.png')}`,
    );
  } else if (qaMode === 'solidity') {
    await runBrowser(browser, 'solidity', '1280,800');
    console.log('Canopy solidity gate passed.');
  } else if (qaMode === 'manifold') {
    await runBrowser(browser, 'stem-manifold', '800,600');
    console.log('Stem manifold gate passed.');
  } else {
    await runBrowser(browser, 'desktop', '1440,900');
    await runBrowser(browser, 'mobile', '720,1440');
    console.log(
      `Render smoke tests passed: ${path.join(outputDirectory, 'desktop.png')} and mobile.png`,
    );
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
