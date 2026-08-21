import { validateTreeIr } from '../generation/tree-ir-validator.js?v=2.0.0-20260814.2';

function requireRolePolicy(policy, role) {
  const rolePolicy = policy?.roles?.[role];
  if (!rolePolicy) {
    throw new Error(`Tree animation policy is missing role '${role}'.`);
  }
  return rolePolicy;
}

export class TreeAnimationLodPlanner {
  compile(treeIr, geometryRole, policy) {
    validateTreeIr(treeIr);
    const rolePolicy = requireRolePolicy(policy, geometryRole);
    const selected = new Set();

    for (const stem of treeIr.stems) {
      if (!stem.windNodeId) continue;
      if (
        rolePolicy.maximumStemOrder === null ||
        stem.order <= rolePolicy.maximumStemOrder
      ) {
        selected.add(stem.windNodeId);
      }
    }
    if (rolePolicy.includeFoliageNodes) {
      for (const site of treeIr.foliageSites) {
        if (typeof site.windNodeId === 'string' && site.windNodeId !== '') {
          selected.add(site.windNodeId);
        }
      }
    }

    const windNodeIds = treeIr.windNodes
      .filter((node) => selected.has(node.id))
      .map((node) => node.id);

    return Object.freeze({
      geometryRole,
      animationMode: rolePolicy.mode,
      maximumStemOrder: rolePolicy.maximumStemOrder,
      includeFoliageNodes: rolePolicy.includeFoliageNodes,
      windNodeIds: Object.freeze(windNodeIds),
      sourceWindNodeCount: treeIr.windNodes.length,
      activeWindNodeCount: windNodeIds.length,
    });
  }
}
