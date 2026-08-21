import { expandTreeIrFrondBounds } from './tree-ir-frond-bounds.js?v=2.0.0-20260814.2';
import { createPathAttachmentFrame, createTreeIrFrame } from './tree-ir-frame.js?v=2.0.0-20260814.2';
import {
  FOLIAGE_PRIMITIVE_FAMILIES,
  TREE_IR_ROOT_STEM_ID,
  TREE_IR_SCHEMA_VERSION,
} from './tree-ir-schema.js?v=2.0.0-20260814.2';
import { validateTreeIr } from './tree-ir-validator.js?v=2.0.0-20260814.2';
import { PALM_TREE_MODEL_ID } from './palm-tree-constants.js?v=2.0.0-20260814.2';
import { SeededRandom } from './seeded-random.js?v=2.0.0-20260814.2';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ROOT_WIND_NODE_ID = 'wind:stem:root';

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

function createTrunkPath(preset, crownY, random) {
  const points = [];
  const phase = random.range(0, Math.PI * 2);
  for (let index = 0; index <= preset.trunk.segments; index += 1) {
    const t = index / preset.trunk.segments;
    const bend =
      Math.sin(t * Math.PI) *
      preset.trunk.curve *
      preset.height *
      0.035;
    points.push({
      x: preset.trunk.lean[0] * t + Math.cos(phase) * bend,
      y: crownY * t,
      z: preset.trunk.lean[1] * t + Math.sin(phase) * bend,
    });
  }
  return points;
}

function createFrondSite(preset, crownPosition, random, index) {
  const { morphology } = preset;
  const ratio = morphology.frondCount === 1 ? 0 : index / (morphology.frondCount - 1);
  const ageRatio = ratio;
  const angle =
    index * GOLDEN_ANGLE +
    morphology.spiralOffset * Math.PI * 2 +
    random.signed() * 0.08;
  const length = random.range(
    morphology.frondLength[0],
    morphology.frondLength[1],
  );
  const width = random.range(
    morphology.frondWidth[0],
    morphology.frondWidth[1],
  );
  const skirtInfluence =
    morphology.skirtRatio <= 0
      ? 0
      : clamp(
          (ageRatio - (1 - morphology.skirtRatio)) /
            morphology.skirtRatio,
          0,
          1,
        );
  const droop = clamp(
    morphology.frondDroop * lerp(0.55, 1, ageRatio) + skirtInfluence * 0.42,
    0,
    1,
  );
  const rise = morphology.frondRise * (1 - ageRatio) * (1 - droop * 0.5);
  const horizontal = Math.sqrt(Math.max(0, 1 - rise * rise));
  const direction = {
    x: Math.cos(angle) * horizontal,
    y: rise - droop * 0.62,
    z: Math.sin(angle) * horizontal,
  };
  const position = {
    x: crownPosition.x,
    y: crownPosition.y - ageRatio * Math.min(0.28, width * 0.2),
    z: crownPosition.z,
  };
  const windNodeId = `wind:frond:${index}`;

  return {
    site: {
      id: `foliage:frond:${index}`,
      parentStemId: TREE_IR_ROOT_STEM_ID,
      frame: createTreeIrFrame(position, direction),
      branchPosition: 1,
      exposure: 1,
      age: ageRatio,
      vigor: 1 - skirtInfluence * 0.35,
      lightFactor: 1,
      densityPotential: 1,
      primitiveFamily: FOLIAGE_PRIMITIVE_FAMILIES.FROND,
      importance: lerp(1, 0.62, ageRatio),
      windNodeId,
      metadata: {
        frond: {
          index,
          length,
          width,
          droop,
          rise,
          azimuth: angle,
          segmentCount: morphology.frondSegments,
          skirtInfluence,
        },
      },
    },
    windNode: {
      id: windNodeId,
      parentId: ROOT_WIND_NODE_ID,
      phase: random.next(),
      stiffness: lerp(0.72, 0.38, droop),
      damping: lerp(0.42, 0.62, droop),
      massAreaProxy: length * width,
    },
  };
}

function createBounds(preset, trunkPath, foliageSites) {
  const bounds = {
    minimum: {
      x: Math.min(...trunkPath.map((point) => point.x)),
      y: 0,
      z: Math.min(...trunkPath.map((point) => point.z)),
    },
    maximum: {
      x: Math.max(...trunkPath.map((point) => point.x)),
      y: preset.height,
      z: Math.max(...trunkPath.map((point) => point.z)),
    },
  };

  for (const site of foliageSites) expandTreeIrFrondBounds(bounds, site);
  return bounds;
}

export class PalmTreeGenerator {
  generate(preset, seed) {
    if (preset.generationModel !== PALM_TREE_MODEL_ID) {
      throw new Error(
        `PalmTreeGenerator requires generation model '${PALM_TREE_MODEL_ID}'.`,
      );
    }
    const random = new SeededRandom(seed);
    const maximumFrondLength = preset.morphology.frondLength[1];
    const crownY = Math.max(
      preset.height * 0.55,
      preset.height - maximumFrondLength * preset.morphology.frondRise,
    );
    const trunkPath = createTrunkPath(preset, crownY, random);
    const crownPosition = { ...trunkPath.at(-1) };
    const generatedFronds = Array.from(
      { length: preset.morphology.frondCount },
      (_unused, index) => createFrondSite(preset, crownPosition, random, index),
    );
    const foliageSites = generatedFronds.map((entry) => entry.site);
    const crownScale = maximumFrondLength * 0.42;
    const crownVolumes = [
      {
        id: 'crown:palm',
        sourceStemId: TREE_IR_ROOT_STEM_ID,
        center: crownPosition,
        scale: {
          x: crownScale,
          y: Math.max(0.2, maximumFrondLength * 0.18),
          z: crownScale,
        },
        rotation: { x: 0, y: 0, z: 0 },
        density: 1,
        exposure: 1,
        macroClumpId: 0,
        colorMix: 0.5,
        importance: 1,
        metadata: { kind: 'palm-crown' },
      },
    ];
    const rootStem = {
      id: TREE_IR_ROOT_STEM_ID,
      parentId: null,
      order: 0,
      attachmentFrame: createPathAttachmentFrame(trunkPath),
      path: trunkPath,
      startRadius: preset.trunk.baseRadius,
      endRadius: preset.trunk.topRadius,
      taperPower: preset.trunk.taperPower,
      exposedTip: false,
      age: 1,
      importance: 1,
      windNodeId: ROOT_WIND_NODE_ID,
      metadata: {
        kind: 'palm-trunk',
        flare: preset.trunk.flare,
      },
    };
    const ir = {
      schemaVersion: TREE_IR_SCHEMA_VERSION,
      presetId: preset.id,
      generationModel: PALM_TREE_MODEL_ID,
      seed: Number(seed) >>> 0,
      height: preset.height,
      bounds: createBounds(preset, trunkPath, foliageSites),
      root: { stemId: TREE_IR_ROOT_STEM_ID },
      stems: [rootStem],
      foliageSites,
      foliageGroups: [
        {
          id: 'foliage-group:palm-crown',
          stemIds: [TREE_IR_ROOT_STEM_ID],
          crownVolumeIds: ['crown:palm'],
          foliageSiteIds: foliageSites.map((site) => site.id),
          metadata: { kind: 'palm-crown' },
        },
      ],
      windNodes: [
        {
          id: ROOT_WIND_NODE_ID,
          parentId: null,
          phase: random.next(),
          stiffness: 0.9,
          damping: 0.5,
          massAreaProxy: preset.trunk.baseRadius ** 2,
        },
        ...generatedFronds.map((entry) => entry.windNode),
      ],
      crownVolumes,
      metadata: {
        material: {
          trunkColor: preset.trunk.color,
          barkPalette: preset.trunk.barkPalette,
          foliagePalette: preset.foliage.palette,
          foliageRoughness: preset.foliage.roughness,
        },
        legacyRendererCompatible: false,
      },
    };

    validateTreeIr(ir);
    return deepFreeze(ir);
  }
}
