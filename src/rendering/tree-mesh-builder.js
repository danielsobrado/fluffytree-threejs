import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownShadowProxyBuilder } from './crown-shadow-proxy-builder.js';
import { FoliageCoreBuilder } from './foliage-core-builder.js';
import { FoliageShellBuilder } from './foliage-shell-builder.js';
import { FoliageTextureSetFactory } from './foliage-texture-set-factory.js';

export class TreeMeshBuilder {
  constructor({
    branchMeshBuilder = new BranchMeshBuilder(),
    foliageCoreBuilder = new FoliageCoreBuilder(),
    foliageShellBuilder = new FoliageShellBuilder(),
    shadowProxyBuilder = new CrownShadowProxyBuilder(),
    textureSetFactory = new FoliageTextureSetFactory(),
  } = {}) {
    this.branchMeshBuilder = branchMeshBuilder;
    this.foliageCoreBuilder = foliageCoreBuilder;
    this.foliageShellBuilder = foliageShellBuilder;
    this.shadowProxyBuilder = shadowProxyBuilder;
    this.textureSetFactory = textureSetFactory;
  }

  build(treeData, { sunDirection }) {
    if (!(sunDirection instanceof THREE.Vector3)) {
      throw new Error('TreeMeshBuilder requires a Three.js sun direction vector.');
    }

    const group = new THREE.Group();
    group.name = `tree-${treeData.presetId}`;
    group.userData.tree = {
      presetId: treeData.presetId,
      seed: treeData.seed,
      height: treeData.height,
      lobeCount: treeData.lobes.length,
      shellInstanceCount: treeData.shell.length,
      leafCardCount:
        treeData.shell.length * treeData.palette.shell.planesPerCluster,
    };

    const textures = this.textureSetFactory.create(treeData.palette);
    const structure = this.branchMeshBuilder.build(treeData);
    const shadowProxy = this.shadowProxyBuilder.build(treeData);
    const foliageCore = this.foliageCoreBuilder.build(treeData, {
      paletteTexture: textures.palette,
      sunDirection,
    });
    const foliageShell = this.foliageShellBuilder.build(treeData, {
      paletteTexture: textures.palette,
      alphaTexture: textures.alpha,
      sunDirection,
    });

    group.add(structure, shadowProxy, foliageCore, foliageShell);
    return group;
  }
}
