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
const LOCAL_HTML_ASSET_PATTERN =
  /<(?:script|link|img|source)\b[^>]*\b(?:src|href)=['"](\.\/[^'"?#]+)(?:[?#][^'"]*)?['"][^>]*>/gi;

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

function assertExistingRepositoryFile(target, repositoryRoot, description) {
  if (!isInsideRepository(repositoryRoot, target)) {
    throw new Error(`${description} escapes the repository.`);
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    throw new Error(`${description} does not resolve to a file.`);
  }
}

export function collectRelativeModuleSpecifiers(source) {
  const specifiers = [];
  RELATIVE_IMPORT_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(RELATIVE_IMPORT_PATTERN)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

export function collectLocalHtmlAssets(source) {
  const assets = [];
  LOCAL_HTML_ASSET_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(LOCAL_HTML_ASSET_PATTERN)) {
    assets.push(match[1]);
  }

  return assets;
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
      assertExistingRepositoryFile(
        target,
        repositoryRoot,
        `Local module import '${specifier}' in '${file}'`,
      );
    }
  }
}

export function assertLocalHtmlAssets(htmlFile, repositoryRoot) {
  const source = readFileSync(htmlFile, 'utf8');

  for (const asset of collectLocalHtmlAssets(source)) {
    const target = resolve(dirname(htmlFile), asset);
    assertExistingRepositoryFile(
      target,
      repositoryRoot,
      `Local HTML asset '${asset}' in '${htmlFile}'`,
    );
  }
}
