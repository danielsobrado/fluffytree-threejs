import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js';
import {
  lobeSurfaceNormal,
  normalizedRotatedPointDistance,
  pointOnLobeSurface,
} from '../generation/lobe-geometry.js';
import { SpatialHashGrid } from '../generation/spatial-hash-grid.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';

const GRID_SEARCH_RINGS = 3;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function averageScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function createProbeDirection(index, count, phase) {
  const y = 1 - 2 * ((index + 0.5) / count);
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * FOLIAGE_SHELL_CONSTANTS.goldenAngle + phase;

  return {
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
  };
}

function calculateExposure(point, lobes, ownerLobeId) {
  let clearance = Number.POSITIVE_INFINITY;

  for (const lobe of lobes) {
    if (lobe.id === ownerLobeId) continue;
    clearance = Math.min(
      clearance,
      normalizedRotatedPointDistance(point, lobe) - 1,
    );
  }

  if (clearance === Number.POSITIVE_INFINITY) clearance = 1;

  return clamp01(
    (clearance + FOLIAGE_SHELL_CONSTANTS.clearanceOffset) /
      FOLIAGE_SHELL_CONSTANTS.clearanceRange,
  );
}

function buildClusterGrid(clusters, cellSize) {
  const grid = new SpatialHashGrid(cellSize);
  for (const cluster of clusters) grid.insert(cluster.position, cluster);
  return grid;
}

function isCompatible(probe, cluster) {
  const dot =
    probe.normal.x * cluster.normal.x +
    probe.normal.y * cluster.normal.y +
    probe.normal.z * cluster.normal.z;
  return dot >= FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot;
}

function squaredDistance(probe, cluster) {
  const x = probe.position.x - cluster.position.x;
  const y = probe.position.y - cluster.position.y;
  const z = probe.position.z - cluster.position.z;
  return x * x + y * y + z * z;
}

/**
 * Nearest cluster that faces the same way as the probe.
 *
 * The grid sweep widens by a cell ring at a time and stops as soon as the best
 * distance found lies inside the region already scanned, so the answer is exact.
 * A probe with nothing compatible nearby would make that sweep grow cubically,
 * so after a few rings it falls back to a direct pass over the cluster list,
 * which is linear and far cheaper than sweeping empty cells.
 */
function nearestCompatibleDistance(probe, grid, clusters) {
  let nearestSquared = Number.POSITIVE_INFINITY;

  for (let rings = 1; rings <= GRID_SEARCH_RINGS; rings += 1) {
    grid.forEachNear(probe.position, rings, (cluster) => {
      if (!isCompatible(probe, cluster)) return false;
      nearestSquared = Math.min(nearestSquared, squaredDistance(probe, cluster));
      return false;
    });

    const scanned = grid.cellSize * rings;
    if (nearestSquared <= scanned * scanned) return Math.sqrt(nearestSquared);
  }

  for (const cluster of clusters) {
    if (!isCompatible(probe, cluster)) continue;
    nearestSquared = Math.min(nearestSquared, squaredDistance(probe, cluster));
  }

  return nearestSquared === Number.POSITIVE_INFINITY
    ? Number.POSITIVE_INFINITY
    : Math.sqrt(nearestSquared);
}

/**
 * Measures how far the exposed crown surface ever gets from a leaf cluster that
 * could actually cover it.
 *
 * Probes are an independent Fibonacci set, denser than the candidates the
 * generator selected from and offset by a different phase, so the measurement is
 * not simply replaying the selection's own sample points. A cluster only counts
 * when it faces the same way as the probe, which stops a card on the far side of
 * a thin crown from being credited with covering the near side.
 *
 * The result is a sampled bound: no probe is farther than the reported gap, and
 * because distance to the nearest cluster is 1-Lipschitz, a surface point between
 * probes can exceed it by at most the probe spacing. It is not a continuous proof
 * over every point of the crown.
 */
export function analyzeShellCoverage(tree, preset, options = {}) {
  const densityMultiplier = options.probeDensityMultiplier ?? 2;
  // Selection covers everything above the preset's exposure threshold. The gate
  // measures a slightly stricter band so a probe sitting exactly on the boundary,
  // deep in a crevice where no candidate qualified, is not scored as bald crown.
  const exposureMargin = options.probeExposureMargin ?? 0;
  const settings = preset.foliage.shell;
  const lobes = tree.lobes;
  const probeCount = Math.round(settings.candidatesPerLobe * densityMultiplier);
  const clusterRadii = tree.shell.map((instance) => instance.coverageRadius ?? 0);
  const cellSize = Math.max(1e-3, Math.max(0, ...clusterRadii) * 2);
  const grid = buildClusterGrid(tree.shell, cellSize);
  const clustersByLobe = new Map();

  for (const instance of tree.shell) {
    clustersByLobe.set(instance.lobeId, (clustersByLobe.get(instance.lobeId) ?? 0) + 1);
  }

  let maximumGap = 0;
  let totalGap = 0;
  let measuredProbes = 0;
  let bareExposedLobes = 0;
  let worst = null;
  const gaps = [];

  for (const lobe of lobes) {
    const allowedRadius = averageScale(lobe) * settings.coverageRadiusRatio;
    // A phase unrelated to the generator's own per-lobe phase.
    const phase = ((lobe.id + 1) * FOLIAGE_SHELL_CONSTANTS.goldenAngle * 7.3) %
      FOLIAGE_SHELL_CONSTANTS.tau;
    let exposedProbes = 0;

    for (let index = 0; index < probeCount; index += 1) {
      const direction = createProbeDirection(index, probeCount, phase);
      const surfacePoint = pointOnLobeSurface(lobe, direction);
      const exposure = calculateExposure(surfacePoint, lobes, lobe.id);
      if (exposure < settings.exposureThreshold + exposureMargin) continue;

      exposedProbes += 1;
      const probe = {
        position: surfacePoint,
        normal: lobeSurfaceNormal(lobe, direction),
      };
      const gap = nearestCompatibleDistance(probe, grid, tree.shell);
      const bounded = Number.isFinite(gap) ? gap : Number.POSITIVE_INFINITY;

      measuredProbes += 1;
      gaps.push(bounded);
      if (Number.isFinite(bounded)) totalGap += bounded;

      if (bounded > maximumGap) {
        maximumGap = bounded;
        worst = {
          lobeId: lobe.id,
          gap: bounded,
          allowedRadius,
          position: surfacePoint,
        };
      }
    }

    if (exposedProbes > 0 && (clustersByLobe.get(lobe.id) ?? 0) === 0) {
      bareExposedLobes += 1;
    }
  }

  gaps.sort((left, right) => left - right);
  const percentile = (ratio) =>
    gaps.length === 0
      ? 0
      : gaps[Math.min(gaps.length - 1, Math.round((gaps.length - 1) * ratio))];
  const maximumAllowed = Math.max(
    ...lobes.map((lobe) => averageScale(lobe) * settings.coverageRadiusRatio),
  );
  // The physically meaningful comparison: a gap wider than a leaf card means the
  // cards cannot overlap there however well they are distributed.
  const cardWidths = tree.shell
    .map(
      (instance) =>
        instance.scale *
        instance.widthRatio *
        FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier,
    )
    .sort((left, right) => left - right);
  const medianCardWidth =
    cardWidths.length === 0
      ? 0
      : cardWidths[Math.floor(cardWidths.length / 2)];

  return Object.freeze({
    probeCount: measuredProbes,
    clusterCount: tree.shell.length,
    maximumGap,
    meanGap: measuredProbes === 0 ? 0 : totalGap / measuredProbes,
    p95Gap: percentile(0.95),
    maximumAllowedRadius: maximumAllowed,
    gapRatio: maximumAllowed === 0 ? 0 : maximumGap / maximumAllowed,
    medianCardWidth,
    gapCardRatio: medianCardWidth === 0 ? 0 : maximumGap / medianCardWidth,
    bareExposedLobes,
    worst,
  });
}
