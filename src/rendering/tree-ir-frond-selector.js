import { hashCanonicalValue } from '../core/canonical-value-hash.js';

function validateDensity(density) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('Tree IR frond density must be within [0, 1].');
  }
}

function azimuth(site) {
  const value = Number(site.metadata?.frond?.azimuth);
  if (!Number.isFinite(value)) {
    throw new Error(`Frond site '${site.id}' has no finite azimuth.`);
  }
  return value;
}

export function selectTreeIrFrondSites(treeIr, sites, role, density) {
  validateDensity(density);
  if (!Array.isArray(sites)) {
    throw new TypeError('Tree IR frond selection requires a site array.');
  }
  if (density === 0 || sites.length === 0) return Object.freeze([]);
  if (density === 1) return Object.freeze([...sites]);

  const ordered = [...sites].sort(
    (left, right) => azimuth(left) - azimuth(right) || left.id.localeCompare(right.id),
  );
  const targetCount = Math.max(1, Math.round(ordered.length * density));
  if (targetCount >= ordered.length) return Object.freeze(ordered);

  const phaseHash = hashCanonicalValue([treeIr.seed, role, 'frond-selection-phase']);
  const offset = Number.parseInt(phaseHash.slice(0, 8), 16) % ordered.length;
  const selected = [];
  const selectedIndices = new Set();

  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex =
      (offset + Math.floor((index * ordered.length) / targetCount)) % ordered.length;
    if (selectedIndices.has(sourceIndex)) continue;
    selectedIndices.add(sourceIndex);
    selected.push(ordered[sourceIndex]);
  }

  return Object.freeze(selected);
}
