function validateRenderedPlaneCount(renderedPlaneCount) {
  if (renderedPlaneCount === null || renderedPlaneCount === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(renderedPlaneCount) || renderedPlaneCount < 1) {
    throw new RangeError('Rendered foliage plane count must be a positive integer.');
  }
  return renderedPlaneCount;
}

function isCoverageRepair(instance) {
  return typeof instance?.coverageRepairKind === 'string';
}

function certifiedPlaneCount(instance, renderedPlaneCount) {
  const count = Number(instance?.planesPerCluster);
  if (!Number.isSafeInteger(count) || count < 1) return renderedPlaneCount;
  return count;
}

export function resolveFoliageLodCoveragePlaneCount(
  instance,
  renderedPlaneCount,
) {
  const rendered = validateRenderedPlaneCount(renderedPlaneCount);
  if (rendered === null) return certifiedPlaneCount(instance, 1);

  const certified = certifiedPlaneCount(instance, rendered);
  return isCoverageRepair(instance)
    ? certified
    : Math.min(certified, rendered);
}

export function createFoliageLodCoverageRepresentation(
  instances,
  renderedPlaneCount,
) {
  if (!Array.isArray(instances)) {
    throw new TypeError('Foliage LOD coverage requires an instance array.');
  }
  const rendered = validateRenderedPlaneCount(renderedPlaneCount);
  if (rendered === null) return instances;

  return instances.map((instance) => {
    const planeCount = resolveFoliageLodCoveragePlaneCount(instance, rendered);
    if (planeCount === Number(instance.planesPerCluster)) return instance;

    const proxy = { ...instance, planesPerCluster: planeCount };
    delete proxy.alphaProfile;
    return proxy;
  });
}

export function foliageLodCoverageCacheKey(density, renderedPlaneCount) {
  const rendered = validateRenderedPlaneCount(renderedPlaneCount);
  return `${density}:${rendered ?? 'certified'}`;
}
