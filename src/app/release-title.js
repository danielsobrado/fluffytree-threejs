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
  const label = requireText(release?.label, 'label');
  return `Procedural Fluffy Trees ${formatReleaseVersion(release)} — ${label}`;
}

export function formatOverlayTitle(release) {
  const label = requireText(release?.label, 'label');
  return `Procedural fluffy trees — ${label} · ${formatReleaseVersion(release)}`;
}

export function applyDocumentTitle(release) {
  const releaseVersion = formatReleaseVersion(release);
  document.title = formatDocumentTitle(release);
  document.documentElement.dataset.releaseVersion = releaseVersion;
}
