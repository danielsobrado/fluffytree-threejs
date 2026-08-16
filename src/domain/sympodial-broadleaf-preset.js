import {
  SYMPODIAL_BROADLEAF_LIMITS,
  SYMPODIAL_BROADLEAF_MODEL_ID,
} from '../generation/sympodial-broadleaf-constants.js';
import { parseTreeEnvironmentResponse } from '../generation/tree-environment-response.js';
import {
  requireConfigColor,
  requireConfigInteger,
  requireConfigIntegerPair,
  requireConfigObject,
  requireConfigPair,
  requireConfigPalette,
  requireConfigRange,
  requireConfigString,
  requireConfigVector2,
  requirePositiveConfig,
} from './botanical-preset-validation.js';

export function createSympodialBroadleafPreset(id, value) {
  requireConfigString(id, 'tree preset id');
  requireConfigObject(value, id);
  if (value.generationModel !== SYMPODIAL_BROADLEAF_MODEL_ID) {
    throw new Error(
      `Configuration '${id}.generationModel' must be '${SYMPODIAL_BROADLEAF_MODEL_ID}'.`,
    );
  }
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
    generationModel: SYMPODIAL_BROADLEAF_MODEL_ID,
    height: requirePositiveConfig(value.height, `${id}.height`),
    morphology: Object.freeze({
      crownBaseRatio: requireConfigRange(
        morphology.crownBaseRatio,
        SYMPODIAL_BROADLEAF_LIMITS.crownBaseRatio,
        `${id}.morphology.crownBaseRatio`,
      ),
      leaderCount: requireConfigInteger(
        morphology.leaderCount,
        SYMPODIAL_BROADLEAF_LIMITS.leaderCount,
        `${id}.morphology.leaderCount`,
      ),
      branchingDepth: requireConfigInteger(
        morphology.branchingDepth,
        SYMPODIAL_BROADLEAF_LIMITS.branchingDepth,
        `${id}.morphology.branchingDepth`,
      ),
      childCount: requireConfigIntegerPair(
        morphology.childCount,
        SYMPODIAL_BROADLEAF_LIMITS.childCount,
        `${id}.morphology.childCount`,
      ),
      directionCandidates: requireConfigInteger(
        morphology.directionCandidates,
        SYMPODIAL_BROADLEAF_LIMITS.directionCandidates,
        `${id}.morphology.directionCandidates`,
      ),
      leaderReach: requireConfigPair(
        morphology.leaderReach,
        SYMPODIAL_BROADLEAF_LIMITS.leaderReach,
        `${id}.morphology.leaderReach`,
      ),
      lengthDecay: requireConfigRange(
        morphology.lengthDecay,
        SYMPODIAL_BROADLEAF_LIMITS.lengthDecay,
        `${id}.morphology.lengthDecay`,
      ),
      lengthVariation: requireConfigRange(
        morphology.lengthVariation,
        SYMPODIAL_BROADLEAF_LIMITS.lengthVariation,
        `${id}.morphology.lengthVariation`,
      ),
      radiusDecay: requireConfigRange(
        morphology.radiusDecay,
        SYMPODIAL_BROADLEAF_LIMITS.radiusDecay,
        `${id}.morphology.radiusDecay`,
      ),
      branchAngle: requireConfigPair(
        morphology.branchAngle,
        SYMPODIAL_BROADLEAF_LIMITS.branchAngle,
        `${id}.morphology.branchAngle`,
      ),
      upwardBias: requireConfigRange(
        morphology.upwardBias,
        SYMPODIAL_BROADLEAF_LIMITS.upwardBias,
        `${id}.morphology.upwardBias`,
      ),
      branchSag: requireConfigRange(
        morphology.branchSag,
        SYMPODIAL_BROADLEAF_LIMITS.branchSag,
        `${id}.morphology.branchSag`,
      ),
      crownSpread: requireConfigRange(
        morphology.crownSpread,
        SYMPODIAL_BROADLEAF_LIMITS.crownSpread,
        `${id}.morphology.crownSpread`,
      ),
      crownFlattening: requireConfigRange(
        morphology.crownFlattening,
        SYMPODIAL_BROADLEAF_LIMITS.crownFlattening,
        `${id}.morphology.crownFlattening`,
      ),
      selfOrganization: requireConfigRange(
        morphology.selfOrganization,
        SYMPODIAL_BROADLEAF_LIMITS.selfOrganization,
        `${id}.morphology.selfOrganization`,
      ),
      lowerLimbLoss: requireConfigRange(
        morphology.lowerLimbLoss,
        SYMPODIAL_BROADLEAF_LIMITS.lowerLimbLoss,
        `${id}.morphology.lowerLimbLoss`,
      ),
      childAttachmentRange: requireConfigPair(
        morphology.childAttachmentRange,
        SYMPODIAL_BROADLEAF_LIMITS.childAttachmentRange,
        `${id}.morphology.childAttachmentRange`,
      ),
      foliageSitesPerTerminal: requireConfigInteger(
        morphology.foliageSitesPerTerminal,
        SYMPODIAL_BROADLEAF_LIMITS.foliageSitesPerTerminal,
        `${id}.morphology.foliageSitesPerTerminal`,
      ),
      foliageScale: requireConfigRange(
        morphology.foliageScale,
        SYMPODIAL_BROADLEAF_LIMITS.foliageScale,
        `${id}.morphology.foliageScale`,
      ),
      crownVolumeScale: requireConfigRange(
        morphology.crownVolumeScale,
        SYMPODIAL_BROADLEAF_LIMITS.crownVolumeScale,
        `${id}.morphology.crownVolumeScale`,
      ),
      maximumStemCount: requireConfigInteger(
        morphology.maximumStemCount,
        SYMPODIAL_BROADLEAF_LIMITS.maximumStemCount,
        `${id}.morphology.maximumStemCount`,
      ),
      stemPathSegments: requireConfigInteger(
        morphology.stemPathSegments,
        SYMPODIAL_BROADLEAF_LIMITS.stemPathSegments,
        `${id}.morphology.stemPathSegments`,
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
        SYMPODIAL_BROADLEAF_LIMITS.taperPower,
        `${id}.trunk.taperPower`,
      ),
      curve: requireConfigRange(
        trunk.curve,
        SYMPODIAL_BROADLEAF_LIMITS.trunkCurve,
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
