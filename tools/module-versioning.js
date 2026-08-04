import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const JAVASCRIPT_EXTENSION = '.js';
const RELATIVE_MODULE_PATTERN =
  /(\b(?:from|import)\s*(?:\(\s*)?['"])(\.{1,2}\/[^'"?#]+\.js)(?:\?[^'"#]*)?(['"](?:\s*\))?)/g;
const HTML_ASSET_PATTERN =
  /((?:src|href)=["']\.\/(?:src\/[^"'?]+\.js|styles\/[^"'?]+\.css))(?:\?[^"']*)?(["'])/g;

function requireVersion(value) {
  const version = String(value ?? '').trim();
  if (version === '') throw new Error('Module cache version cannot be empty.');
  return encodeURIComponent(version);
}

export function versionJavaScriptSource(source, version) {
  const cacheVersion = requireVersion(version);
  return source.replace(
    RELATIVE_MODULE_PATTERN,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${specifier}?v=${cacheVersion}${suffix}`,
  );
}

export function versionHtmlAssets(source, version) {
  const cacheVersion = requireVersion(version);
  return source.replace(
    HTML_ASSET_PATTERN,
    (_match, prefix, suffix) => `${prefix}?v=${cacheVersion}${suffix}`,
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
  let changedFiles = 0;

  for (const file of collectJavaScriptFiles(sourceDirectory)) {
    const current = readFileSync(file, 'utf8');
    const next = versionJavaScriptSource(current, version);
    if (next === current) continue;
    writeFileSync(file, next);
    changedFiles += 1;
  }

  return changedFiles;
}
