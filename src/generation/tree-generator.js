import { CrownLobeTreeGenerator } from './crown-lobe-tree-generator.js?v=2.0.0-20260814.2';
import {
  DEFAULT_TREE_GENERATION_MODEL,
  resolveTreeGenerationModelId,
} from './tree-generation-model.js?v=2.0.0-20260814.2';
import { adaptTreeIrToLegacyTreeData } from './tree-ir-legacy-adapter.js?v=2.0.0-20260814.2';
import { validateTreeIr } from './tree-ir-validator.js?v=2.0.0-20260814.2';
import { applyTreeEnvironment } from './tree-environment-processor.js?v=2.0.0-20260814.2';
import { PALM_TREE_MODEL_ID } from './palm-tree-constants.js?v=2.0.0-20260814.2';
import { PalmTreeGenerator } from './palm-tree-generator.js?v=2.0.0-20260814.2';
import { SYMPODIAL_BROADLEAF_MODEL_ID } from './sympodial-broadleaf-constants.js?v=2.0.0-20260814.2';
import { SympodialBroadleafTreeGenerator } from './sympodial-broadleaf-tree-generator.js?v=2.0.0-20260814.2';
import { WHORLED_CONIFER_MODEL_ID } from './whorled-conifer-constants.js?v=2.0.0-20260814.2';
import { WhorledConiferTreeGenerator } from './whorled-conifer-tree-generator.js?v=2.0.0-20260814.2';

function modelEntries(modelGenerators) {
  if (modelGenerators === null || modelGenerators === undefined) return [];
  if (modelGenerators instanceof Map) return modelGenerators.entries();
  if (typeof modelGenerators === 'object' && !Array.isArray(modelGenerators)) {
    return Object.entries(modelGenerators);
  }
  throw new TypeError('Tree modelGenerators must be a Map or plain object.');
}

function validateGenerator(modelId, generator) {
  if (!generator || typeof generator.generate !== 'function') {
    throw new TypeError(
      `Tree generation model '${modelId}' must provide a generate() function.`,
    );
  }
}

function withPresetMaterialMetadata(treeIr, preset) {
  const leafShape = preset?.foliage?.leafShape;
  if (
    typeof leafShape !== 'string' ||
    leafShape === '' ||
    treeIr.metadata?.material?.leafShape === leafShape
  ) {
    return treeIr;
  }

  const material = Object.freeze({
    ...treeIr.metadata.material,
    leafShape,
  });
  const metadata = Object.freeze({
    ...treeIr.metadata,
    material,
  });
  return Object.freeze({ ...treeIr, metadata });
}

export class TreeGenerator {
  constructor({ modelGenerators = null, ...defaultModelOptions } = {}) {
    this.modelGenerators = new Map([
      [DEFAULT_TREE_GENERATION_MODEL, new CrownLobeTreeGenerator(defaultModelOptions)],
      [
        WHORLED_CONIFER_MODEL_ID,
        new WhorledConiferTreeGenerator(defaultModelOptions),
      ],
      [PALM_TREE_MODEL_ID, new PalmTreeGenerator(defaultModelOptions)],
      [
        SYMPODIAL_BROADLEAF_MODEL_ID,
        new SympodialBroadleafTreeGenerator(defaultModelOptions),
      ],
    ]);

    for (const [modelId, generator] of modelEntries(modelGenerators)) {
      this.register(modelId, generator);
    }
  }

  register(modelId, generator) {
    const normalizedId = resolveTreeGenerationModelId(
      modelId,
      'tree generation model id',
    );
    validateGenerator(normalizedId, generator);
    this.modelGenerators.set(normalizedId, generator);
    return this;
  }

  generateIr(preset, seed, options = {}) {
    const modelId = resolveTreeGenerationModelId(
      preset?.generationModel,
      `${preset?.id ?? 'tree'}.generationModel`,
    );
    const generator = this.modelGenerators.get(modelId);

    if (!generator) {
      throw new Error(`Unsupported tree generation model '${modelId}'.`);
    }

    const generatedIr = withPresetMaterialMetadata(
      generator.generate(preset, seed, options),
      preset,
    );
    validateTreeIr(generatedIr);
    if (generatedIr.generationModel !== modelId) {
      throw new Error(
        `Tree generation model '${modelId}' returned IR for '${generatedIr.generationModel}'.`,
      );
    }
    const ir = applyTreeEnvironment(
      generatedIr,
      preset?.environmentResponse,
      options.environment,
    );
    validateTreeIr(ir);
    return ir;
  }

  generate(preset, seed, options = {}) {
    return adaptTreeIrToLegacyTreeData(this.generateIr(preset, seed, options));
  }
}
