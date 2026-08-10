import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createJavaScriptCodeMask,
  isJavaScriptCodeOffset,
} from './javascript-code-mask.js';
import { parseModuleDependencies } from './module-dependency-parser.js';

const JAVASCRIPT_EXTENSION = '.js';
const STATIC_RELATIVE_MODULE_PATTERN =
  /(\b(?:from|import)\s*['"])(\.{1,2}\/[^'"\s]+\.js(?:[?#][^'"]*)?)(['"])/g;
const DYNAMIC_RELATIVE_MODULE_PATTERN =
  /\bimport\s*\(\s*(['"])(\.{1,2}\/[^'"\s]+\.js(?:[?#][^'"]*)?)\1\s*\)/g;
const DYNAMIC_RELATIVE_TEMPLATE_PATTERN =
  /\bimport\s*\(\s*`(\.{1,2}\/)/g;
const HTML_ASSET_PATTERN =
  /(<(?:script|link)\b[^>]*\b(?:src|href)=["']\.\/(?:src\/[^"'?]+\.js|styles\/[^"'?]+\.css))(?:\?[^"']*)?(["'][^>]*>)/gi;

function requireVersion(value) {
  const version = String(value ?? '').trim();
  if (version === '') throw new Error('Module cache version cannot be empty.');
  return version;
}

function versionModuleSpecifier(specifier, version) {
  const hashIndex = specifier.indexOf('#');
  const hash = hashIndex === -1 ? '' : specifier.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? specifier : specifier.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1);
  const parameters = new URLSearchParams(query);
  parameters.set('v', version);
  return `${pathname}?${parameters}${hash}`;
}

function relativeDependencyCounts(specifiers) {
  const counts = new Map();
  for (const specifier of specifiers ?? []) {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) continue;
    counts.set(specifier, (counts.get(specifier) ?? 0) + 1);
  }
  return counts;
}

function rejectDynamicMatches(source, mask, pattern, describe) {
  pattern.lastIndex = 0;

  for (const match of source.matchAll(pattern)) {
    if (!isJavaScriptCodeOffset(mask, match.index)) continue;
    throw new Error(describe(match));
  }
}

export function assertNoRelativeDynamicImports(source, file = 'browser source') {
  const mask = createJavaScriptCodeMask(source);
  rejectDynamicMatches(
    source,
    mask,
    DYNAMIC_RELATIVE_MODULE_PATTERN,
    (match) =>
      `Relative dynamic import '${match[2]}' in '${file}' cannot be cache-versioned safely. Use a static import.`,
  );
  rejectDynamicMatches(
    source,
    mask,
    DYNAMIC_RELATIVE_TEMPLATE_PATTERN,
    () =>
      `Relative dynamic template import in '${file}' cannot be cache-versioned safely. Use a static import.`,
  );
}

export function versionJavaScriptSource(
  source,
  version,
  dependencySpecifiers = null,
  file = 'JavaScript source',
) {
  const cacheVersion = requireVersion(version);
  const mask = createJavaScriptCodeMask(source);
  assertNoRelativeDynamicImports(source, file);
  const remaining =
    dependencySpecifiers === null
      ? null
      : relativeDependencyCounts(dependencySpecifiers);

  STATIC_RELATIVE_MODULE_PATTERN.lastIndex = 0;
  const next = source.replace(
    STATIC_RELATIVE_MODULE_PATTERN,
    (match, prefix, specifier, suffix, offset) => {
      if (!isJavaScriptCodeOffset(mask, offset)) return match;
      if (remaining) {
        const count = remaining.get(specifier) ?? 0;
        if (count === 0) return match;
        remaining.set(specifier, count - 1);
      }
      return `${prefix}${versionModuleSpecifier(specifier, cacheVersion)}${suffix}`;
    },
  );

  if (remaining) {
    const unresolved = [...remaining.entries()].filter(([, count]) => count > 0);
    if (unresolved.length > 0) {
      throw new Error(
        `Unable to cache-version parsed module imports in '${file}': ${unresolved
          .map(([specifier, count]) => `${specifier} (${count})`)
          .join(', ')}.`,
      );
    }
  }

  return next;
}

function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length));
}

export function versionHtmlAssets(source, version) {
  const cacheVersion = encodeURIComponent(requireVersion(version));
  const visibleSource = stripHtmlComments(source);
  HTML_ASSET_PATTERN.lastIndex = 0;

  return source.replace(
    HTML_ASSET_PATTERN,
    (match, prefix, suffix, offset) =>
      visibleSource.slice(offset, offset + match.length).trim() === ''
        ? match
        : `${prefix}?v=${cacheVersion}${suffix}`,
  );
}

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(entryPath));
    } else if (path.extname(entry.name) === JAVASCRIPT_EXTENSION) {
      files.push(entryPath);
    }
  }

  return files;
}

export function stampModuleGraph(sourceDirectory, version) {
  const files = collectJavaScriptFiles(sourceDirectory);
  const repositoryRoot = path.resolve(sourceDirectory, '..');
  const dependencies = parseModuleDependencies(files, repositoryRoot);
  let changedFiles = 0;

  for (const file of files) {
    const current = readFileSync(file, 'utf8');
    const next = versionJavaScriptSource(
      current,
      version,
      dependencies[file] ?? [],
      file,
    );
    if (next === current) continue;
    writeFileSync(file, next);
    changedFiles += 1;
  }

  return changedFiles;
}
