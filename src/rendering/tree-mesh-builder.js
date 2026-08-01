import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownShadowProxyBuilder } from './crown-shadow-proxy-builder.js';
import { FoliageCoreBuilder } from './foliage-core-builder.js';
import { FoliageShellBuilder } from './foliage-shell-builder.js';
import { FoliageTextureSetFactory } from './foliage-texture-set-factory.js';
import { LeafClusterBuilder } from './leaf-cluster-builder.js';
import { configureObjectLodFade, setObjectLodFade } from './lod-dither-fade.js';
import { TreeImpostorBuilder } from './tree-impostor-builder.js';

function createLevel(name, objects) {
  const group = new THREE.Group();
  group.name = name;
  group.add(...objects);
  configureObjectLodFade(group);
  return group;
}

function geometryTriangles(object) {
  if (object.isSprite) return 2;
  if (!object.geometry) return 0;
  const triangleCount =
    (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) /
    3;
  return triangleCount * (object.isInstancedMesh ? object.count : 1);
}

function collectLevelMetrics(root) {
  const metrics = { triangles: 0, drawCalls: 0 };
  root.traverse((object) => {
    if (!object.material) return;
    metrics.drawCalls += 1;
    metrics.triangles += geometryTriangles(object);
  });
  return Object.freeze(metrics);
}

export class TreeMeshBuilder {
  constructor({
    branchMeshBuilder = new BranchMeshBuilder(),
    foliageCoreBuilder = new FoliageCoreBuilder(),
    foliageShellBuilder = new FoliageShellBuilder(),
    leafClusterBuilder = new LeafClusterBuilder(),
    textureSetFactory = new FoliageTextureSetFactory(),
    shadowProxyBuilder = new CrownShadowProxyBuilder(),
    impostorBuilder = new TreeImpostorBuilder(),
  } = {}) {
    this.branchMeshBuilder = branchMeshBuilder;
    this.foliageCoreBuilder = foliageCoreBuilder;
    this.foliageShellBuilder = foliageShellBuilder;
    this.leafClusterBuilder = leafClusterBuilder;
    this.textureSetFactory = textureSetFactory;
    this.shadowProxyBuilder = shadowProxyBuilder;
    this.impostorBuilder = impostorBuilder;
  }

  build(
    treeData,
    {
      sunDirection = new THREE.Vector3(1, 1, 1),
      deferHero = false,
      minimumLod = 0,
    } = {},
  ) {
    const root = new THREE.Group();
    root.name = `tree-${treeData.presetId}`;
    const textures = this.textureSetFactory.create(treeData.palette);
    const foliageResources = {
      paletteTexture: textures.palette,
      alphaTexture: textures.alpha,
      sunDirection,
    };

    const lod0 = createLevel('tree-lod-0', []);
    const lod1 = createLevel(
      'tree-lod-1',
      minimumLod <= 1
        ? [
            this.branchMeshBuilder.build(treeData, {
              maxBranchOrder: 2,
              radialSegments: 8,
              trunkCurveSamples: 14,
              branchCurveSamples: 7,
              name: 'tree-structure-lod1',
            }),
            this.foliageCoreBuilder.build(treeData, {
              ...foliageResources,
              detail: 1,
              scaleMultiplier: 1.02,
              name: 'foliage-core-lod1',
            }),
            this.foliageShellBuilder.build(treeData, {
              ...foliageResources,
              density: 0.7,
              planesPerCluster: 1,
              scaleMultiplier: 1.96,
              name: 'foliage-shell-lod1',
            }),
          ]
        : [],
    );
    const lod2 = createLevel(
      'tree-lod-2',
      minimumLod <= 2
        ? [
            this.branchMeshBuilder.build(treeData, {
              maxBranchOrder: 1,
              radialSegments: 6,
              trunkCurveSamples: 8,
              branchCurveSamples: 4,
              name: 'tree-structure-lod2',
            }),
            this.foliageCoreBuilder.build(treeData, {
              ...foliageResources,
              detail: 0,
              scaleMultiplier: 1.08,
              name: 'foliage-core-lod2',
            }),
          ]
        : [],
    );
    const lod3 = createLevel('tree-lod-3', [this.impostorBuilder.build(treeData)]);
    const shadowProxy = this.shadowProxyBuilder.build(treeData);
    const levels = [lod0, lod1, lod2, lod3];
    levels.forEach((level, index) => {
      level.userData.lod = {
        index,
        ...collectLevelMetrics(level),
      };
      setObjectLodFade(level, index === 1 ? 1 : 0);
    });

    const buildHero = () => {
      if (root.userData.lod?.heroReady || minimumLod > 0) return;
      const heroLeaves = this.leafClusterBuilder.build(treeData);
      lod0.add(
        this.branchMeshBuilder.build(treeData, {
          maxBranchOrder: 3,
          radialSegments: 10,
          name: 'tree-structure',
        }),
        this.foliageCoreBuilder.build(treeData, {
          ...foliageResources,
          detail: 2,
          name: 'foliage-core-lod0',
        }),
        this.foliageShellBuilder.build(treeData, {
          ...foliageResources,
          density: 1,
          planesPerCluster: 2,
          scaleMultiplier: 1.86,
          name: 'foliage-shell-lod0',
        }),
        heroLeaves,
      );
      configureObjectLodFade(lod0);
      lod0.userData.lod = { index: 0, ...collectLevelMetrics(lod0) };
      setObjectLodFade(lod0, 0);
      root.userData.lod.heroReady = true;
      root.userData.tree.leafClusterCount =
        heroLeaves.userData.heroLeaves?.clusterCount ?? 0;
      root.userData.tree.leafCount = heroLeaves.userData.heroLeaves?.leafCount ?? 0;
      root.userData.tree.lodCosts[0] = lod0.userData.lod;
    };

    root.userData.tree = {
      presetId: treeData.presetId,
      seed: treeData.seed,
      height: treeData.height,
      controlLobeCount: treeData.lobes.length,
      branchCount: treeData.branches.length,
      leafClusterCount: 0,
      leafCount: 0,
      lodCosts: levels.map((level) => level.userData.lod),
    };
    root.userData.lod = {
      levels,
      shadowProxy,
      currentLevel: 1,
      heroReady: minimumLod > 0,
      buildHero,
    };
    root.add(...levels, shadowProxy);
    if (!deferHero && minimumLod === 0) buildHero();
    return root;
  }
}
