import { hashCanonicalValue } from '../core/canonical-value-hash.js?v=2.0.0-20260814.2';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UINT32_RANGE = 0x100000000;

function validateDensity(density) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('Tree IR frond density must be within [0, 1].');
  }
}

function normalizeAngle(value) {
  return ((value % TAU) + TAU) % TAU;
}

function azimuth(site) {
  const value = Number(site.metadata?.frond?.azimuth);
  if (!Number.isFinite(value)) {
    throw new Error(`Frond site '${site.id}' has no finite azimuth.`);
  }
  return normalizeAngle(value);
}

function circularDistance(left, right) {
  const distance = Math.abs(left - right);
  return Math.min(distance, TAU - distance);
}

function selectionPhase(treeIr) {
  const hash = hashCanonicalValue([treeIr.seed, 'frond-selection-phase']);
  return ((Number.parseInt(hash.slice(0, 8), 16) >>> 0) / UINT32_RANGE) * TAU;
}

export function selectTreeIrFrondSites(treeIr, sites, density) {
  validateDensity(density);
  if (!Array.isArray(sites)) {
    throw new TypeError('Tree IR frond selection requires a site array.');
  }
  if (density === 0 || sites.length === 0) return Object.freeze([]);
  if (density === 1) return Object.freeze([...sites]);

  const candidates = sites
    .map((site) => ({ site, angle: azimuth(site) }))
    .sort(
      (left, right) =>
        left.angle - right.angle || left.site.id.localeCompare(right.site.id),
    );
  const targetCount = Math.max(1, Math.round(candidates.length * density));
  if (targetCount >= candidates.length) {
    return Object.freeze(candidates.map((candidate) => candidate.site));
  }

  const available = new Set(candidates.map((_candidate, index) => index));
  const selected = [];
  const phase = selectionPhase(treeIr);

  for (let step = 0; step < targetCount; step += 1) {
    const targetAngle = normalizeAngle(phase + step * GOLDEN_ANGLE);
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const index of available) {
      const distance = circularDistance(candidates[index].angle, targetAngle);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    available.delete(bestIndex);
    selected.push(candidates[bestIndex].site);
  }

  return Object.freeze(selected);
}
