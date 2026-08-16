import { PALM_TREE_MODEL_ID } from '../generation/palm-tree-constants.js';
import {
  DEFAULT_TREE_GENERATION_MODEL,
  resolveTreeGenerationModelId,
} from '../generation/tree-generation-model.js';
import { parseTreeEnvironmentResponse } from '../generation/tree-environment-response.js';
import { SYMPODIAL_BROADLEAF_MODEL_ID } from '../generation/sympodial-broadleaf-constants.js';
import { resolveFoliageContinuityProfile } from './foliage-continuity-config.js';
import { createPalmTreePreset } from './palm-tree-preset.js';
import { createSympodialBroadleafPreset } from './sympodial-broadleaf-preset.js';
import { createTreePreset } from './tree-preset.js';

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function compileLegacyCompatiblePreset(id, value, continuityConfig) {
  const basePreset = createTreePreset(id, value);
  const continuity = resolveFoliageContinuityProfile(
    continuityConfig,
    basePreset.crown.profile,
  );
  const morphology = value?.morphology ?? {};
  if (
    !morphology ||
    typeof morphology !== 'object' ||
    Array.isArray(morphology)
  ) {
    throw new Error(`Configuration '${id}.morphology' must be an object.`);
  }
  return Object.freeze({
    ...basePreset,
    generationModel: resolveTreeGenerationModelId(
      value?.generationModel,
      `${id}.generationModel`,
    ),
    continuity,
    morphology: deepFreeze(clone(morphology)),
    environmentResponse: parseTreeEnvironmentResponse(
      value?.environmentResponse,
      `${id}.environmentResponse`,
    ),
  });
}

const BUILTIN_COMPILERS = new Map([
  [PALM_TREE_MODEL_ID, createPalmTreePreset],
  [SYMPODIAL_BROADLEAF_MODEL_ID, createSympodialBroadleafPreset],
]);

export function compileTreePreset(id, value, continuityConfig = null) {
  const modelId = resolveTreeGenerationModelId(
    value?.generationModel,
    `${id}.generationModel`,
  );
  const compiler = BUILTIN_COMPILERS.get(modelId);
  if (compiler) return compiler(id, value);
  return compileLegacyCompatiblePreset(id, value, continuityConfig);
}

export function registerTreePresetCompiler(modelId, compiler) {
  const normalizedId = resolveTreeGenerationModelId(modelId);
  if (normalizedId === DEFAULT_TREE_GENERATION_MODEL) {
    throw new Error('The default tree preset compiler cannot be replaced globally.');
  }
  if (typeof compiler !== 'function') {
    throw new TypeError('Tree preset compiler must be a function.');
  }
  BUILTIN_COMPILERS.set(normalizedId, compiler);
}
