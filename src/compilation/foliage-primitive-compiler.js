import { validateTreeIr } from '../generation/tree-ir-validator.js?v=2.0.0-20260814.2';
import { resolveFoliageBackendRolePolicy } from './foliage-primitive-backends.js?v=2.0.0-20260814.2';

function groupSitesByFamily(sites) {
  const groups = new Map();
  for (const site of sites) {
    const entries = groups.get(site.primitiveFamily) ?? [];
    entries.push(site);
    groups.set(site.primitiveFamily, entries);
  }
  return groups;
}

function freezePlan(policy, sites, density) {
  return Object.freeze({
    ...policy,
    requestedDensity: density,
    sourceSiteCount: sites.length,
    sourceSiteIds: Object.freeze(sites.map((site) => site.id)),
    totalImportance: sites.reduce((sum, site) => sum + site.importance, 0),
  });
}

export class FoliagePrimitiveCompiler {
  compile(treeIr, role, { density = 1 } = {}) {
    validateTreeIr(treeIr);
    if (!Number.isFinite(density) || density < 0 || density > 1) {
      throw new RangeError('Foliage compilation density must be within [0, 1].');
    }

    const groups = groupSitesByFamily(treeIr.foliageSites);
    const plans = [];
    for (const [family, sites] of groups) {
      plans.push(
        freezePlan(
          resolveFoliageBackendRolePolicy(family, role),
          sites,
          density,
        ),
      );
    }

    return Object.freeze(plans);
  }
}
