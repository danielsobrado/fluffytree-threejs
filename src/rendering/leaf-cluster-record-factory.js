export function createSurfaceRecords(samples, layerCount) {
  return samples.flatMap((sample) =>
    Array.from({ length: layerCount }, (_, layer) => ({
      sample,
      layer,
      kind: 'surface',
    })),
  );
}

export function createClosureRecords(samples, microLayerCount) {
  return samples.flatMap((sample) =>
    Array.from({ length: microLayerCount }, (_, layer) => ({
      sample,
      layer,
      kind: 'closure',
    })),
  );
}

export function countClosureRoles(records) {
  return records.reduce(
    (counts, record) => {
      counts[record.sample.role] = (counts[record.sample.role] ?? 0) + 1;
      return counts;
    },
    { volume: 0, trunk: 0, saddle: 0, cap: 0 },
  );
}
