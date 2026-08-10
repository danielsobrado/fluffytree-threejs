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

  if (
    input.returnDependencies !== undefined &&
    typeof input.returnDependencies !== 'boolean'
  ) {
    throw new Error('Module import checker returnDependencies must be a boolean.');
  }

  return input;
}

const { repositoryRoot, files, returnDependencies = false } = readInput();
const dependencies = {};

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const module = new SourceTextModule(source, { identifier: file });
  const specifiers = module.dependencySpecifiers;
  assertLocalImportSpecifiers(file, specifiers, repositoryRoot);
  if (returnDependencies) dependencies[file] = specifiers;
}

if (returnDependencies) process.stdout.write(JSON.stringify(dependencies));
