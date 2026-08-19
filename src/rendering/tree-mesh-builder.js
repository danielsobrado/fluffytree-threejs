import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownShadowProxyBuilder } from './crown-shadow-proxy-builder.js';
import { FoliageCoreBuilder } from './foliage-core-builder.js';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { FoliageShellBuilder } from './foliage-shell-builder.js';
import { FoliageTextureSetFactory } from './foliage-texture-set-factory.js';
import { LeafClusterBuilder } from './leaf-cluster-builder.js';
import { configureObjectLodFade, setObjectLodFade } from './lod-dither-fade.js';
import { disposeObject } from './object-disposer.js';
import { TreeImpostorBuilder } from './tree-impostor-builder.js';
import {
  TREE_RENDER_REPRESENTATION_ROLES,
  TREE_REPRESENTATION_ROLES,
  treeRepresentationIndex,
} from './tree-representation-role.js';

function coverOnlyCoreScale(treeData) {
  const shell = treeData.palette.shell;
  const canopyExtent =
    1 +
    shell.cardScaleSample *
      FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier *
      0.5;
  return canopyExtent / treeData.palette.core.scale;
}

function createLevel(name, role) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.lod = { role };
  return group;
}

function populateLevel(level, factories = []) {
  for (const factory of factories) level.add(factory());
  configureObjectLodFade(level);
  return level;
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

function disposeDetachedObjects(objects, preserveResources = []) {
  if (objects.length === 0) return;
  const holder = new THREE.Group();
  holder.add(...objects);
  disposeObject(holder, { preserveResources });
}

function buildDetachedObjects(factories, preserveResources = []) {
  const objects = [];

  try {
    for (const factory of factories) objects.push(factory());
    return objects;
  } catch (error) {
    disposeDetachedObjects(objects, preserveResources);
    throw error;
  }
}

function createShadowProxy(treeData, branchMeshBuilder, crownShadowProxyBuilder) {
  const group = new THREE.Group();
  group.name = 'tree-shadow-proxy';
  group.visible = false;

  try {
    const structure = branchMeshBuilder.build(treeData, {
      maxBranchOrder: 1,
      radialSegments: 6,
      trunkCurveSamples: 8,
      branchCurveSamples: 4,
      castShadow: true,
      receiveShadow: false,
      analyzeManifold: false,
      name: 'tree-structure-shadow-proxy',
    });
    structure.material.colorWrite = false;
    structure.material.depthWrite = false;
    structure.renderOrder = -1;
    structure.userData.shadowProxy = {
      visibleSurface: false,
      triangleCount: geometryTriangles(structure),
    };
    group.add(structure);
    group.add(crownShadowProxyBuilder.build(treeData));
    return group;
  } catch (error) {
    disposeObject(group);
    throw error;
  }
}

function createEmptyShadowProxy() {
  const group = new THREE.Group();
  group.name = 'tree-shadow-proxy';
  group.visible = false;
  group.userData.shadowProxy = { skipped: true };
  return group;
}

function validateMinimumLod(minimumLod) {
  const maximum = TREE_RENDER_REPRESENTATION_ROLES.length - 1;
  if (
    !Number.isSafeInteger(minimumLod) ||
    minimumLod < 0 ||
    minimumLod > maximum
  ) {
    throw new RangeError(
      `Tree minimumLod must be an integer within [0, ${maximum}].`,
    );
  }
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
      impostorRenderer = null,
    } = {},
  ) {
    validateMinimumLod(minimumLod);
    const heroIndex = treeRepresentationIndex(TREE_REPRESENTATION_ROLES.HERO);
    const nearIndex = treeRepresentationIndex(TREE_REPRESENTATION_ROLES.NEAR);
    const aggregateIndex = treeRepresentationIndex(
      TREE_REPRESENTATION_ROLES.AGGREGATE,
    );
    const impostorIndex = treeRepresentationIndex(
      TREE_REPRESENTATION_ROLES.IMPOSTOR,
    );
    const root = new THREE.Group();
    root.name = `tree-${treeData.presetId}`;
    const textures = this.textureSetFactory.create(treeData.palette, {
      palette: minimumLod <= aggregateIndex,
      alpha: minimumLod <= nearIndex,
    });
    const sharedFoliageResources = [textures.palette, textures.alpha].filter(Boolean);
    root.userData.disposables = sharedFoliageResources;
    const foliageResources = {
      paletteTexture: textures.palette,
      alphaTexture: textures.alpha,
      sunDirection,
    };

    try {
      const heroLevel = createLevel(
        'tree-lod-0',
        TREE_REPRESENTATION_ROLES.HERO,
      );
      const nearLevel = createLevel(
        'tree-lod-1',
        TREE_REPRESENTATION_ROLES.NEAR,
      );
      const aggregateLevel = createLevel(
        'tree-lod-2',
        TREE_REPRESENTATION_ROLES.AGGREGATE,
      );
      const impostorLevel = createLevel(
        'tree-lod-3',
        TREE_REPRESENTATION_ROLES.IMPOSTOR,
      );
      root.add(heroLevel, nearLevel, aggregateLevel, impostorLevel);

      populateLevel(
        nearLevel,
        minimumLod <= nearIndex
          ? [
              () =>
                this.branchMeshBuilder.build(treeData, {
                  maxBranchOrder: 2,
                  radialSegments: 8,
                  trunkCurveSamples: 14,
                  branchCurveSamples: 7,
                  castShadow: false,
                  analyzeManifold: false,
                  name: 'tree-structure-lod1',
                }),
              () =>
                this.foliageCoreBuilder.build(treeData, {
                  ...foliageResources,
                  detail: 1,
                  lodIndex: nearIndex,
                  scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
                  name: 'foliage-core-lod1',
                }),
              () =>
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
      populateLevel(
        aggregateLevel,
        minimumLod <= aggregateIndex
          ? [
              () =>
                this.branchMeshBuilder.build(treeData, {
                  maxBranchOrder: 1,
                  radialSegments: 6,
                  trunkCurveSamples: 8,
                  branchCurveSamples: 4,
                  castShadow: false,
                  analyzeManifold: false,
                  name: 'tree-structure-lod2',
                }),
              () =>
                this.foliageCoreBuilder.build(treeData, {
                  ...foliageResources,
                  detail: 0,
                  lodIndex: aggregateIndex,
                  scaleMultiplier: coverOnlyCoreScale(treeData),
                  name: 'foliage-core-lod2',
                }),
            ]
          : [],
      );

      const captureLevel = (layout, rotationY) =>
        impostorRenderer.capture(aggregateLevel, layout, rotationY);
      const capture =
        impostorRenderer && aggregateLevel.children.length > 0
          ? captureLevel
          : null;
      let impostor = this.impostorBuilder.build(treeData, {
        rotationY: impostorRotationY,
        capture,
      });
      impostorLevel.add(impostor);
      configureObjectLodFade(impostorLevel);

      const shadowProxy =
        minimumLod <= nearIndex
          ? createShadowProxy(
              treeData,
              this.branchMeshBuilder,
              this.shadowProxyBuilder,
            )
          : createEmptyShadowProxy();
      root.add(shadowProxy);
      configureObjectLodFade(heroLevel);

      const levels = [heroLevel, nearLevel, aggregateLevel, impostorLevel];
      const initialLevel = Math.max(nearIndex, minimumLod);
      levels.forEach((level, index) => {
        level.userData.lod = {
          ...level.userData.lod,
          index,
          ...collectLevelMetrics(level),
        };
        setObjectLodFade(level, index === initialLevel ? 1 : 0);
      });

      const buildHero = () => {
        if (root.userData.lod?.heroReady || minimumLod > heroIndex) return;

        const heroObjects = buildDetachedObjects(
          [
            () =>
              this.branchMeshBuilder.build(treeData, {
                maxBranchOrder: 3,
                radialSegments: 10,
                castShadow: false,
                analyzeManifold: false,
                name: 'tree-structure',
              }),
            () =>
              this.foliageCoreBuilder.build(treeData, {
                ...foliageResources,
                detail: 1,
                lodIndex: heroIndex,
                scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
                name: 'foliage-core-lod0',
              }),
            () =>
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
            () => this.leafClusterBuilder.build(treeData, foliageResources),
          ],
          sharedFoliageResources,
        );
        const heroLeaves = heroObjects.at(-1);

        try {
          heroLevel.add(...heroObjects);
          configureObjectLodFade(heroLevel);
          heroLevel.userData.lod = {
            role: TREE_REPRESENTATION_ROLES.HERO,
            index: heroIndex,
            ...collectLevelMetrics(heroLevel),
          };
          setObjectLodFade(heroLevel, 0);
          root.userData.lod.heroReady = true;
          root.userData.tree.leafClusterCount =
            heroLeaves.userData.heroLeaves?.clusterCount ?? 0;
          root.userData.tree.leafCount = heroLeaves.userData.heroLeaves?.leafCount ?? 0;
          root.userData.tree.lodCosts[heroIndex] = heroLevel.userData.lod;
        } catch (error) {
          root.userData.lod.heroReady = false;
          for (const object of heroObjects) heroLevel.remove(object);
          disposeDetachedObjects(heroObjects, sharedFoliageResources);
          throw error;
        }

        onHeroBuilt?.(heroLevel);
      };

      const rebuildImpostor = (rotationY) => {
        const currentRotation = impostor.userData.impostor?.rotationY ?? 0;
        if (Math.abs(currentRotation - rotationY) <= Number.EPSILON) return;

        const previousImpostor = impostor;
        const nextImpostor = this.impostorBuilder.build(treeData, {
          rotationY,
          capture,
        });

        try {
          configureObjectLodFade(nextImpostor);
          impostorLevel.add(nextImpostor);
          impostorLevel.remove(previousImpostor);
          const nextMetrics = {
            role: TREE_REPRESENTATION_ROLES.IMPOSTOR,
            index: impostorIndex,
            ...collectLevelMetrics(impostorLevel),
          };
          impostorLevel.userData.lod = nextMetrics;
          if (root.userData.tree) {
            root.userData.tree.lodCosts[impostorIndex] = nextMetrics;
          }
          impostor = nextImpostor;
          disposeImpostor(previousImpostor);
        } catch (error) {
          impostorLevel.remove(nextImpostor);
          if (!previousImpostor.parent) impostorLevel.add(previousImpostor);
          disposeImpostor(nextImpostor);
          throw error;
        }
      };

      root.userData.tree = {
        presetId: treeData.presetId,
        generationModel: treeData.generationModel,
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
        currentLevel: initialLevel,
        currentRole: levels[initialLevel].userData.lod.role,
        minimumLevel: minimumLod,
        heroReady: false,
        buildHero,
        rebuildImpostor,
      };
      if (!deferHero && minimumLod <= heroIndex) buildHero();
      return root;
    } catch (error) {
      disposeObject(root);
      throw error;
    }
  }
}
