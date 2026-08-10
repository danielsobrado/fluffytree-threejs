import { readFileSync } from 'node:fs';
import { SourceTextModule } from 'node:vm';
import { assertLocalImportSpecifiers } from './source-checks.js';

function readInput() {
  let input;

  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch (error) {
    throw new Error('Module import checker received invalid JSON input.', {
      cause: error,
    });
  }

  if (
    !input ||
    typeof input.repositoryRoot !== 'string' ||
    !Array.isArray(input.files)
  ) {
    throw new Error('Module import checker input is missing repositoryRoot or files.');
  }

  return input;
}

const { repositoryRoot, files } = readInput();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const module = new SourceTextModule(source, { identifier: file });
  assertLocalImportSpecifiers(file, module.dependencySpecifiers, repositoryRoot);
}
