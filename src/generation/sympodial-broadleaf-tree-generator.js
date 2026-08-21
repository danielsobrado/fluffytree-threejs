import {
  addVector,
  coneDirection,
  createDirectionBasis,
  distanceSquared,
  lerpVector,
  normalizeVector3,
  scaleVector,
  subtractVector,
  vectorLength,
} from './botanical-vector.js?v=2.0.0-20260814.2';
import {
  SYMPODIAL_BROADLEAF_CONSTANTS,
  SYMPODIAL_BROADLEAF_MODEL_ID,
} from './sympodial-broadleaf-constants.js?v=2.0.0-20260814.2';
import { createPathAttachmentFrame, createTreeIrFrame } from './tree-ir-frame.js?v=2.0.0-20260814.2';
import {
  FOLIAGE_PRIMITIVE_FAMILIES,
  TREE_IR_ROOT_STEM_ID,
  TREE_IR_SCHEMA_VERSION,
} from './tree-ir-schema.js?v=2.0.0-20260814.2';
import { validateTreeIr } from './tree-ir-validator.js?v=2.0.0-20260814.2';
import { SeededRandom } from './seeded-random.js?v=2.0.0-20260814.2';

function lerp(minimum, maximum, ratio) {
  return minimum + (maximum - minimum) * ratio;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function createTrunkPath(preset, random) {
  const crownBaseHeight = preset.height * preset.morphology.crownBaseRatio;
  const phase = random.range(0, Math.PI * 2);
  const path = [];
  for (let index = 0; index <= preset.trunk.segments; index += 1) {
    const t = index / preset.trunk.segments;
    const curve =
      Math.sin(t * Math.PI) *
      preset.trunk.curve *
      crownBaseHeight *
      0.08;
    path.push({
      x: preset.trunk.lean[0] * t + Math.cos(phase) * curve,
      y: crownBaseHeight * t,
      z: preset.trunk.lean[1] * t + Math.sin(phase) * curve,
    });
  }
  return path;
}

function createStemPath(start, direction, length, order, preset, random) {
  const { morphology } = preset;
  const basis = createDirectionBasis(direction);
  const phase = random.range(0, Math.PI * 2);
  const lateral = addVector(
    scaleVector(basis.normal, Math.cos(phase)),
    scaleVector(basis.binormal, Math.sin(phase)),
  );
  const signedCurve =
    random.signed() * morphology.lengthVariation * length * 0.18;
  const sag = morphology.branchSag * length * lerp(0.12, 0.24, order / morphology.branchingDepth);
  const path = [];

  for (let index = 0; index <= morphology.stemPathSegments; index += 1) {
    const t = index / morphology.stemPathSegments;
    const base = addVector(start, scaleVector(direction, length * t));
    const curve = Math.sin(Math.PI * t) * signedCurve;
    path.push({
      x: base.x + lateral.x * curve,
      y: base.y + lateral.y * curve - sag * t * t,
      z: base.z + lateral.z * curve,
    });
  }
  return path;
}

function endpointSeparationScore(endpoint, endpoints, length) {
  if (endpoints.length === 0) return 1;
  let minimumSquared = Number.POSITIVE_INFINITY;
  for (const existing of endpoints) {
    minimumSquared = Math.min(minimumSquared, distanceSquared(endpoint, existing));
  }
  return Math.min(2, Math.sqrt(minimumSquared) / Math.max(length, 0.001));
}

function scoreDirection(direction, start, length, state, preset) {
  const { morphology } = preset;
  const endpoint = addVector(start, scaleVector(direction, length));
  const separation = endpointSeparationScore(
    endpoint,
    state.endpoints,
    length,
  );
  const radial = Math.hypot(endpoint.x, endpoint.z) / preset.height;
  const normalizedHeight = endpoint.y / preset.height;
  const targetHeight = lerp(0.92, 0.64, morphology.crownFlattening);
  const heightPenalty = Math.abs(normalizedHeight - targetHeight);
  const overflowPenalty =
    Math.max(0, normalizedHeight - 1) * 5 +
    Math.max(0, morphology.crownBaseRatio * 0.85 - normalizedHeight) * 4;

  return (
    separation * morphology.selfOrganization +
    radial * morphology.crownSpread +
    direction.y * morphology.upwardBias * 0.45 -
    heightPenalty * morphology.crownFlattening * 0.55 -
    overflowPenalty
  );
}

function shapeCandidateDirection(direction, start, preset) {
  const { morphology } = preset;
  const normalizedHeight = clamp(start.y / preset.height, 0, 1);
  const flattening =
    1 -
    morphology.crownFlattening *
      clamp((normalizedHeight - morphology.crownBaseRatio) / (1 - morphology.crownBaseRatio), 0, 1) *
      0.72;
  return normalizeVector3({
    x: direction.x * (1 + morphology.crownSpread * 0.55),
    y: direction.y * flattening + morphology.upwardBias * 0.28,
    z: direction.z * (1 + morphology.crownSpread * 0.55),
  });
}

function selectChildDirection(parentDirection, start, length, childIndex, state, preset, random) {
  const { morphology } = preset;
  let best = null;
  for (let index = 0; index < morphology.directionCandidates; index += 1) {
    const angle = random.range(
      morphology.branchAngle[0],
      morphology.branchAngle[1],
    );
    const azimuth =
      (childIndex * morphology.directionCandidates + index) *
        SYMPODIAL_BROADLEAF_CONSTANTS.goldenAngle +
      random.signed() * 0.18;
    const raw = coneDirection(parentDirection, angle, azimuth);
    const direction = shapeCandidateDirection(raw, start, preset);
    const score = scoreDirection(direction, start, length, state, preset);
    if (!best || score > best.score) best = { direction, score };
  }
  return best.direction;
}

function windNodeIdForStem(stemId) {
  return `wind:${stemId}`;
}

function groupForLeader(state, leaderIndex) {
  if (!state.groups.has(leaderIndex)) {
    state.groups.set(leaderIndex, {
      id: `foliage-group:leader:${leaderIndex}`,
      stemIds: [],
      crownVolumeIds: [],
      foliageSiteIds: [],
      metadata: { leaderIndex },
    });
  }
  return state.groups.get(leaderIndex);
}

function registerStem({
  parentStem,
  order,
  path,
  startRadius,
  endRadius,
  leaderIndex,
  state,
  preset,
  random,
}) {
  const id = `stem:${state.nextStemIndex}`;
  state.nextStemIndex += 1;
  const windNodeId = windNodeIdForStem(id);
  const length = path.reduce(
    (total, point, index) =>
      index === 0 ? total : total + vectorLength(subtractVector(point, path[index - 1])),
    0,
  );
  const stem = {
    id,
    parentId: parentStem.id,
    order,
    attachmentFrame: createPathAttachmentFrame(path),
    path,
    startRadius,
    endRadius,
    taperPower: preset.trunk.taperPower,
    exposedTip: true,
    age: Math.max(0, 1 - order / (preset.morphology.branchingDepth + 2)),
    importance: 1 / (order + 1),
    windNodeId,
    metadata: {
      kind: order === 1 ? 'leader' : 'sympodial-branch',
      leaderIndex,
      length,
    },
  };
  state.stems.push(stem);
  state.windNodes.push({
    id: windNodeId,
    parentId: parentStem.windNodeId,
    phase: random.next(),
    stiffness: Math.max(0.12, 1 - order * 0.16),
    damping: Math.min(0.92, 0.38 + order * 0.09),
    massAreaProxy: Math.max(0.001, startRadius * startRadius * length),
  });
  groupForLeader(state, leaderIndex).stemIds.push(id);
  return stem;
}

function createTerminalCrown(stem, leaderIndex, state, preset, random) {
  const { morphology } = preset;
  const end = stem.path.at(-1);
  const beforeEnd = stem.path.at(-2);
  const direction = normalizeVector3(subtractVector(end, beforeEnd));
  const branchLength = stem.metadata.length;
  const horizontalScale = Math.max(
    SYMPODIAL_BROADLEAF_CONSTANTS.minimumCrownAxis,
    branchLength * morphology.crownVolumeScale * 0.34,
  );
  const verticalScale = Math.max(
    SYMPODIAL_BROADLEAF_CONSTANTS.minimumCrownAxis,
    horizontalScale * lerp(1, 0.48, morphology.crownFlattening),
  );
  const volumeId = `crown:${state.crownVolumes.length}`;
  state.crownVolumes.push({
    id: volumeId,
    sourceStemId: stem.id,
    center: { ...end },
    scale: {
      x: horizontalScale,
      y: verticalScale,
      z: horizontalScale,
    },
    rotation: { x: 0, y: Math.atan2(direction.z, direction.x), z: 0 },
    density: 1,
    exposure: 1,
    macroClumpId: leaderIndex,
    colorMix: random.next(),
    importance: stem.importance,
    metadata: { kind: 'terminal-crown', leaderIndex },
  });
  const group = groupForLeader(state, leaderIndex);
  group.crownVolumeIds.push(volumeId);

  const basis = createDirectionBasis(direction);
  for (
    let index = 0;
    index < morphology.foliageSitesPerTerminal;
    index += 1
  ) {
    const ratio =
      morphology.foliageSitesPerTerminal === 1
        ? 1
        : lerp(0.68, 1, index / (morphology.foliageSitesPerTerminal - 1));
    const center = lerpVector(beforeEnd, end, ratio);
    const angle =
      index * SYMPODIAL_BROADLEAF_CONSTANTS.goldenAngle + random.signed() * 0.12;
    const offsetScale = horizontalScale * 0.32 * Math.sqrt(index / Math.max(1, morphology.foliageSitesPerTerminal - 1));
    const offset = addVector(
      scaleVector(basis.normal, Math.cos(angle) * offsetScale),
      scaleVector(basis.binormal, Math.sin(angle) * offsetScale),
    );
    const position = addVector(center, offset);
    const siteId = `foliage:${state.foliageSites.length}`;
    state.foliageSites.push({
      id: siteId,
      parentStemId: stem.id,
      frame: createTreeIrFrame(position, direction),
      branchPosition: ratio,
      exposure: 1,
      age: stem.age,
      vigor: 1,
      lightFactor: 1,
      densityPotential: 1,
      primitiveFamily: FOLIAGE_PRIMITIVE_FAMILIES.BROADLEAF,
      importance: stem.importance,
      windNodeId: stem.windNodeId,
      metadata: {
        broadleaf: {
          leaderIndex,
          terminalStemId: stem.id,
          foliageScale: morphology.foliageScale,
        },
      },
    });
    group.foliageSiteIds.push(siteId);
  }
}

function childAttachment(parentStem, childIndex, childCount, preset, random) {
  const range = preset.morphology.childAttachmentRange;
  const sequence = (childIndex + 0.5) / childCount;
  const ratio = clamp(
    lerp(range[0], range[1], sequence) +
      random.signed() * (range[1] - range[0]) * 0.08,
    range[0],
    range[1],
  );
  const scaled = ratio * (parentStem.path.length - 1);
  const index = Math.min(parentStem.path.length - 2, Math.floor(scaled));
  return lerpVector(
    parentStem.path[index],
    parentStem.path[index + 1],
    scaled - index,
  );
}

function shouldLoseLowerLimb(start, preset, random) {
  const { morphology } = preset;
  const normalizedHeight = start.y / preset.height;
  const lowerCrownRatio = clamp(
    1 - normalizedHeight / Math.max(morphology.crownBaseRatio + 0.35, 0.01),
    0,
    1,
  );
  return random.next() < morphology.lowerLimbLoss * lowerCrownRatio;
}

function growChildren(parentStem, leaderIndex, state, preset, random) {
  const { morphology } = preset;
  const order = parentStem.order + 1;
  if (
    order > morphology.branchingDepth ||
    state.stems.length >= morphology.maximumStemCount
  ) {
    createTerminalCrown(parentStem, leaderIndex, state, preset, random);
    return;
  }

  const childCount = random.integer(
    morphology.childCount[0],
    morphology.childCount[1],
  );
  const parentDirection = normalizeVector3(
    subtractVector(parentStem.path.at(-1), parentStem.path.at(-2)),
  );
  let created = 0;

  for (let index = 0; index < childCount; index += 1) {
    if (state.stems.length >= morphology.maximumStemCount) break;
    const start = childAttachment(parentStem, index, childCount, preset, random);
    if (shouldLoseLowerLimb(start, preset, random)) continue;
    const parentLength = parentStem.metadata.length;
    const length = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemLength,
      parentLength *
        morphology.lengthDecay *
        (1 + random.signed() * morphology.lengthVariation),
    );
    const direction = selectChildDirection(
      parentDirection,
      start,
      length,
      index,
      state,
      preset,
      random,
    );
    const path = createStemPath(start, direction, length, order, preset, random);
    const radiusScale = morphology.radiusDecay ** Math.max(1, order - 1);
    const startRadius = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemRadius,
      preset.trunk.baseRadius * 0.48 * radiusScale,
    );
    const endRadius = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemRadius * 0.55,
      startRadius * morphology.radiusDecay * 0.48,
    );
    const child = registerStem({
      parentStem,
      order,
      path,
      startRadius,
      endRadius,
      leaderIndex,
      state,
      preset,
      random,
    });
    state.endpoints.push(path.at(-1));
    created += 1;
    growChildren(child, leaderIndex, state, preset, random);
  }

  if (created === 0) {
    createTerminalCrown(parentStem, leaderIndex, state, preset, random);
  }
}

function createRootStem(preset, random) {
  const path = createTrunkPath(preset, random);
  return {
    id: TREE_IR_ROOT_STEM_ID,
    parentId: null,
    order: 0,
    attachmentFrame: createPathAttachmentFrame(path),
    path,
    startRadius: preset.trunk.baseRadius,
    endRadius: preset.trunk.topRadius,
    taperPower: preset.trunk.taperPower,
    exposedTip: false,
    age: 1,
    importance: 1,
    windNodeId: SYMPODIAL_BROADLEAF_CONSTANTS.rootWindNodeId,
    metadata: {
      kind: 'trunk',
      flare: preset.trunk.flare,
    },
  };
}

function createLeaderDirection(index, preset, random) {
  const angle =
    index * SYMPODIAL_BROADLEAF_CONSTANTS.goldenAngle +
    random.signed() * 0.18;
  const horizontal = lerp(0.18, 0.68, preset.morphology.crownSpread);
  return normalizeVector3({
    x: Math.cos(angle) * horizontal,
    y: lerp(1.2, 0.72, preset.morphology.crownSpread),
    z: Math.sin(angle) * horizontal,
  });
}

function createLeaders(rootStem, state, preset, random) {
  const crownHeight = preset.height * (1 - preset.morphology.crownBaseRatio);
  const start = rootStem.path.at(-1);
  for (let index = 0; index < preset.morphology.leaderCount; index += 1) {
    const direction = createLeaderDirection(index, preset, random);
    const desiredRise =
      crownHeight *
      Math.min(1, random.range(
        preset.morphology.leaderReach[0],
        preset.morphology.leaderReach[1],
      ));
    const length = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemLength,
      desiredRise / Math.max(0.3, direction.y),
    );
    const path = createStemPath(start, direction, length, 1, preset, random);
    const startRadius = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemRadius,
      preset.trunk.topRadius * lerp(0.74, 1.12, random.next()),
    );
    const endRadius = Math.max(
      SYMPODIAL_BROADLEAF_CONSTANTS.minimumStemRadius,
      startRadius * preset.morphology.radiusDecay,
    );
    const leader = registerStem({
      parentStem: rootStem,
      order: 1,
      path,
      startRadius,
      endRadius,
      leaderIndex: index,
      state,
      preset,
      random,
    });
    state.endpoints.push(path.at(-1));
    growChildren(leader, index, state, preset, random);
  }
}

function createBounds(preset, stems, crownVolumes) {
  const minimum = { x: 0, y: 0, z: 0 };
  const maximum = { x: 0, y: preset.height, z: 0 };
  const include = (point) => {
    minimum.x = Math.min(minimum.x, point.x);
    minimum.y = Math.min(minimum.y, point.y);
    minimum.z = Math.min(minimum.z, point.z);
    maximum.x = Math.max(maximum.x, point.x);
    maximum.y = Math.max(maximum.y, point.y);
    maximum.z = Math.max(maximum.z, point.z);
  };
  for (const stem of stems) stem.path.forEach(include);
  for (const volume of crownVolumes) {
    include({
      x: volume.center.x - volume.scale.x,
      y: volume.center.y - volume.scale.y,
      z: volume.center.z - volume.scale.z,
    });
    include({
      x: volume.center.x + volume.scale.x,
      y: volume.center.y + volume.scale.y,
      z: volume.center.z + volume.scale.z,
    });
  }
  return { minimum, maximum };
}

export class SympodialBroadleafTreeGenerator {
  generate(preset, seed) {
    if (preset.generationModel !== SYMPODIAL_BROADLEAF_MODEL_ID) {
      throw new Error(
        `SympodialBroadleafTreeGenerator requires generation model '${SYMPODIAL_BROADLEAF_MODEL_ID}'.`,
      );
    }
    const random = new SeededRandom(seed);
    const rootStem = createRootStem(preset, random);
    const state = {
      stems: [rootStem],
      windNodes: [
        {
          id: rootStem.windNodeId,
          parentId: null,
          phase: random.next(),
          stiffness: 0.96,
          damping: 0.46,
          massAreaProxy: preset.trunk.baseRadius ** 2 * preset.height,
        },
      ],
      crownVolumes: [],
      foliageSites: [],
      groups: new Map(),
      endpoints: [],
      nextStemIndex: 0,
    };
    createLeaders(rootStem, state, preset, random);

    const ir = {
      schemaVersion: TREE_IR_SCHEMA_VERSION,
      presetId: preset.id,
      generationModel: SYMPODIAL_BROADLEAF_MODEL_ID,
      seed: Number(seed) >>> 0,
      height: preset.height,
      bounds: createBounds(preset, state.stems, state.crownVolumes),
      root: { stemId: TREE_IR_ROOT_STEM_ID },
      stems: state.stems,
      foliageSites: state.foliageSites,
      foliageGroups: [...state.groups.values()],
      windNodes: state.windNodes,
      crownVolumes: state.crownVolumes,
      metadata: {
        material: {
          trunkColor: preset.trunk.color,
          barkPalette: preset.trunk.barkPalette,
          foliagePalette: preset.foliage.palette,
          foliageRoughness: preset.foliage.roughness,
        },
        topology: {
          leaderCount: preset.morphology.leaderCount,
          stemCount: state.stems.length,
          terminalCrownCount: state.crownVolumes.length,
        },
        legacyRendererCompatible: false,
      },
    };

    validateTreeIr(ir);
    return deepFreeze(ir);
  }
}
