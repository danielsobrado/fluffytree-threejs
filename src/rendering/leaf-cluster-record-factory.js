export function createSurfaceRecords(samples, layerCount) {
  return samples.flatMap((sample) =>
    Array.from({ length: layerCount }, (_, layer) => ({
      sample,
      layer,
    })),
  );
}
