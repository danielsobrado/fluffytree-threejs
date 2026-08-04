import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownShadowProxyBuilder } from './crown-shadow-proxy-builder.js';
import { FoliageCoreBuilder } from './foliage-core-builder.js';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { FoliageShellBuilder } from './foliage-shell-builder.js';
import { FoliageTextureSetFactory } from './foliage-texture-set-factory.js';
import { LeafClusterBuilder } from './leaf-cluster-builder.js';
import { configureObjectLodFade, setObjectLodFade } from './lod-dither-fade.js';
import { TreeImpostorBuilder } from './tree-impostor-builder.js';

/**
 * Core scale for the level that carries no leaf cards.
 *
 * Levels 0 and 1 draw cards centred on the lobe surface, so the canopy they
 * render reaches about half a card beyond it. Level 2 is cores only, so its
 * cores have to stand in for that whole extent. Sharing the near-level scale
 * shrinks the silhouette at the switch, and the complementary dither crossfade
 * with the impostor then leaves holes in the difference.
 */
function coverOnlyCoreScale(treeData) {
  const shell = treeData.palette.shell;
  const canopyExtent =
    1 +
    shell.cardScaleSample *
      FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier *
      0.5;
  return canopyExtent / treeData.palette.core.scale;
}

function createLevel(name, objects) {
  const group = new THREE.Group();
  group.name = name;
  if (objects.length > 0) group.add(...objects);
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

function disposeImpostor(impostor) {
  for (const resource of impostor.material.userData.disposables ?? []) {
    resource.dispose();
  }
  impostor.material.dispose();
}

function createShadowProxy(treeData, branchMeshBuilder, crownShadowProxyBuilder) {
  const group = new THREE.Group();
  group.name = 'tree-shadow-proxy';
  group.visible = false;

  const structure = branchMeshBuilder.build(treeData, {
    maxBranchOrder: 1,
    radialSegments: 6,
    trunkCurveSamples: 8,
    branchCurveSamples: 4,
    castShadow: true,
    receiveShadow: false,
    name: 'tree-structure-shadow-proxy',
  });
  structure.material.colorWrite = false;
  structure.material.depthWrite = false;
  structure.renderOrder = -1;
  structure.userData.shadowProxy = {
    visibleSurface: false,
    triangleCount: geometryTriangles(structure),
  };

  group.add(structure, crownShadowProxyBuilder.build(treeData));
  return group;
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
      impostorRotationY = 0,
      onHeroBuilt = null,
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
              castShadow: false,
              name: 'tree-structure-lod1',
            }),
            this.foliageCoreBuilder.build(treeData, {
              ...foliageResources,
              detail: 1,
              lodIndex: 1,
              scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
              name: 'foliage-core-lod1',
            }),
            this.foliageShellBuilder.build(treeData, {
              ...foliageResources,
              density: FOLIAGE_RENDERING_CONSTANTS.mediumShellDensity,
              planesPerCluster: 1,
              scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier,
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
              castShadow: false,
              name: 'tree-structure-lod2',
            }),
            this.foliageCoreBuilder.build(treeData, {
              ...foliageResources,
              detail: 0,
              lodIndex: 2,
              scaleMultiplier: coverOnlyCoreScale(treeData),
              name: 'foliage-core-lod2',
            }),
          ]
        : [],
    );
    let impostor = this.impostorBuilder.build(treeData, {
      rotationY: impostorRotationY,
    });
    const lod3 = createLevel('tree-lod-3', [impostor]);
    const shadowProxy = createShadowProxy(
      treeData,
      this.branchMeshBuilder,
      this.shadowProxyBuilder,
    );
    const levels = [lod0, lod1, lod2, lod3];
    levels.forEach((level, index) => {
      level.userData.lod = {
        index,
        ...collectLevelMetrics(level),
      };
      setObjectLodFade(level, index === Math.max(1, minimumLod) ? 1 : 0);
    });

    const buildHero = () => {
      if (root.userData.lod?.heroReady || minimumLod > 0) return;
      const heroLeaves = this.leafClusterBuilder.build(treeData);
      lod0.add(
        this.branchMeshBuilder.build(treeData, {
          maxBranchOrder: 3,
          radialSegments: 10,
          castShadow: false,
          name: 'tree-structure',
        }),
        // The low-poly core keeps the crown opaque. Shape-aware connector
        // instances bridge only the core components that would otherwise split.
        this.foliageCoreBuilder.build(treeData, {
          ...foliageResources,
          detail: 1,
          lodIndex: 0,
          scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
          name: 'foliage-core-lod0',
        }),
        this.foliageShellBuilder.build(treeData, {
          ...foliageResources,
          density: 1,
          planesPerCluster: treeData.palette.shell.planesPerCluster,
          scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier,
          interiorDensity: FOLIAGE_RENDERING_CONSTANTS.heroInteriorDensity,
          interiorInsetRatio: 0.3,
          interiorScaleRatio: 1.08,
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
      onHeroBuilt?.(lod0);
    };

    const rebuildImpostor = (rotationY) => {
      const currentRotation = impostor.userData.impostor?.rotationY ?? 0;
      if (Math.abs(currentRotation - rotationY) <= Number.EPSILON) return;

      lod3.remove(impostor);
      disposeImpostor(impostor);
      impostor = this.impostorBuilder.build(treeData, { rotationY });
      lod3.add(impostor);
      configureObjectLodFade(lod3);
      lod3.userData.lod = { index: 3, ...collectLevelMetrics(lod3) };
      setObjectLodFade(lod3, 0);
      if (root.userData.tree) root.userData.tree.lodCosts[3] = lod3.userData.lod;
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
      currentLevel: Math.max(1, minimumLod),
      minimumLevel: minimumLod,
      heroReady: false,
      buildHero,
      rebuildImpostor,
    };
    root.add(...levels, shadowProxy);
    if (!deferHero && minimumLod === 0) buildHero();
    return root;
  }
}
