export function releaseTreeBillboardBatchReferences(batch) {
  if (!batch?.state?.entries) return 0;

  let released = 0;
  for (const tree of batch.state.entries) {
    const lodState = tree?.userData?.lod;
    if (lodState?.billboardBatch?.batch !== batch) continue;
    lodState.billboardBatch = null;
    released += 1;
  }
  batch.state.entries.length = 0;
  batch.state.activeCount = 0;
  return released;
}
