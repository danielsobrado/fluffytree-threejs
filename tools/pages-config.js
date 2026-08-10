import { posix as posixPath } from 'node:path';

const REMOTE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requireString(config, key) {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing non-empty configuration value: ${key}`);
  }

  return value.trim();
}

function requireRemoteName(config) {
  const remote = requireString(config, 'remote');
  if (!REMOTE_NAME_PATTERN.test(remote)) {
    throw new Error(
      "Configuration value 'remote' must be a Git remote name containing only letters, numbers, '.', '_' or '-'.",
    );
  }
  return remote;
}

function requireRepositoryPath(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('requiredFiles must contain non-empty repository-relative paths.');
  }

  const file = value.trim();
  if (file.includes('\\') || posixPath.isAbsolute(file)) {
    throw new Error(`requiredFiles path '${file}' must be repository-relative.`);
  }

  const normalized = posixPath.normalize(file);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized !== file
  ) {
    throw new Error(`requiredFiles path '${file}' must be normalized and stay inside the repository.`);
  }

  return file;
}

export function parsePagesConfig(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('pages.config.yml must contain a YAML object.');
  }

  if (!Array.isArray(document.requiredFiles) || document.requiredFiles.length === 0) {
    throw new Error('requiredFiles must contain at least one repository-relative path.');
  }

  const sourceBranch = requireString(document, 'sourceBranch');
  const publishBranch = requireString(document, 'publishBranch');
  if (sourceBranch === publishBranch) {
    throw new Error('sourceBranch and publishBranch must be different branches.');
  }

  const requiredFiles = document.requiredFiles.map(requireRepositoryPath);
  if (new Set(requiredFiles).size !== requiredFiles.length) {
    throw new Error('requiredFiles must not contain duplicate paths.');
  }

  return Object.freeze({
    remote: requireRemoteName(document),
    sourceBranch,
    publishBranch,
    requiredFiles: Object.freeze(requiredFiles),
  });
}
