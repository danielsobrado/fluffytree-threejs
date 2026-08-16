import { hashCanonicalValue } from '../core/canonical-value-hash.js';

function validateDensity(density) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('Tree IR foliage density must be within [0, 1].');
  }
}

function siteRank(treeIr, site, role) {
  const hash = hashCanonicalValue([treeIr.seed, role, site.id]);
  return Number.parseInt(hash.slice(0, 8), 16) >>> 0;
}

export function selectTreeIrFoliageSites(treeIr, sites, role, density) {
  validateDensity(density);
  if (!Array.isArray(sites)) {
    throw new TypeError('Tree IR foliage selection requires a site array.');
  }
  if (density === 0 || sites.length === 0) return Object.freeze([]);
  if (density === 1) return Object.freeze([...sites]);

  const targetCount = Math.max(1, Math.round(sites.length * density));
  const ranked = sites
    .map((site) => ({ site, rank: siteRank(treeIr, site, role) }))
    .sort(
      (left, right) =>
        left.rank - right.rank || left.site.id.localeCompare(right.site.id),
    );
  return Object.freeze(ranked.slice(0, targetCount).map((entry) => entry.site));
}
