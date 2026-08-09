import { existsSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SOURCE_DIRECTORIES = Object.freeze(['src', 'tests', 'tools']);
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
  if (!existsSync(GITHUB_WORKFLOW_DIRECTORY)) return;

  const entries = readdirSync(GITHUB_WORKFLOW_DIRECTORY, {
    withFileTypes: true,
  }).filter((entry) => entry.name !== GITHUB_WORKFLOW_PLACEHOLDER);
  if (entries.length === 0) return;

  throw new Error(
    `GitHub Actions are not used by this project. Remove files from '${GITHUB_WORKFLOW_DIRECTORY}' and deploy manually with npm run deploy:pages.`,
  );
}

assertNoGitHubActions();
const files = SOURCE_DIRECTORIES.flatMap(collectJavaScriptFiles).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax checked ${files.length} JavaScript files.`);
