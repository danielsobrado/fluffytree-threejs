import * as THREE from 'three';
import { FOLIAGE_PRIMITIVE_FAMILIES } from '../generation/tree-ir-schema.js?v=2.0.0-20260814.2';
import { configureObjectLodFade, setObjectLodFade } from './lod-dither-fade.js?v=2.0.0-20260814.2';
import { disposeObject } from './object-disposer.js?v=2.0.0-20260814.2';
import { TreeIrCrownVolumeBuilder } from './tree-ir-crown-volume-builder.js?v=2.0.0-20260814.2';
import { TreeIrFoliageBuilder } from './tree-ir-foliage-builder.js?v=2.0.0-20260814.2';
import { shouldBuildTreeIrFoliage } from './tree-ir-foliage-lod-policy.js?v=2.0.0-20260814.2';
import { TreeIrImpostorBuilder } from './tree-ir-impostor-builder.js?v=2.0.0-20260814.2';
import {
  TREE_RENDER_REPRESENTATION_ROLES,
  TREE_REPRESENTATION_ROLES,
  treeRepresentationIndex,
} from './tree-representation-role.js?v=2.0.0-20260814.2';
import { TreeIrStructureMeshBuilder } from './tree-ir-structure-mesh-builder.js?v=2.0.0-20260814.2';

function createLevel(role) {
  const index = treeRepresentationIndex(role);
  const group = new THREE.Group();
  group.name = `tree-lod-${index}`;
  group.userData.lod = { index, role };
  return group;
}

function geometryTriangles(object) {
  if (object.isSprite) return 2;
  if (!object.geometry) return 0;
  const count =
    object.geometry.index?.count ??
    object.geometry.attributes.position?.count ??
    0;
  const triangles = count / 3;
  return triangles * (object.isInstancedMesh ? object.count : 1);
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
  for (const resource of impostor.material?.userData?.disposables ?? []) {
    resource.dispose?.();
  }
  impostor.geometry?.dispose?.();
  impostor.material?.dispose?.();
}

function isFrondOnly(treeIr) {
  return (
    treeIr.foliageSites.length > 0 &&
    treeIr.foliageSites.every(
      (site) => site.primitiveFamily === FOLIAGE_PRIMITIVE_FAMILIES.FROND,
    )
  );
}

function configureShadowOnly(root) {
  root.traverse((object) => {
    if (!object.material) return;
    object.castShadow = true;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      material.colorWrite = false;
      material.depthWrite = false;
    }
  });
  return root;
}

function crownSettings(role, config) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) {
    return {
      detail: config.heroDetail,
      scaleMultiplier: config.heroScale,
      brightness: config.heroBrightness,
      shapeVariation: config.shapeVariation,
      surfaceVariation: config.surfaceVariation,
      depthShading: config.depthShading,
    };
  }
  if (role === TREE_REPRESENTATION_ROLES.NEAR) {
    return {
      detail: config.nearDetail,
      scaleMultiplier: config.nearScale,
      brightness: config.nearBrightness,
      shapeVariation: config.shapeVariation,
      surfaceVariation: config.surfaceVariation,
      depthShading: config.depthShading,
    };
  }
  return {
    detail: config.aggregateDetail,
    scaleMultiplier: config.aggregateScale,
    brightness: config.aggregateBrightness,
    shapeVariation: config.shapeVariation,
    surfaceVariation: config.surfaceVariation,
    depthShading: config.depthShading,
  };
}

function structureSettings(role, config) {
  const settings = config[role];
  if (!settings) {
    throw new Error(`Direct Tree IR rendering has no structure settings for '${role}'.`);
  }
  return settings;
}

function createDetachedLevelObjects({
  treeIr,
  role,
  qualityProfile,
  renderingConfig,
  structureBuilder,
  crownBuilder,
  foliageBuilder,
}) {
  const representation = qualityProfile.representations[role];
  const structure = structureSettings(role, renderingConfig.structure);
  const objects = [];

  try {
    objects.push(
      structureBuilder.build(treeIr, {
        maximumStemOrder: representation.maximumStemOrder,
        ...structure,
        castShadow: false,
        receiveShadow: true,
        analyzeManifold: false,
        name: `tree-ir-structure-${role}`,
      }),
    );

    const frondOnly = isFrondOnly(treeIr);
    const useCrownVolumes = treeIr.crownVolumes.length > 0 && !frondOnly;
    if (useCrownVolumes && representation.crownVolumeDensity > 0) {
      objects.push(
        crownBuilder.build(treeIr, {
          ...crownSettings(role, renderingConfig.crown),
          castShadow: false,
          receiveShadow: true,
          name: `tree-ir-crown-${role}`,
        }),
      );
    }

    const foliageDensity = representation.foliageDensity;
    if (shouldBuildTreeIrFoliage(treeIr, role, foliageDensity)) {
      objects.push(
        foliageBuilder.build(
          treeIr,
          role,
          foliageDensity,
          renderingConfig.foliage,
        ),
      );
    }
    return objects;
  } catch (error) {
    const holder = new THREE.Group();
    holder.add(...objects);
    disposeObject(holder);
    throw error;
  }
}

function createShadowProxy(
  treeIr,
  qualityProfile,
  renderingConfig,
  structureBuilder,
  crownBuilder,
  foliageBuilder,
) {
  const group = new THREE.Group();
  group.name = 'tree-shadow-proxy';
  group.visible = false;

  try {
    const structure = structureBuilder.build(treeIr, {
      maximumStemOrder:
        qualityProfile.representations[TREE_REPRESENTATION_ROLES.NEAR]
          .maximumStemOrder,
      ...renderingConfig.shadow,
      castShadow: true,
      receiveShadow: false,
      analyzeManifold: false,
      name: 'tree-ir-structure-shadow-proxy',
    });
    configureShadowOnly(structure);
    group.add(structure);

    if (isFrondOnly(treeIr)) {
      const foliage = foliageBuilder.build(
        treeIr,
        TREE_REPRESENTATION_ROLES.AGGREGATE,
        qualityProfile.representations[TREE_REPRESENTATION_ROLES.AGGREGATE]
          .foliageDensity,
        renderingConfig.foliage,
      );
      configureShadowOnly(foliage);
      group.add(foliage);
    } else if (treeIr.crownVolumes.length > 0) {
      const crown = crownBuilder.build(treeIr, {
        detail: renderingConfig.crown.aggregateDetail,
        scaleMultiplier: renderingConfig.crown.aggregateScale,
        brightness: 1,
        shapeVariation: renderingConfig.crown.shapeVariation,
        surfaceVariation: renderingConfig.crown.surfaceVariation,
        castShadow: true,
        receiveShadow: false,
        name: 'tree-ir-crown-shadow-proxy',
      });
      configureShadowOnly(crown);
      group.add(crown);
    }
    group.userData.shadowProxy = Object.freeze({
      treeIr: true,
      drawCalls: collectLevelMetrics(group).drawCalls,
      frondShadow: isFrondOnly(treeIr),
    });
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
  group.userData.shadowProxy = Object.freeze({ skipped: true });
  return group;
}

function validateMinimumLod(minimumLod) {
  const maximum = TREE_RENDER_REPRESENTATION_ROLES.length - 1;
  if (!Number.isSafeInteger(minimumLod) || minimumLod < 0 || minimumLod > maximum) {
    throw new RangeError(
      `Tree minimumLod must be an integer within [0, ${maximum}].`,
    );
  }
}

export class TreeIrMeshBuilder {
  constructor({
    qualityProfile,
    renderingConfig,
    structureBuilder = new TreeIrStructureMeshBuilder(),
    crownBuilder = new TreeIrCrownVolumeBuilder(),
    foliageBuilder = new TreeIrFoliageBuilder(),
    impostorBuilder = new TreeIrImpostorBuilder(),
  } = {}) {
    if (!qualityProfile?.representations) {
      throw new TypeError('TreeIrMeshBuilder requires a quality profile.');
    }
    if (!renderingConfig?.structure) {
      throw new TypeError('TreeIrMeshBuilder requires direct IR rendering config.');
    }
    this.qualityProfile = qualityProfile;
    this.renderingConfig = renderingConfig;
    this.structureBuilder = structureBuilder;
    this.crownBuilder = crownBuilder;
    this.foliageBuilder = foliageBuilder;
    this.impostorBuilder = impostorBuilder;
  }

  build(
    treeIr,
    {
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
    root.name = `tree-${treeIr.presetId}`;

    try {
      const levels = TREE_RENDER_REPRESENTATION_ROLES.map(createLevel);
      root.add(...levels);
      const heroLevel = levels[heroIndex];
      const nearLevel = levels[nearIndex];
      const aggregateLevel = levels[aggregateIndex];
      const impostorLevel = levels[impostorIndex];

      if (minimumLod <= nearIndex) {
        nearLevel.add(
          ...createDetachedLevelObjects({
            treeIr,
            role: TREE_REPRESENTATION_ROLES.NEAR,
            qualityProfile: this.qualityProfile,
            renderingConfig: this.renderingConfig,
            structureBuilder: this.structureBuilder,
            crownBuilder: this.crownBuilder,
            foliageBuilder: this.foliageBuilder,
          }),
        );
      }
      configureObjectLodFade(nearLevel);

      if (minimumLod <= aggregateIndex) {
        aggregateLevel.add(
          ...createDetachedLevelObjects({
            treeIr,
            role: TREE_REPRESENTATION_ROLES.AGGREGATE,
            qualityProfile: this.qualityProfile,
            renderingConfig: this.renderingConfig,
            structureBuilder: this.structureBuilder,
            crownBuilder: this.crownBuilder,
            foliageBuilder: this.foliageBuilder,
          }),
        );
      }
      configureObjectLodFade(aggregateLevel);

      const captureLevel = (layout, rotationY) =>
        impostorRenderer.capture(aggregateLevel, layout, rotationY);
      const capture =
        impostorRenderer && aggregateLevel.children.length > 0
          ? captureLevel
          : null;
      let impostor = this.impostorBuilder.build(treeIr, {
        rotationY: impostorRotationY,
        capture,
      });
      impostorLevel.add(impostor);
      configureObjectLodFade(impostorLevel);
      configureObjectLodFade(heroLevel);

      const shadowProxy =
        minimumLod <= nearIndex
          ? createShadowProxy(
              treeIr,
              this.qualityProfile,
              this.renderingConfig,
              this.structureBuilder,
              this.crownBuilder,
              this.foliageBuilder,
            )
          : createEmptyShadowProxy();
      root.add(shadowProxy);

      const initialLevel = Math.max(nearIndex, minimumLod);
      levels.forEach((level, index) => {
        level.userData.lod = {
          ...level.userData.lod,
          ...collectLevelMetrics(level),
        };
        setObjectLodFade(level, index === initialLevel ? 1 : 0);
      });

      const buildHero = () => {
        if (root.userData.lod?.heroReady || minimumLod > heroIndex) return;
        const objects = createDetachedLevelObjects({
          treeIr,
          role: TREE_REPRESENTATION_ROLES.HERO,
          qualityProfile: this.qualityProfile,
          renderingConfig: this.renderingConfig,
          structureBuilder: this.structureBuilder,
          crownBuilder: this.crownBuilder,
          foliageBuilder: this.foliageBuilder,
        });
        try {
          heroLevel.add(...objects);
          configureObjectLodFade(heroLevel);
          heroLevel.userData.lod = {
            index: heroIndex,
            role: TREE_REPRESENTATION_ROLES.HERO,
            ...collectLevelMetrics(heroLevel),
          };
          setObjectLodFade(heroLevel, 0);
          root.userData.lod.heroReady = true;
          root.userData.tree.lodCosts[heroIndex] = heroLevel.userData.lod;
        } catch (error) {
          for (const object of objects) heroLevel.remove(object);
          const holder = new THREE.Group();
          holder.add(...objects);
          disposeObject(holder);
          throw error;
        }
        onHeroBuilt?.(heroLevel);
      };

      const rebuildImpostor = (rotationY) => {
        const currentRotation = impostor.userData.impostor?.rotationY ?? 0;
        if (Math.abs(currentRotation - rotationY) <= 1e-3) return;
        const previous = impostor;
        const next = this.impostorBuilder.build(treeIr, {
          rotationY,
          capture,
        });
        try {
          configureObjectLodFade(next);
          impostorLevel.add(next);
          impostorLevel.remove(previous);
          const metrics = {
            index: impostorIndex,
            role: TREE_REPRESENTATION_ROLES.IMPOSTOR,
            ...collectLevelMetrics(impostorLevel),
          };
          impostorLevel.userData.lod = metrics;
          root.userData.tree.lodCosts[impostorIndex] = metrics;
          impostor = next;
          disposeImpostor(previous);
        } catch (error) {
          impostorLevel.remove(next);
          if (!previous.parent) impostorLevel.add(previous);
          disposeImpostor(next);
          throw error;
        }
      };

      root.userData.tree = {
        presetId: treeIr.presetId,
        generationModel: treeIr.generationModel,
        seed: treeIr.seed,
        height: treeIr.height,
        controlLobeCount: treeIr.crownVolumes.length,
        branchCount: Math.max(0, treeIr.stems.length - 1),
        leafClusterCount: treeIr.foliageSites.length,
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
