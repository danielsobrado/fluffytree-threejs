import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js';
import {
  calculateLobeExposure,
  prepareExposureLobes,
} from '../generation/lobe-exposure.js';
import {
  lobeSurfaceNormal,
  pointOnLobeSurface,
} from '../generation/lobe-geometry.js';
import { SpatialHashGrid } from '../generation/spatial-hash-grid.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';
import { analyzeContinuousShellCoverage } from './continuous-shell-coverage-analyzer.js';

const GRID_SEARCH_RINGS = 3;

function averageScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function areaJacobian(scale, direction) {
  return (
    scale.x *
    scale.y *
    scale.z *
    Math.sqrt(
      (direction.x / scale.x) ** 2 +
        (direction.y / scale.y) ** 2 +
        (direction.z / scale.z) ** 2,
    )
  );
}

function coveringRadius(lobe, settings) {
  return (
    averageScale(lobe) *
    settings.cardScaleSample *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier *
    settings.coverageCardRatio
  );
}

function renderedCardWidth(instance) {
  return (
    instance.cardWidth ??
    (instance.shellScale ?? instance.scale) *
      instance.widthRatio *
      FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier
  );
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

export function analyzeShellCoverage(tree, preset, options = {}) {
  const densityMultiplier = options.probeDensityMultiplier ?? 2;
  const exposureMargin = options.probeExposureMargin ?? 0;
  const settings = preset.foliage.shell;
  const lobes = prepareExposureLobes(tree.lobes);
  const probeCount = Math.round(settings.candidatesPerLobe * densityMultiplier);
  const clusterRadii = tree.shell.map((instance) => instance.coverageRadius ?? 0);
  const cellSize = Math.max(1e-3, Math.max(0, ...clusterRadii) * 2);
  const grid = buildClusterGrid(tree.shell, cellSize);
  const clustersByLobe = new Map();

  for (const instance of tree.shell) {
    clustersByLobe.set(
      instance.lobeId,
      (clustersByLobe.get(instance.lobeId) ?? 0) + 1,
    );
  }

  let maximumGap = 0;
  let totalGap = 0;
  let measuredProbes = 0;
  let bareExposedLobes = 0;
  let exposedArea = 0;
  let worst = null;
  const gaps = [];

  for (const lobe of lobes) {
    const allowedRadius = coveringRadius(lobe, settings);
    const phase =
      ((lobe.id + 1) * FOLIAGE_SHELL_CONSTANTS.goldenAngle * 7.3) %
      FOLIAGE_SHELL_CONSTANTS.tau;
    let exposedProbes = 0;

    for (let index = 0; index < probeCount; index += 1) {
      const direction = createProbeDirection(index, probeCount, phase);
      const surfacePoint = pointOnLobeSurface(lobe, direction);
      const exposure = calculateLobeExposure(surfacePoint, lobes, lobe.id);

      if (exposure >= settings.exposureThreshold) {
        exposedArea +=
          (4 * Math.PI * areaJacobian(lobe.scale, direction)) / probeCount;
      }

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
    ...lobes.map((lobe) => coveringRadius(lobe, settings)),
  );
  const cardWidths = tree.shell
    .map(renderedCardWidth)
    .sort((left, right) => left - right);
  const maximumPhysicalCoverageRatio = Math.max(
    0,
    ...tree.shell.map((instance) => {
      const width = renderedCardWidth(instance);
      return width > 0
        ? Number(instance.alphaCoverageRadius) / width
        : Number.POSITIVE_INFINITY;
    }),
  );
  const medianCardWidth =
    cardWidths.length === 0
      ? 0
      : cardWidths[Math.floor(cardWidths.length / 2)];
  const totalCardArea = cardWidths.reduce(
    (total, width) => total + width * width * settings.planesPerCluster,
    0,
  );
  const continuous = analyzeContinuousShellCoverage(
    tree,
    preset,
    options.continuous,
  );

  return Object.freeze({
    probeCount: measuredProbes,
    clusterCount: tree.shell.length,
    candidateCoverageRatio: tree.shellCandidateCoverageRatio,
    maximumGap,
    meanGap: measuredProbes === 0 ? 0 : totalGap / measuredProbes,
    p95Gap: percentile(0.95),
    maximumAllowedRadius: maximumAllowed,
    maximumPhysicalCoverageRatio,
    gapRatio: maximumAllowed === 0 ? 0 : maximumGap / maximumAllowed,
    medianCardWidth,
    gapCardRatio: medianCardWidth === 0 ? 0 : maximumGap / medianCardWidth,
    exposedArea,
    leafAreaIndex: exposedArea === 0 ? 0 : totalCardArea / exposedArea,
    bareExposedLobes,
    worst,
    continuous,
  });
}
