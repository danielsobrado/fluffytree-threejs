import {
  formatDocumentTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';
import { versionHtmlAssets } from './module-versioning.js';

function requirePackageVersion(packageConfig) {
  const version = packageConfig?.version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error("package.json must contain a non-empty 'version'.");
  }
  return version.trim();
}

export function assertReleaseSourceConsistency({
  release,
  packageConfig,
  indexHtml,
}) {
  const packageVersion = requirePackageVersion(packageConfig);
  const releaseVersion = formatReleaseVersion(release);
  const expectedTitle = formatDocumentTitle(release);
  const version = String(release.version).trim();
  const build = String(release.build).trim();

  if (packageVersion !== version) {
    throw new Error(
      `package.json version '${packageVersion}' does not match release version '${version}'.`,
    );
  }
  if (!indexHtml.includes(`<title>${expectedTitle}</title>`)) {
    throw new Error(
      `index.html title does not match release '${releaseVersion}'.`,
    );
  }

  const cacheKey = `${version}-${build}`;
  if (versionHtmlAssets(indexHtml, cacheKey) !== indexHtml) {
    throw new Error(
      `index.html local asset cache keys do not match release '${releaseVersion}'.`,
    );
  }
}
