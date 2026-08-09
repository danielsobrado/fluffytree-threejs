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

function createLevel(name) {
  const group = new THREE.Group();
  group.name = name;
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
    const root = new THREE.Group();
    root.name = `tree-${treeData.presetId}`;
    const textures = this.textureSetFactory.create(treeData.palette, {
      palette: minimumLod <= 2,
      alpha: minimumLod <= 1,
    });
    const sharedFoliageResources = [textures.palette, textures.alpha].filter(Boolean);
    root.userData.disposables = sharedFoliageResources;
    const foliageResources = {
      paletteTexture: textures.palette,
      alphaTexture: textures.alpha,
      sunDirection,
    };

    try {
      const lod0 = createLevel('tree-lod-0');
      const lod1 = createLevel('tree-lod-1');
      const lod2 = createLevel('tree-lod-2');
      const lod3 = createLevel('tree-lod-3');
      root.add(lod0, lod1, lod2, lod3);

      populateLevel(
        lod1,
        minimumLod <= 1
          ? [
              () =>
                this.branchMeshBuilder.build(treeData, {
                  maxBranchOrder: 2,
                  radialSegments: 8,
                  trunkCurveSamples: 14,
                  branchCurveSamples: 7,
                  castShadow: false,
                  name: 'tree-structure-lod1',
                }),
              () =>
                this.foliageCoreBuilder.build(treeData, {
                  ...foliageResources,
                  detail: 1,
                  lodIndex: 1,
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
        lod2,
        minimumLod <= 2
          ? [
              () =>
                this.branchMeshBuilder.build(treeData, {
                  maxBranchOrder: 1,
                  radialSegments: 6,
                  trunkCurveSamples: 8,
                  branchCurveSamples: 4,
                  castShadow: false,
                  name: 'tree-structure-lod2',
                }),
              () =>
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

      // Level 2 is the level the impostor crossfades with, so capturing that is
      // what makes the two silhouettes agree.
      const captureLevel = (layout, rotationY) =>
        impostorRenderer.capture(lod2, layout, rotationY);
      const capture =
        impostorRenderer && lod2.children.length > 0 ? captureLevel : null;
      let impostor = this.impostorBuilder.build(treeData, {
        rotationY: impostorRotationY,
        capture,
      });
      lod3.add(impostor);
      configureObjectLodFade(lod3);

      const shadowProxy = createShadowProxy(
        treeData,
        this.branchMeshBuilder,
        this.shadowProxyBuilder,
      );
      root.add(shadowProxy);
      configureObjectLodFade(lod0);

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

        const heroObjects = buildDetachedObjects(
          [
            () =>
              this.branchMeshBuilder.build(treeData, {
                maxBranchOrder: 3,
                radialSegments: 10,
                castShadow: false,
                name: 'tree-structure',
              }),
            () =>
              this.foliageCoreBuilder.build(treeData, {
                ...foliageResources,
                detail: 1,
                lodIndex: 0,
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
            () => this.leafClusterBuilder.build(treeData),
          ],
          sharedFoliageResources,
        );
        const heroLeaves = heroObjects.at(-1);

        try {
          lod0.add(...heroObjects);
          configureObjectLodFade(lod0);
          lod0.userData.lod = { index: 0, ...collectLevelMetrics(lod0) };
          setObjectLodFade(lod0, 0);
          root.userData.lod.heroReady = true;
          root.userData.tree.leafClusterCount =
            heroLeaves.userData.heroLeaves?.clusterCount ?? 0;
          root.userData.tree.leafCount = heroLeaves.userData.heroLeaves?.leafCount ?? 0;
          root.userData.tree.lodCosts[0] = lod0.userData.lod;
        } catch (error) {
          root.userData.lod.heroReady = false;
          for (const object of heroObjects) lod0.remove(object);
          disposeDetachedObjects(heroObjects, sharedFoliageResources);
          throw error;
        }

        onHeroBuilt?.(lod0);
      };

      const rebuildImpostor = (rotationY) => {
        const currentRotation = impostor.userData.impostor?.rotationY ?? 0;
        if (Math.abs(currentRotation - rotationY) <= Number.EPSILON) return;

        const nextImpostor = this.impostorBuilder.build(treeData, {
          rotationY,
          capture,
        });

        try {
          lod3.add(nextImpostor);
          configureObjectLodFade(lod3);
          const nextMetrics = { index: 3, ...collectLevelMetrics(lod3) };
          setObjectLodFade(lod3, 0);
          lod3.remove(impostor);
          disposeImpostor(impostor);
          impostor = nextImpostor;
          lod3.userData.lod = nextMetrics;
          if (root.userData.tree) {
            root.userData.tree.lodCosts[3] = lod3.userData.lod;
          }
        } catch (error) {
          lod3.remove(nextImpostor);
          disposeImpostor(nextImpostor);
          throw error;
        }
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
      root.add(shadowProxy);
      if (!deferHero && minimumLod === 0) buildHero();
      return root;
    } catch (error) {
      disposeObject(root);
      throw error;
    }
  }
}
