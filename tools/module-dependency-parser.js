import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_IMPORT_CHECKER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'check-module-imports.js',
);

function runChecker(files, repositoryRoot, returnDependencies) {
  const result = spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-vm-modules', MODULE_IMPORT_CHECKER],
    {
      encoding: 'utf8',
      input: JSON.stringify({ repositoryRoot, files, returnDependencies }),
    },
  );

  if (result.error) {
    throw new Error(`Failed to spawn module dependency parser: ${result.error.message}`);
  }
  if (result.status === 0) return result.stdout;

  const diagnostics = [result.stderr, result.stdout].filter(Boolean).join('\n');
  throw new Error(`Failed to parse module dependencies. ${diagnostics}`.trim());
}

export function assertModuleDependencies(files, repositoryRoot) {
  runChecker(files, repositoryRoot, false);
}

export function parseModuleDependencies(files, repositoryRoot) {
  const output = runChecker(files, repositoryRoot, true);

  try {
    return JSON.parse(output || '{}');
  } catch (error) {
    throw new Error('Module dependency parser returned invalid JSON.', {
      cause: error,
    });
  }
}
