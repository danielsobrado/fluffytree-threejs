function collectRequiredWindNodeIds(treeIr) {
  const nodesById = new Map(treeIr.windNodes.map((node) => [node.id, node]));
  const required = new Set();

  const includeWithAncestors = (nodeId) => {
    let currentId = nodeId;
    while (currentId !== null && currentId !== undefined && !required.has(currentId)) {
      required.add(currentId);
      currentId = nodesById.get(currentId)?.parentId ?? null;
    }
  };

  for (const stem of treeIr.stems) includeWithAncestors(stem.windNodeId);
  for (const site of treeIr.foliageSites) includeWithAncestors(site.windNodeId);
  return required;
}

export function pruneUnreferencedTreeIrWindNodes(treeIr) {
  const required = collectRequiredWindNodeIds(treeIr);
  const previousCount = treeIr.windNodes.length;
  treeIr.windNodes = treeIr.windNodes.filter((node) => required.has(node.id));
  return previousCount - treeIr.windNodes.length;
}
