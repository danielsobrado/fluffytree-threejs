export function buildTreeReplacement(
  entries,
  { createBatchManager, buildEntry, disposeRoot },
) {
  const billboardBatchManager = createBatchManager();
  const roots = [];
  const treeDataByPreset = new Map();

  try {
    for (const entry of entries) {
      const { root, treeData } = buildEntry(entry, billboardBatchManager);
      roots.push(root);
      treeDataByPreset.set(entry.preset, treeData);
    }
  } catch (error) {
    billboardBatchManager.clear();
    for (const root of roots) disposeRoot(root);
    throw error;
  }

  return { billboardBatchManager, roots, treeDataByPreset };
}
