import { hashCanonicalValue } from '../core/canonical-value-hash.js';
import { createPathAttachmentFrame, createTreeIrFrame } from './tree-ir-frame.js';
import { expandTreeIrFrondBounds } from './tree-ir-frond-bounds.js';
import { validateTreeIr } from './tree-ir-validator.js';
import { pruneUnreferencedTreeIrWindNodes } from './tree-ir-wind-node-pruner.js';
import { createTreeEnvironmentContext } from './tree-environment-context.js';
import { TREE_ENVIRONMENT_CONSTANTS } from './tree-environment-constants.js';
import { parseTreeEnvironmentResponse } from './tree-environment-response.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function horizontalUnit(vector) {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= Number.EPSILON) return { x: 0, z: 0 };
  return { x: vector.x / length, z: vector.z / length };
}

function displacementAtHeight(y, height, response, environment) {
  const t = clamp01(y / Math.max(height, Number.EPSILON));
  const light = horizontalUnit(environment.lightDirection);
  const wind = horizontalUnit(environment.prevailingWindDirection);
  const slope = horizontalUnit(environment.groundNormal);
  const lightScale =
    response.phototropism *
    environment.lightBias *
    TREE_ENVIRONMENT_CONSTANTS.lightLeanRatio *
    height *
    t ** 1.45;
  const windScale =
    response.windShaping *
    environment.windStrength *
    TREE_ENVIRONMENT_CONSTANTS.windLeanRatio *
    height *
    t ** 2;
  const slopeCurve = t * (1 - t) ** 3;
  const slopeScale =
    response.slopeAdaptation *
    TREE_ENVIRONMENT_CONSTANTS.slopeBaseCurveRatio *
    height *
    slopeCurve;

  return {
    x: light.x * lightScale - wind.x * windScale + slope.x * slopeScale,
    y: 0,
    z: light.z * lightScale - wind.z * windScale + slope.z * slopeScale,
  };
}

function translated(point, displacement) {
  return {
    x: point.x + displacement.x,
    y: point.y,
    z: point.z + displacement.z,
  };
}

function volumeInfluence(position, volumes) {
  let maximum = 0;
  for (const volume of volumes) {
    const distance = Math.hypot(
      position.x - volume.center.x,
      position.y - volume.center.y,
      position.z - volume.center.z,
    );
    if (distance >= volume.radius) continue;
    maximum = Math.max(
      maximum,
      (1 - distance / volume.radius) * volume.strength,
    );
  }
  return clamp01(maximum);
}

function deterministicUnit(value) {
  return (
    Number.parseInt(hashCanonicalValue(value).slice(0, 8), 16) >>> 0
  ) / 0x100000000;
}

function shouldPrune(site, influence, sensitivity) {
  const probability = clamp01(influence * sensitivity);
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return deterministicUnit([site.id, 'pruning']) < probability;
}

function createBounds(ir) {
  const bounds = {
    minimum: { x: 0, y: 0, z: 0 },
    maximum: { x: 0, y: ir.height, z: 0 },
  };
  const include = (point) => {
    bounds.minimum.x = Math.min(bounds.minimum.x, point.x);
    bounds.minimum.y = Math.min(bounds.minimum.y, point.y);
    bounds.minimum.z = Math.min(bounds.minimum.z, point.z);
    bounds.maximum.x = Math.max(bounds.maximum.x, point.x);
    bounds.maximum.y = Math.max(bounds.maximum.y, point.y);
    bounds.maximum.z = Math.max(bounds.maximum.z, point.z);
  };

  for (const stem of ir.stems) stem.path.forEach(include);
  for (const volume of ir.crownVolumes) {
    include({
      x: volume.center.x - Math.abs(volume.scale.x),
      y: volume.center.y - Math.abs(volume.scale.y),
      z: volume.center.z - Math.abs(volume.scale.z),
    });
    include({
      x: volume.center.x + Math.abs(volume.scale.x),
      y: volume.center.y + Math.abs(volume.scale.y),
      z: volume.center.z + Math.abs(volume.scale.z),
    });
  }
  for (const site of ir.foliageSites) {
    include(site.frame.position);
    expandTreeIrFrondBounds(bounds, site);
  }
  return bounds;
}

function updateLegacyCrownCenter(metadata, crownVolumes) {
  if (!metadata?.legacy || crownVolumes.length === 0) return;
  const center = crownVolumes.reduce(
    (sum, volume) => ({
      x: sum.x + volume.center.x,
      y: sum.y + volume.center.y,
      z: sum.z + volume.center.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  metadata.legacy.crownCenter = {
    x: center.x / crownVolumes.length,
    y: center.y / crownVolumes.length,
    z: center.z / crownVolumes.length,
  };
}

function invalidateLegacyCoverage(metadata, prunedCount) {
  if (prunedCount <= 0 || !metadata?.legacy?.shellCoverageDiagnostics) return;
  metadata.legacy.shellCoverageDiagnostics = {
    ...metadata.legacy.shellCoverageDiagnostics,
    certified: false,
    environmentInvalidated: true,
    environmentPrunedSiteCount: prunedCount,
  };
}

function translateLegacyRenderMetadata(site, displacement) {
  const render = site.metadata?.render;
  if (!render) return;
  if (render.position) render.position = translated(render.position, displacement);
  if (render.surfacePoint) {
    render.surfacePoint = translated(render.surfacePoint, displacement);
  }
}

function hasResponse(response) {
  return Object.values(response).some((value) => value > 0);
}

export function applyTreeEnvironment(
  treeIr,
  responseInput,
  environmentInput,
  { inputValidated = false } = {},
) {
  if (!inputValidated) validateTreeIr(treeIr);
  const response = parseTreeEnvironmentResponse(responseInput ?? {});
  if (environmentInput === undefined || environmentInput === null || !hasResponse(response)) {
    return treeIr;
  }
  const environment = createTreeEnvironmentContext(environmentInput);
  const ir = structuredClone(treeIr);
  const volumeDisplacements = new Map();

  for (const stem of ir.stems) {
    stem.path = stem.path.map((point) =>
      translated(
        point,
        displacementAtHeight(point.y, ir.height, response, environment),
      ),
    );
    stem.attachmentFrame = createPathAttachmentFrame(stem.path);
    if (stem.id === ir.root.stemId) {
      stem.metadata.environment = {
        groundNormal: environment.groundNormal,
      };
    }
  }

  for (const volume of ir.crownVolumes) {
    const displacement = displacementAtHeight(
      volume.center.y,
      ir.height,
      response,
      environment,
    );
    volume.center = translated(volume.center, displacement);
    const legacyId = volume.metadata?.legacyId;
    if (legacyId !== undefined && legacyId !== null) {
      volumeDisplacements.set(legacyId, displacement);
    }
    const competition = volumeInfluence(
      volume.center,
      environment.competitionVolumes,
    );
    volume.density *=
      1 -
      competition *
        response.competitionSensitivity *
        TREE_ENVIRONMENT_CONSTANTS.competitionDensityReduction;
    volume.metadata.environment = { competition };
  }

  const keptSites = [];
  for (const site of ir.foliageSites) {
    const lobeDisplacement = volumeDisplacements.get(site.metadata?.lobeId);
    const displacement =
      lobeDisplacement ??
      displacementAtHeight(
        site.frame.position.y,
        ir.height,
        response,
        environment,
      );
    const position = translated(site.frame.position, displacement);
    site.frame = createTreeIrFrame(position, site.frame.tangent);
    translateLegacyRenderMetadata(site, displacement);
    const competition = volumeInfluence(position, environment.competitionVolumes);
    const pruning = volumeInfluence(position, environment.pruningVolumes);
    site.vigor *= 1 - competition * response.competitionSensitivity;
    site.lightFactor *= 1 - competition * response.competitionSensitivity * 0.65;
    site.densityPotential *=
      1 - competition * response.competitionSensitivity;
    site.metadata.environment = { competition, pruning };
    if (!shouldPrune(site, pruning, response.pruningSensitivity)) {
      keptSites.push(site);
    }
  }
  ir.foliageSites = keptSites;
  const siteIds = new Set(keptSites.map((site) => site.id));
  for (const group of ir.foliageGroups) {
    group.foliageSiteIds = group.foliageSiteIds.filter((id) => siteIds.has(id));
  }

  const prunedFoliageSiteCount = treeIr.foliageSites.length - keptSites.length;
  const prunedWindNodeCount =
    prunedFoliageSiteCount > 0 ? pruneUnreferencedTreeIrWindNodes(ir) : 0;
  ir.metadata.environment = {
    applied: true,
    response,
    context: environment,
    prunedFoliageSiteCount,
    prunedWindNodeCount,
  };
  invalidateLegacyCoverage(ir.metadata, prunedFoliageSiteCount);
  updateLegacyCrownCenter(ir.metadata, ir.crownVolumes);
  ir.bounds = createBounds(ir);
  validateTreeIr(ir);
  return ir;
}
