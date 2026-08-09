import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  assertVerifiedDeploySource,
  parseDeployOptions,
} from './deploy-source-guard.js';
import { stampModuleGraph, versionHtmlAssets } from './module-versioning.js';
import { releaseCacheKeyFromYaml } from './release-cache-key.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const CONFIG_PATH = path.join(REPOSITORY_ROOT, 'pages.config.yml');
const LOG_PREFIX = '[pages]';
const SOURCE_MARKER = '.pages-source-sha';
const RELEASE_PATH = 'config/release.yaml';

function log(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

function runGit(
  args,
  { capture = false, allowFailure = false, cwd = REPOSITORY_ROOT } = {},
) {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    return typeof output === 'string' ? output.trim() : '';
  } catch (error) {
    if (allowFailure) return '';
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

function releaseCacheKey(workspace) {
  return releaseCacheKeyFromYaml(
    readFileSync(path.join(workspace, RELEASE_PATH), 'utf8'),
  );
}

function releaseCacheKeyAtRef(ref) {
  const source = runGit(['show', `${ref}:${RELEASE_PATH}`], {
    capture: true,
    allowFailure: true,
  });
  return source ? releaseCacheKeyFromYaml(source) : null;
}

function stampPublishedFiles(workspace, sourceSha) {
  const cacheKey = releaseCacheKey(workspace);
  const changedModules = stampModuleGraph(
    path.join(workspace, 'src'),
    cacheKey,
  );
  const indexPath = path.join(workspace, 'index.html');
  const currentIndex = readFileSync(indexPath, 'utf8');
  writeFileSync(indexPath, versionHtmlAssets(currentIndex, cacheKey));
  writeFileSync(path.join(workspace, SOURCE_MARKER), `${sourceSha}\n`);
  log(`Versioned ${changedModules} JavaScript modules with ${cacheKey}.`);
}

function currentPublishedSource(publishRef) {
  return runGit(['show', `${publishRef}:${SOURCE_MARKER}`], {
    capture: true,
    allowFailure: true,
  });
}

function assertFreshReleaseCacheKey(sourceSha, publishRef, publishSha) {
  if (!publishSha) return;

  const sourceKey = releaseCacheKeyAtRef(sourceSha);
  const publishedKey = releaseCacheKeyAtRef(publishRef);
  if (publishedKey && sourceKey === publishedKey) {
    throw new Error(
      `Release cache key '${sourceKey}' is already published. Increment config/release.yaml before deploying a new source commit.`,
    );
  }
}

function assertVerifiedSource(sourceSha) {
  const headSha = runGit(['rev-parse', 'HEAD'], { capture: true });
  const workingTreeStatus = runGit(
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { capture: true },
  );
  assertVerifiedDeploySource({ sourceSha, headSha, workingTreeStatus });
}

function createPublishedCommit(sourceSha) {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-pages-'));
  let worktreeAdded = false;

  try {
    runGit(['worktree', 'add', '--detach', workspace, sourceSha]);
    worktreeAdded = true;
    stampPublishedFiles(workspace, sourceSha);
    runGit(['add', '--all'], { cwd: workspace });
    runGit(
      [
        '-c',
        'user.name=FluffyTree Pages',
        '-c',
        'user.email=pages@users.noreply.github.com',
        'commit',
        '-m',
        `deploy: publish ${sourceSha.slice(0, 12)}`,
      ],
      { cwd: workspace },
    );
    return runGit(['rev-parse', 'HEAD'], { cwd: workspace, capture: true });
  } finally {
    if (worktreeAdded) {
      runGit(['worktree', 'remove', '--force', workspace], {
        allowFailure: true,
      });
    }
    rmSync(workspace, { recursive: true, force: true });
  }
}

function deploy(options) {
  const config = loadConfig();
  assertBranchName(config.sourceBranch);
  assertBranchName(config.publishBranch);

  const insideRepository = runGit(['rev-parse', '--is-inside-work-tree'], {
    capture: true,
  });
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

  if (options.requireVerifiedSource) assertVerifiedSource(sourceSha);
  assertRequiredFiles(sourceSha, config.requiredFiles);

  if (currentPublishedSource(publishRef) === sourceSha) {
    log(`${config.publishBranch} already publishes ${sourceSha}.`);
    return;
  }

  assertFreshReleaseCacheKey(sourceSha, publishRef, publishSha);
  const generatedSha = createPublishedCommit(sourceSha);
  const destination = `refs/heads/${config.publishBranch}`;
  const args = ['push'];

  if (publishSha) {
    args.push(`--force-with-lease=${destination}:${publishSha}`);
  }

  args.push(config.remote, `${generatedSha}:${destination}`);
  log(`Publishing generated commit ${generatedSha} from ${sourceSha}.`);
  runGit(args);
  log('GitHub Pages branch updated successfully.');
}

try {
  deploy(parseDeployOptions(process.argv.slice(2)));
} catch (error) {
  console.error(
    `${LOG_PREFIX} Deployment failed:`,
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
