import { PALM_TREE_LIMITS, PALM_TREE_MODEL_ID } from '../generation/palm-tree-constants.js';
import { parseTreeEnvironmentResponse } from '../generation/tree-environment-response.js';
import {
  requireConfigColor,
  requireConfigInteger,
  requireConfigObject,
  requireConfigPair,
  requireConfigPalette,
  requireConfigRange,
  requireConfigString,
  requireConfigVector2,
  requirePositiveConfig,
} from './botanical-preset-validation.js';

export function createPalmTreePreset(id, value) {
  requireConfigString(id, 'tree preset id');
  requireConfigObject(value, id);
  if (value.generationModel !== PALM_TREE_MODEL_ID) {
    throw new Error(
      `Configuration '${id}.generationModel' must be '${PALM_TREE_MODEL_ID}'.`,
    );
  }
  const height = requirePositiveConfig(value.height, `${id}.height`);
  const morphology = requireConfigObject(value.morphology, `${id}.morphology`);
  const trunk = requireConfigObject(value.trunk, `${id}.trunk`);
  const foliage = requireConfigObject(value.foliage, `${id}.foliage`);
  const baseRadius = requirePositiveConfig(
    trunk.baseRadius,
    `${id}.trunk.baseRadius`,
  );
  const topRadius = requirePositiveConfig(
    trunk.topRadius,
    `${id}.trunk.topRadius`,
  );
  if (topRadius > baseRadius) {
    throw new RangeError(
      `Configuration '${id}.trunk.topRadius' must not exceed baseRadius.`,
    );
  }

  return Object.freeze({
    id,
    label:
      value.label === undefined
        ? id
        : requireConfigString(value.label, `${id}.label`),
    generationModel: PALM_TREE_MODEL_ID,
    height,
    morphology: Object.freeze({
      frondCount: requireConfigInteger(
        morphology.frondCount,
        PALM_TREE_LIMITS.frondCount,
        `${id}.morphology.frondCount`,
      ),
      frondSegments: requireConfigInteger(
        morphology.frondSegments,
        PALM_TREE_LIMITS.frondSegments,
        `${id}.morphology.frondSegments`,
      ),
      frondLength: requireConfigPair(
        morphology.frondLength,
        PALM_TREE_LIMITS.frondLength,
        `${id}.morphology.frondLength`,
      ),
      frondWidth: requireConfigPair(
        morphology.frondWidth,
        PALM_TREE_LIMITS.frondWidth,
        `${id}.morphology.frondWidth`,
      ),
      frondDroop: requireConfigRange(
        morphology.frondDroop,
        PALM_TREE_LIMITS.frondDroop,
        `${id}.morphology.frondDroop`,
      ),
      frondRise: requireConfigRange(
        morphology.frondRise,
        PALM_TREE_LIMITS.frondRise,
        `${id}.morphology.frondRise`,
      ),
      skirtRatio: requireConfigRange(
        morphology.skirtRatio,
        PALM_TREE_LIMITS.skirtRatio,
        `${id}.morphology.skirtRatio`,
      ),
      spiralOffset: requireConfigRange(
        morphology.spiralOffset,
        PALM_TREE_LIMITS.spiralOffset,
        `${id}.morphology.spiralOffset`,
      ),
    }),
    trunk: Object.freeze({
      baseRadius,
      topRadius,
      segments: requireConfigInteger(
        trunk.segments,
        [3, 64],
        `${id}.trunk.segments`,
      ),
      flare: requireConfigRange(trunk.flare, [0, 1.5], `${id}.trunk.flare`),
      taperPower: requireConfigRange(
        trunk.taperPower,
        PALM_TREE_LIMITS.taperPower,
        `${id}.trunk.taperPower`,
      ),
      curve: requireConfigRange(
        trunk.curve,
        PALM_TREE_LIMITS.trunkCurve,
        `${id}.trunk.curve`,
      ),
      lean: requireConfigVector2(trunk.lean, `${id}.trunk.lean`),
      color: requireConfigColor(trunk.color, `${id}.trunk.color`),
      barkPalette: requireConfigPalette(
        trunk.barkPalette,
        `${id}.trunk.barkPalette`,
      ),
    }),
    foliage: Object.freeze({
      palette: requireConfigPalette(
        foliage.palette,
        `${id}.foliage.palette`,
      ),
      roughness: requireConfigRange(
        foliage.roughness,
        [0, 1],
        `${id}.foliage.roughness`,
      ),
    }),
    environmentResponse: parseTreeEnvironmentResponse(
      value.environmentResponse,
      `${id}.environmentResponse`,
    ),
  });
}
