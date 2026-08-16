import { validateTreeIr } from '../generation/tree-ir-validator.js';

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
    const stemByWindNode = new Map(
      treeIr.stems
        .filter((stem) => stem.windNodeId)
        .map((stem) => [stem.windNodeId, stem]),
    );
    const windNodeIds = treeIr.windNodes
      .filter((node) => {
        const stem = stemByWindNode.get(node.id);
        if (!stem) return false;
        return (
          rolePolicy.maximumStemOrder === null ||
          stem.order <= rolePolicy.maximumStemOrder
        );
      })
      .map((node) => node.id);

    return Object.freeze({
      geometryRole,
      animationMode: rolePolicy.mode,
      maximumStemOrder: rolePolicy.maximumStemOrder,
      windNodeIds: Object.freeze(windNodeIds),
      sourceWindNodeCount: treeIr.windNodes.length,
      activeWindNodeCount: windNodeIds.length,
    });
  }
}
