import { createPathAttachmentFrame, createTreeIrFrame } from './tree-ir-frame.js';
import {
  FOLIAGE_PRIMITIVE_FAMILIES,
  TREE_IR_ROOT_STEM_ID,
  TREE_IR_SCHEMA_VERSION,
} from './tree-ir-schema.js';
import { validateTreeIr } from './tree-ir-validator.js';
import {
  SYMPODIAL_BROADLEAF_MODEL_ID,
} from './sympodial-broadleaf-constants.js';
import { SeededRandom } from './seeded-random.js';

const TAU = Math.PI * 2;
const ROOT_WIND_NODE_ID = 'wind:stem:root';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(minimum, maximum, ratio) {
  return minimum + (maximum - minimum) * ratio;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function vector(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function add(left, right) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function subtract(left, right) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function multiply(value, scalar) {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

function length(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value, fallback = { x: 0, y: 1, z: 0 }) {
  const magnitude = length(value);
  if (magnitude <= Number.EPSILON) return { ...fallback };
  return multiply(value, 1 / magnitude);
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function directionFromAngles(azimuth, elevation) {
  const horizontal = Math.cos(elevation);
  return {
    x: Math.cos(azimuth) * horizontal,
    y: Math.sin(elevation),
    z: Math.sin(azimuth) * horizontal,
  };
}

function azimuthOf(direction) {
  return Math.atan2(direction.z, direction.x);
}

function elevationOf(direction) {
  return Math.asin(clamp(direction.y, -1, 1));
}

function createRootPath(preset, random) {
  const points = [];
  const segments = preset.trunk.segments;
  const phase = random.range(0, TAU);
  const crownBase = preset.height * preset.morphology.crownBaseRatio;
  const targetHeight = Math.max(crownBase, preset.height * 0.58);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const curveEnvelope = Math.sin(Math.PI * t);
    const bend = preset.trunk.curve * preset.height * 0.045 * curveEnvelope;
    points.push({
      x: preset.trunk.lean[0] * t + Math.cos(phase) * bend,
      y: targetHeight * t,
      z: preset.trunk.lean[1] * t + Math.sin(phase) * bend,
    });
  }
  return points;
}

function createRootStem(preset, random) {
  const path = createRootPath(preset, random);
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
    windNodeId: ROOT_WIND_NODE_ID,
    metadata: {
      kind: 'sympodial-root',
      flare: preset.trunk.flare,
    },
  };
}

function pathPointAt(stem, ratio) {
  const points = stem.path;
  if (ratio <= 0) return { ...points[0] };
  if (ratio >= 1) return { ...points.at(-1) };
  const scaled = ratio * (points.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const left = points[index];
  const right = points[Math.min(points.length - 1, index + 1)];
  return {
    x: lerp(left.x, right.x, local),
    y: lerp(left.y, right.y, local),
    z: lerp(left.z, right.z, local),
  };
}

function pathTangentAt(stem, ratio) {
  const epsilon = 1 / Math.max(8, stem.path.length * 2);
  const before = pathPointAt(stem, Math.max(0, ratio - epsilon));
  const after = pathPointAt(stem, Math.min(1, ratio + epsilon));
  return normalize(subtract(after, before));
}

function createStemPath(start, direction, stemLength, sag, segments, random) {
  const points = [];
  const side = normalize(cross(direction, { x: 0, y: 1, z: 0 }), {
    x: 1,
    y: 0,
    z: 0,
  });
  const sway = random.signed() * stemLength * 0.035;

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const sagOffset = sag * stemLength * 0.16 * Math.sin(Math.PI * t);
    const swayOffset = sway * Math.sin(Math.PI * t);
    points.push(
      add(
        add(start, multiply(direction, stemLength * t)),
        add(
          { x: 0, y: -sagOffset, z: 0 },
          multiply(side, swayOffset),
        ),
      ),
    );
  }
  return points;
}

function crownCenter(preset) {
  return {
    x: preset.trunk.lean[0] * 0.55,
    y:
      preset.height *
      lerp(0.62, 0.72, 1 - preset.morphology.crownFlattening),
    z: preset.trunk.lean[1] * 0.55,
  };
}

function desiredCrownDirection(start, preset, random, azimuthBias) {
  const target = crownCenter(preset);
  const crownHeight = preset.height * (1 - preset.morphology.crownBaseRatio);
  const targetSpread =
    crownHeight * preset.morphology.crownSpread * random.range(0.55, 1);
  const elevation = random.range(0.18, 0.62) * (1 - preset.morphology.crownFlattening * 0.58);
  const radialTarget = {
    x: target.x + Math.cos(azimuthBias) * targetSpread,
    y: Math.max(target.y, start.y + crownHeight * random.range(0.35, 0.82)),
    z: target.z + Math.sin(azimuthBias) * targetSpread,
  };
  return normalize(
    add(
      normalize(subtract(radialTarget, start)),
      directionFromAngles(azimuthBias, elevation),
    ),
  );
}

function directionScore(direction, origin, endpointDirections, preset) {
  const end = add(origin, direction);
  let minimumDistance = Number.POSITIVE_INFINITY;
  for (const entry of endpointDirections) {
    minimumDistance = Math.min(minimumDistance, length(subtract(end, entry)));
  }
  const spread = Math.hypot(direction.x, direction.z);
  const verticalPenalty = Math.max(0, direction.y - 0.82);
  return (
    minimumDistance * preset.morphology.selfOrganization +
    spread * preset.morphology.crownSpread -
    verticalPenalty * 0.55
  );
}

function chooseChildDirection(
  parentDirection,
  start,
  state,
  preset,
  random,
  childIndex,
) {
  const parentAzimuth = azimuthOf(parentDirection);
  const parentElevation = elevationOf(parentDirection);
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (
    let candidateIndex = 0;
    candidateIndex < preset.morphology.directionCandidates;
    candidateIndex += 1
  ) {
    const childSpread =
      (childIndex + candidateIndex / preset.morphology.directionCandidates) *
      (TAU / Math.max(2, preset.morphology.childCount[1]));
    const azimuth =
      parentAzimuth + childSpread + random.signed() * 0.52;
    const angle = random.range(
      preset.morphology.branchAngle[0],
      preset.morphology.branchAngle[1],
    );
    const elevation = clamp(
      parentElevation * 0.35 +
        preset.morphology.upwardBias * 0.65 +
        Math.cos(angle) * 0.28 +
        random.signed() * 0.12,
      -0.22,
      1.18,
    );
    const candidate = directionFromAngles(azimuth, elevation);
    const score = directionScore(
      candidate,
      start,
      state.endpoints,
      preset,
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best ?? parentDirection;
}

function groupFor(state, sourceStemId) {
  let group = state.groups.get(sourceStemId);
  if (!group) {
    group = {
      id: `foliage-group:${sourceStemId}`,
      stemIds: [sourceStemId],
      crownVolumeIds: [],
      foliageSiteIds: [],
      metadata: { kind: 'sympodial-terminal' },
    };
    state.groups.set(sourceStemId, group);
  }
  return group;
}

function createTerminalFoliage(stem, direction, state, preset, random) {
  const end = stem.path.at(-1);
  const volumeId = `crown:${stem.id}`;
  const group = groupFor(state, stem.id);
  const flatten = preset.morphology.crownFlattening;
  const volumeScale =
    preset.morphology.crownVolumeScale *
    preset.morphology.foliageScale *
    random.range(0.82, 1.16);
  state.crownVolumes.push({
    id: volumeId,
    sourceStemId: stem.id,
    center: {
      x: end.x + direction.x * volumeScale * 0.24,
      y: end.y + direction.y * volumeScale * 0.16,
      z: end.z + direction.z * volumeScale * 0.24,
    },
    scale: {
      x: volumeScale * random.range(0.9, 1.25),
      y: volumeScale * lerp(0.95, 0.5, flatten) * random.range(0.9, 1.08),
      z: volumeScale * random.range(0.9, 1.25),
    },
    rotation: {
      x: random.signed() * 0.18,
      y: random.range(0, TAU),
      z: random.signed() * 0.18,
    },
    density: 1,
    exposure: 1,
    macroClumpId: state.crownVolumes.length,
    colorMix: random.next(),
    importance: stem.importance,
    metadata: { kind: 'sympodial-terminal-volume' },
  });
  group.crownVolumeIds.push(volumeId);

  const count = preset.morphology.foliageSitesPerTerminal;
  const frame = createTreeIrFrame(end, direction);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU + random.signed() * 0.28;
    const radial = add(
      multiply(frame.normal, Math.cos(angle)),
      multiply(frame.binormal, Math.sin(angle)),
    );
    const offset = add(
      multiply(direction, random.range(-0.08, 0.24) * volumeScale),
      multiply(radial, random.range(0.24, 0.72) * volumeScale),
    );
    const position = add(end, offset);
    const tangent = normalize(
      add(
        multiply(direction, 0.45),
        add(multiply(radial, 0.72), { x: 0, y: random.range(0.12, 0.5), z: 0 }),
      ),
    );
    const siteId = `foliage:${stem.id}:${index}`;
    state.foliageSites.push({
      id: siteId,
      parentStemId: stem.id,
      frame: createTreeIrFrame(position, tangent),
      branchPosition: 1,
      exposure: 1,
      age: 0.45 + stem.age * 0.55,
      vigor: 0.78 + stem.importance * 0.22,
      lightFactor: 0.9 + random.next() * 0.1,
      densityPotential: 1,
      primitiveFamily: FOLIAGE_PRIMITIVE_FAMILIES.BROADLEAF_SPRAY,
      importance: stem.importance,
      windNodeId: stem.windNodeId,
      metadata: {
        broadleaf: {
          foliageScale:
            preset.morphology.foliageScale * random.range(0.86, 1.12),
          terminalStemId: stem.id,
        },
      },
    });
    group.foliageSiteIds.push(siteId);
  }
}

function createChildStem(
  parent,
  start,
  direction,
  order,
  childIndex,
  state,
  preset,
  random,
) {
  const baseLength =
    preset.height *
    random.range(preset.morphology.leaderReach[0], preset.morphology.leaderReach[1]);
  const stemLength =
    baseLength *
    preset.morphology.lengthDecay ** Math.max(0, order - 1) *
    random.range(
      1 - preset.morphology.lengthVariation,
      1 + preset.morphology.lengthVariation,
    );
  const startRadius = Math.max(
    0.025,
    parent.endRadius * preset.morphology.radiusDecay * random.range(0.88, 1.08),
  );
  const endRadius = Math.max(
    0.012,
    startRadius * preset.morphology.radiusDecay * random.range(0.9, 1.08),
  );
  const id = `stem:${++state.nextStemIndex}`;
  const windNodeId = `wind:${id}`;
  const path = createStemPath(
    start,
    direction,
    stemLength,
    preset.morphology.branchSag,
    preset.morphology.stemPathSegments,
    random,
  );
  const importance =
    Math.max(0.16, 1 - order / (preset.morphology.branchingDepth + 1)) *
    random.range(0.88, 1.08);
  const stem = {
    id,
    parentId: parent.id,
    order,
    attachmentFrame: createPathAttachmentFrame(path),
    path,
    startRadius,
    endRadius,
    taperPower: preset.trunk.taperPower,
    exposedTip: order >= preset.morphology.branchingDepth,
    age: clamp(1 - order * 0.14, 0.18, 1),
    importance,
    windNodeId,
    metadata: {
      kind: 'sympodial-branch',
      childIndex,
    },
  };
  state.windNodes.push({
    id: windNodeId,
    parentId: parent.windNodeId,
    phase: random.next(),
    stiffness: clamp(0.92 - order * 0.12, 0.34, 0.92),
    damping: clamp(0.48 + order * 0.055, 0.48, 0.72),
    massAreaProxy: stemLength * startRadius,
  });
  return stem;
}

function shouldPruneChild(parent, order, preset, random) {
  if (order !== 1) return false;
  const attachmentHeight = parent.path.at(-1).y / preset.height;
  const lowerInfluence = clamp(
    (preset.morphology.crownBaseRatio + 0.18 - attachmentHeight) / 0.34,
    0,
    1,
  );
  return random.next() < preset.morphology.lowerLimbLoss * lowerInfluence;
}

function growBranch(parent, direction, order, state, preset, random) {
  if (
    state.stems.length >= preset.morphology.maximumStemCount ||
    order > preset.morphology.branchingDepth
  ) {
    createTerminalFoliage(parent, direction, state, preset, random);
    return;
  }

  const childCount = random.int(
    preset.morphology.childCount[0],
    preset.morphology.childCount[1],
  );
  let createdChild = false;
  for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
    if (state.stems.length >= preset.morphology.maximumStemCount) break;
    const attachment = random.range(
      preset.morphology.childAttachmentRange[0],
      preset.morphology.childAttachmentRange[1],
    );
    const start = pathPointAt(parent, attachment);
    const parentDirection = pathTangentAt(parent, attachment);
    const childDirection = chooseChildDirection(
      parentDirection,
      start,
      state,
      preset,
      random,
      childIndex,
    );
    const stem = createChildStem(
      parent,
      start,
      childDirection,
      order,
      childIndex,
      state,
      preset,
      random,
    );
    if (shouldPruneChild(stem, order, preset, random)) continue;
    state.stems.push(stem);
    state.endpoints.push(stem.path.at(-1));
    createdChild = true;
    growBranch(stem, childDirection, order + 1, state, preset, random);
  }

  if (!createdChild) createTerminalFoliage(parent, direction, state, preset, random);
}

function createLeaders(rootStem, state, preset, random) {
  const count = preset.morphology.leaderCount;
  const startRatio = Math.max(0.55, preset.morphology.crownBaseRatio);
  for (let index = 0; index < count; index += 1) {
    const attachment = clamp(
      startRatio + index * 0.04 + random.signed() * 0.025,
      0.52,
      0.92,
    );
    const start = pathPointAt(rootStem, attachment);
    const azimuth = (index / count) * TAU + random.signed() * 0.32;
    const direction = desiredCrownDirection(start, preset, random, azimuth);
    const stem = createChildStem(
      rootStem,
      start,
      direction,
      1,
      index,
      state,
      preset,
      random,
    );
    state.stems.push(stem);
    state.endpoints.push(stem.path.at(-1));
    growBranch(stem, direction, 2, state, preset, random);
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
          leafShape: preset.foliage.leafShape,
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
