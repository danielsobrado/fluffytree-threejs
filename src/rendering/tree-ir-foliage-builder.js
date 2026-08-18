import * as THREE from 'three';
import { FOLIAGE_PRIMITIVE_FAMILIES } from '../generation/tree-ir-schema.js';
import { TREE_REPRESENTATION_ROLES } from './tree-representation-role.js';
import { TreeIrFoliageCardBuilder } from './tree-ir-foliage-card-builder.js';
import { resolveTreeIrFamilyFoliageDensity } from './tree-ir-foliage-lod-policy.js';
import { TreeIrFrondBuilder } from './tree-ir-frond-builder.js';
import { selectTreeIrFrondSites } from './tree-ir-frond-selector.js';
import { selectTreeIrFoliageSites } from './tree-ir-foliage-selector.js';

function groupByFamily(sites) {
  const groups = new Map();
  for (const site of sites) {
    const familySites = groups.get(site.primitiveFamily) ?? [];
    familySites.push(site);
    groups.set(site.primitiveFamily, familySites);
  }
  return groups;
}

function cardSettings(role, config) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) {
    return {
      planeCount: config.heroCardPlanes,
      depthSpread: config.heroCardDepthSpread,
      scaleMultiplier: config.heroScale,
      alphaTest: config.alphaTest,
    };
  }
  return {
    planeCount: config.nearCardPlanes,
    depthSpread: config.nearCardDepthSpread,
    scaleMultiplier: config.nearScale,
    alphaTest: config.nearAlphaTest,
  };
}

function frondSegmentRatio(role, config) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) return 1;
  if (role === TREE_REPRESENTATION_ROLES.AGGREGATE) {
    return config.frondAggregateSegmentRatio;
  }
  return config.frondNearSegmentRatio;
}

function useFrondLeaflets(role, config) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) {
    return config.frondHeroLeaflets;
  }
  if (role === TREE_REPRESENTATION_ROLES.NEAR) {
    return config.frondNearLeaflets;
  }
  if (role === TREE_REPRESENTATION_ROLES.AGGREGATE) {
    return config.frondAggregateLeaflets;
  }
  return false;
}

function selectFamilySites(treeIr, sites, family, role, density) {
  return family === FOLIAGE_PRIMITIVE_FAMILIES.FROND
    ? selectTreeIrFrondSites(treeIr, sites, density)
    : selectTreeIrFoliageSites(treeIr, sites, role, density);
}

export class TreeIrFoliageBuilder {
  constructor({
    cardBuilder = new TreeIrFoliageCardBuilder(),
    frondBuilder = new TreeIrFrondBuilder(),
  } = {}) {
    this.cardBuilder = cardBuilder;
    this.frondBuilder = frondBuilder;
  }

  build(treeIr, role, density, config) {
    const group = new THREE.Group();
    group.name = `tree-ir-foliage-${role}`;
    const familyGroups = groupByFamily(treeIr.foliageSites);
    let selectedSiteCount = 0;

    for (const [family, sourceSites] of familyGroups) {
      if (family === FOLIAGE_PRIMITIVE_FAMILIES.NONE) continue;
      const familyDensity = resolveTreeIrFamilyFoliageDensity(
        family,
        role,
        density,
        config,
      );
      const sites = selectFamilySites(
        treeIr,
        sourceSites,
        family,
        role,
        familyDensity,
      );
      selectedSiteCount += sites.length;
      if (sites.length === 0) continue;

      if (family === FOLIAGE_PRIMITIVE_FAMILIES.FROND) {
        group.add(
          this.frondBuilder.build(treeIr, sites, {
            segmentRatio: frondSegmentRatio(role, config),
            leaflets: useFrondLeaflets(role, config),
            rachisWidthRatio: config.frondRachisWidthRatio,
            leafletLengthRatio: config.frondLeafletLengthRatio,
            leafletWidthRatio: config.frondLeafletWidthRatio,
            name: `tree-ir-fronds-${role}`,
          }),
        );
        continue;
      }

      const settings = cardSettings(role, config);
      group.add(
        this.cardBuilder.build(treeIr, sites, {
          primitiveFamily: family,
          planeCount: settings.planeCount,
          depthSpread: settings.depthSpread,
          alphaResolution: config.alphaResolution,
          alphaTest: settings.alphaTest,
          scaleMultiplier: settings.scaleMultiplier,
          cardScaleVariation: config.cardScaleVariation,
          cardStretch: config.cardStretch,
          cardTwist: config.cardTwist,
          cardLean: config.cardLean,
          surfaceMottle: config.surfaceMottle,
          surfaceEdgeDarkening: config.surfaceEdgeDarkening,
          surfaceVerticalTint: config.surfaceVerticalTint,
          name: `tree-ir-${family}-${role}`,
        }),
      );
    }

    group.userData.foliage = Object.freeze({
      role,
      sourceSiteCount: treeIr.foliageSites.length,
      selectedSiteCount,
      batchCount: group.children.length,
    });
    return group;
  }
}
