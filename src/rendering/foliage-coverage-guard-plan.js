function isCoverageRepair(instance) {
  return typeof instance.coverageRepairKind === 'string';
}

function maximumCertifiedPlaneCount(instances, renderedPlaneCount) {
  let maximum = renderedPlaneCount;
  for (const instance of instances) {
    const count = Number(instance.planesPerCluster);
    if (Number.isSafeInteger(count)) maximum = Math.max(maximum, count);
  }
  return maximum;
}

export function resolveFoliageCoverageGuard(instances, renderedPlaneCount) {
  if (!Array.isArray(instances)) {
    throw new TypeError('Foliage coverage guard requires an instance array.');
  }
  if (!Number.isSafeInteger(renderedPlaneCount) || renderedPlaneCount < 1) {
    throw new RangeError('Rendered foliage plane count must be a positive integer.');
  }

  const repairInstances = instances.filter(isCoverageRepair);
  const certifiedPlaneCount = maximumCertifiedPlaneCount(
    repairInstances,
    renderedPlaneCount,
  );

  return Object.freeze({
    repairInstances: Object.freeze(repairInstances),
    certifiedPlaneCount,
    firstPlaneIndex: renderedPlaneCount,
    planeCount: certifiedPlaneCount - renderedPlaneCount,
  });
}
