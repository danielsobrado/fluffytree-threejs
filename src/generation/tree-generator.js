import { CrownLobeTreeGenerator } from './crown-lobe-tree-generator.js';
import {
  DEFAULT_TREE_GENERATION_MODEL,
  resolveTreeGenerationModelId,
} from './tree-generation-model.js';
import { adaptTreeIrToLegacyTreeData } from './tree-ir-legacy-adapter.js';
import { validateTreeIr } from './tree-ir-validator.js';
import { PALM_TREE_MODEL_ID } from './palm-tree-constants.js';
import { PalmTreeGenerator } from './palm-tree-generator.js';
import { WHORLED_CONIFER_MODEL_ID } from './whorled-conifer-constants.js';
import { WhorledConiferTreeGenerator } from './whorled-conifer-tree-generator.js';

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

export class TreeGenerator {
  constructor({ modelGenerators = null, ...defaultModelOptions } = {}) {
    this.modelGenerators = new Map([
      [DEFAULT_TREE_GENERATION_MODEL, new CrownLobeTreeGenerator(defaultModelOptions)],
      [
        WHORLED_CONIFER_MODEL_ID,
        new WhorledConiferTreeGenerator(defaultModelOptions),
      ],
      [PALM_TREE_MODEL_ID, new PalmTreeGenerator(defaultModelOptions)],
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

    const ir = generator.generate(preset, seed, options);
    validateTreeIr(ir);
    if (ir.generationModel !== modelId) {
      throw new Error(
        `Tree generation model '${modelId}' returned IR for '${ir.generationModel}'.`,
      );
    }
    return ir;
  }

  generate(preset, seed, options = {}) {
    return adaptTreeIrToLegacyTreeData(this.generateIr(preset, seed, options));
  }
}
