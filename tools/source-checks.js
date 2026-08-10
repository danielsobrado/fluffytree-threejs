import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

const JAVASCRIPT_EXTENSION = '.js';
const RELATIVE_IMPORT_PATTERN =
  /\b(?:from|import)\s*(?:\(\s*)?['"](\.{1,2}\/[^'"]+)['"](?:\s*\))?/g;

function modulePath(specifier) {
  const queryIndex = specifier.search(/[?#]/);
  return queryIndex === -1 ? specifier : specifier.slice(0, queryIndex);
}

function isInsideRepository(repositoryRoot, target) {
  const path = relative(repositoryRoot, target);
  return (
    path !== '..' &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
}

export function collectRelativeModuleSpecifiers(source) {
  const specifiers = [];
  RELATIVE_IMPORT_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(RELATIVE_IMPORT_PATTERN)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

export function assertLocalImportTargets(files, repositoryRoot) {
  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    for (const specifier of collectRelativeModuleSpecifiers(source)) {
      const localPath = modulePath(specifier);
      if (extname(localPath) !== JAVASCRIPT_EXTENSION) {
        throw new Error(
          `Local module import '${specifier}' in '${file}' must include a .js extension.`,
        );
      }

      const target = resolve(dirname(file), localPath);
      if (!isInsideRepository(repositoryRoot, target)) {
        throw new Error(
          `Local module import '${specifier}' in '${file}' escapes the repository.`,
        );
      }
      if (!existsSync(target) || !statSync(target).isFile()) {
        throw new Error(
          `Local module import '${specifier}' in '${file}' does not resolve to a file.`,
        );
      }
    }
  }
}
