function requireText(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing release configuration '${path}'.`);
  }

  return value.trim();
}

export function formatReleaseVersion(release) {
  const version = requireText(release?.version, 'version');
  const build = requireText(release?.build, 'build');
  return `v${version}+${build}`;
}

export function formatDocumentTitle(release) {
  return `Procedural Fluffy Trees ${formatReleaseVersion(release)}`;
}

export function applyDocumentTitle(release) {
  document.title = formatDocumentTitle(release);
}
