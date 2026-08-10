import { existsSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertLocalImportTargets } from './source-checks.js';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORIES = Object.freeze(['src', 'tests', 'tools']);
const IMPORT_DIRECTORIES = Object.freeze(['src', 'tools']);
const JAVASCRIPT_EXTENSION = '.js';
const GITHUB_WORKFLOW_DIRECTORY = '.github/workflows';
const GITHUB_WORKFLOW_PLACEHOLDER = '.gitkeep';

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

assertNoGitHubActions();
const files = SOURCE_DIRECTORIES.flatMap((directory) =>
  collectJavaScriptFiles(join(REPOSITORY_ROOT, directory)),
).sort();
const importFiles = IMPORT_DIRECTORIES.flatMap((directory) =>
  collectJavaScriptFiles(join(REPOSITORY_ROOT, directory)),
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

assertLocalImportTargets(importFiles, REPOSITORY_ROOT);
console.log(
  `Syntax checked ${files.length} JavaScript files and verified ${importFiles.length} source module imports.`,
);
