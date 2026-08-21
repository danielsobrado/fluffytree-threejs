import { TREE_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js?v=2.0.0-20260814.2';

function downgradeRole(role, counters, policy) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) {
    if (counters.hierarchical < policy.maximumHierarchicalTrees) {
      counters.hierarchical += 1;
      return TREE_REPRESENTATION_ROLES.HERO;
    }
    role = TREE_REPRESENTATION_ROLES.NEAR;
  }
  if (role === TREE_REPRESENTATION_ROLES.NEAR) {
    if (counters.reduced < policy.maximumReducedTrees) {
      counters.reduced += 1;
      return TREE_REPRESENTATION_ROLES.NEAR;
    }
    return TREE_REPRESENTATION_ROLES.AGGREGATE;
  }
  return role;
}

export class ForestAnimationBudgetAllocator {
  allocate(entries, policy) {
    if (!Array.isArray(entries)) {
      throw new TypeError('Animation budget allocator requires forest entries.');
    }
    if (!policy?.roles) {
      throw new TypeError('Animation budget allocator requires an animation policy.');
    }

    const counters = { hierarchical: 0, reduced: 0 };
    const sorted = [...entries].sort(
      (left, right) => right.projectedPixels - left.projectedPixels,
    );
    const allocations = sorted.map((entry) => {
      const animationRole = downgradeRole(entry.role, counters, policy);
      const rolePolicy = policy.roles[animationRole];
      if (!rolePolicy) {
        throw new Error(`Animation policy is missing role '${animationRole}'.`);
      }
      return Object.freeze({
        instanceId: entry.instance.id,
        geometryRole: entry.role,
        animationRole,
        animationMode: rolePolicy.mode,
        projectedPixels: entry.projectedPixels,
        downgraded: animationRole !== entry.role,
      });
    });

    return Object.freeze({
      allocations: Object.freeze(allocations),
      metrics: Object.freeze({
        treeCount: allocations.length,
        hierarchicalCount: counters.hierarchical,
        reducedCount: counters.reduced,
        downgradedCount: allocations.filter((entry) => entry.downgraded).length,
      }),
    });
  }
}
