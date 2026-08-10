import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoRelativeDynamicImports } from './module-versioning.js';
import { assertLocalHtmlAssets } from './source-checks.js';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORIES = Object.freeze(['src', 'tests', 'tools']);
const IMPORT_DIRECTORIES = Object.freeze(['src', 'tools']);
const BROWSER_SOURCE_DIRECTORY = 'src';
const JAVASCRIPT_EXTENSION = '.js';
const GITHUB_WORKFLOW_DIRECTORY = '.github/workflows';
const GITHUB_WORKFLOW_PLACEHOLDER = '.gitkeep';
const ENTRY_HTML = 'index.html';
const IMPORT_CHECKER = join(REPOSITORY_ROOT, 'tools/check-module-imports.js');

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(path));
    } else if (extname(entry.name) === JAVASCRIPT_EXTENSION) {
      files.push(path);
    }
  }

  return files;
}

function assertNoGitHubActions() {
  const workflowDirectory = join(REPOSITORY_ROOT, GITHUB_WORKFLOW_DIRECTORY);
  if (!existsSync(workflowDirectory)) return;

  const entries = readdirSync(workflowDirectory, {
    withFileTypes: true,
  }).filter((entry) => entry.name !== GITHUB_WORKFLOW_PLACEHOLDER);
  if (entries.length === 0) return;

  throw new Error(
    `GitHub Actions are not used by this project. Remove files from '${GITHUB_WORKFLOW_DIRECTORY}' and deploy manually with npm run deploy:pages.`,
  );
}

function assertParsedModuleImports(files) {
  const result = spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-vm-modules', IMPORT_CHECKER],
    {
      encoding: 'utf8',
      input: JSON.stringify({ repositoryRoot: REPOSITORY_ROOT, files }),
    },
  );

  if (result.status === 0) return;

  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stderr.write(result.stdout);
  process.exit(result.status ?? 1);
}

assertNoGitHubActions();
const files = SOURCE_DIRECTORIES.flatMap((directory) =>
  collectJavaScriptFiles(join(REPOSITORY_ROOT, directory)),
).sort();
const importFiles = IMPORT_DIRECTORIES.flatMap((directory) =>
  collectJavaScriptFiles(join(REPOSITORY_ROOT, directory)),
).sort();
const browserFiles = collectJavaScriptFiles(
  join(REPOSITORY_ROOT, BROWSER_SOURCE_DIRECTORY),
).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

assertParsedModuleImports(importFiles);
for (const file of browserFiles) {
  assertNoRelativeDynamicImports(readFileSync(file, 'utf8'), file);
}
assertLocalHtmlAssets(join(REPOSITORY_ROOT, ENTRY_HTML), REPOSITORY_ROOT);
console.log(
  `Syntax checked ${files.length} JavaScript files, parsed ${importFiles.length} source module imports, and checked local HTML assets.`,
);
