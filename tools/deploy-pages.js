import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const CONFIG_PATH = path.join(REPOSITORY_ROOT, 'pages.config.yml');
const LOG_PREFIX = '[pages]';

function log(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

function runGit(args, { capture = false, allowFailure = false } = {}) {
  try {
    const output = execFileSync('git', args, {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    return typeof output === 'string' ? output.trim() : '';
  } catch (error) {
    if (allowFailure) {
      return '';
    }

    throw error;
  }
}

function requireString(config, key) {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing non-empty configuration value: ${key}`);
  }

  return value.trim();
}

function loadConfig() {
  const document = yaml.load(readFileSync(CONFIG_PATH, 'utf8'));
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('pages.config.yml must contain a YAML object.');
  }

  const requiredFiles = document.requiredFiles;
  if (
    !Array.isArray(requiredFiles) ||
    requiredFiles.length === 0 ||
    requiredFiles.some((file) => typeof file !== 'string' || file.trim() === '')
  ) {
    throw new Error('requiredFiles must contain at least one repository-relative path.');
  }

  return Object.freeze({
    remote: requireString(document, 'remote'),
    sourceBranch: requireString(document, 'sourceBranch'),
    publishBranch: requireString(document, 'publishBranch'),
    requiredFiles: requiredFiles.map((file) => file.trim()),
  });
}

function assertBranchName(branchName) {
  runGit(['check-ref-format', '--branch', branchName], { capture: true });
}

function assertRequiredFiles(commitSha, requiredFiles) {
  for (const file of requiredFiles) {
    runGit(['cat-file', '-e', `${commitSha}:${file}`], { capture: true });
  }
}

function deploy() {
  const config = loadConfig();
  assertBranchName(config.sourceBranch);
  assertBranchName(config.publishBranch);

  const insideRepository = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true });
  if (insideRepository !== 'true') {
    throw new Error('The deployment script must run inside a Git repository.');
  }

  log(`Fetching ${config.remote}/${config.sourceBranch}.`);
  runGit(['fetch', config.remote, config.sourceBranch]);

  runGit(['fetch', config.remote, config.publishBranch], {
    capture: true,
    allowFailure: true,
  });

  const sourceRef = `refs/remotes/${config.remote}/${config.sourceBranch}`;
  const publishRef = `refs/remotes/${config.remote}/${config.publishBranch}`;
  const sourceSha = runGit(['rev-parse', sourceRef], { capture: true });
  const publishSha = runGit(['rev-parse', '--verify', publishRef], {
    capture: true,
    allowFailure: true,
  });

  assertRequiredFiles(sourceSha, config.requiredFiles);

  if (sourceSha === publishSha) {
    log(`${config.publishBranch} already matches ${config.sourceBranch} at ${sourceSha}.`);
    return;
  }

  const destination = `refs/heads/${config.publishBranch}`;
  const refspec = `${sourceSha}:${destination}`;
  const args = ['push'];

  if (publishSha) {
    args.push(`--force-with-lease=${destination}:${publishSha}`);
  }

  args.push(config.remote, refspec);

  log(`Publishing ${sourceSha} to ${config.remote}/${config.publishBranch}.`);
  runGit(args);
  log('GitHub Pages branch updated successfully.');
}

try {
  deploy();
} catch (error) {
  console.error(
    `${LOG_PREFIX} Deployment failed:`,
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
