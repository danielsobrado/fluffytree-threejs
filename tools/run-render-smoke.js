import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const port = Number(process.env.RENDER_SMOKE_PORT ?? 4173);
const outputDirectory = path.resolve(
  process.env.RENDER_SMOKE_OUTPUT ?? 'qa-results/render-smoke',
);
const rootDirectory = process.cwd();
const qaMode = process.env.RENDER_SMOKE_QA_MODE ?? 'render-smoke';
const query = new URLSearchParams({ qa: qaMode });
const additionalQuery = new URLSearchParams(
  process.env.RENDER_SMOKE_QUERY ?? '',
);
additionalQuery.forEach((value, key) => query.set(key, value));
const url = `http://127.0.0.1:${port}/?${query}`;
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
  const name = requestUrl.searchParams.get('name') ?? 'qa-report';
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    fs.writeFileSync(
      path.join(outputDirectory, `${name}.json`),
      Buffer.concat(chunks),
    );
    response.writeHead(204).end();
  });
}

function serve(request, response) {
  const requestUrl = new URL(request.url, url);
  const pathname = decodeURIComponent(requestUrl.pathname);
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
    // The solidity probe gates on read-back pixels rather than on the captured
    // image, so it must not wait for the virtual time budget to expire.
    const requiresScreenshot = qaMode !== 'solidity';
    const poll = setInterval(() => {
      if (activeCapture?.status === 'error') {
        finish(new Error(`${name} render failed: ${activeCapture.error}`));
      } else if (
        (activeCapture?.status === 'ready' || qaMode === 'stress') &&
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
      if (code !== 0) finish(new Error(`${name} browser exited ${code}: ${diagnostics}`));
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
