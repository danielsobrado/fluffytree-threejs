import * as THREE from 'three';
import { FOLIAGE_PRIMITIVE_FAMILIES } from '../generation/tree-ir-schema.js';
import { TREE_REPRESENTATION_ROLES } from './tree-representation-role.js';
import { TreeIrFoliageCardBuilder } from './tree-ir-foliage-card-builder.js';
import { TreeIrFrondBuilder } from './tree-ir-frond-builder.js';
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
      scaleMultiplier: config.heroScale,
    };
  }
  return {
    planeCount: config.nearCardPlanes,
    scaleMultiplier: config.nearScale,
  };
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
    const selected = selectTreeIrFoliageSites(
      treeIr,
      treeIr.foliageSites,
      role,
      density,
    );
    const familyGroups = groupByFamily(selected);

    for (const [family, sites] of familyGroups) {
      if (family === FOLIAGE_PRIMITIVE_FAMILIES.NONE || sites.length === 0) {
        continue;
      }
      if (family === FOLIAGE_PRIMITIVE_FAMILIES.FROND) {
        group.add(
          this.frondBuilder.build(treeIr, sites, {
            segmentRatio:
              role === TREE_REPRESENTATION_ROLES.HERO
                ? 1
                : config.frondNearSegmentRatio,
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
          alphaResolution: config.alphaResolution,
          alphaTest: config.alphaTest,
          scaleMultiplier: settings.scaleMultiplier,
          name: `tree-ir-${family}-${role}`,
        }),
      );
    }

    group.userData.foliage = Object.freeze({
      role,
      sourceSiteCount: treeIr.foliageSites.length,
      selectedSiteCount: selected.length,
      batchCount: group.children.length,
    });
    return group;
  }
}
