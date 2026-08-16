import { adaptTreeIrToLegacyTreeData } from '../generation/tree-ir-legacy-adapter.js';
import { TREE_IR_SCHEMA_VERSION } from '../generation/tree-ir-schema.js';
import { TreeMeshBuilder } from './tree-mesh-builder.js';

function isTreeIr(value) {
  return value?.schemaVersion === TREE_IR_SCHEMA_VERSION;
}

function isLegacyCompatibleTreeIr(treeIr) {
  return Boolean(treeIr?.metadata?.legacy);
}

export class UniversalTreeMeshBuilder {
  constructor({
    legacyBuilder = new TreeMeshBuilder(),
    directBuilder = null,
  } = {}) {
    if (!legacyBuilder || typeof legacyBuilder.build !== 'function') {
      throw new TypeError('UniversalTreeMeshBuilder requires a legacy builder.');
    }
    if (directBuilder !== null && typeof directBuilder?.build !== 'function') {
      throw new TypeError('UniversalTreeMeshBuilder directBuilder must provide build().');
    }
    this.legacyBuilder = legacyBuilder;
    this.directBuilder = directBuilder;
    this.acceptsTreeIr = true;
  }

  build(tree, options = {}) {
    if (!isTreeIr(tree)) return this.legacyBuilder.build(tree, options);
    if (isLegacyCompatibleTreeIr(tree)) {
      return this.legacyBuilder.build(adaptTreeIrToLegacyTreeData(tree), options);
    }
    if (!this.directBuilder) {
      throw new Error(
        `Tree IR generation model '${tree.generationModel}' requires a direct Tree IR mesh builder.`,
      );
    }
    return this.directBuilder.build(tree, options);
  }
}
