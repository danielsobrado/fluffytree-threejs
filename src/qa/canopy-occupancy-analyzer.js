import { CANOPY_CLOSURE_CONSTANTS } from '../rendering/canopy-closure-constants.js';
import {
  createCanopyCrossSection,
  interpolateHeight,
  pointAtHeight,
} from '../rendering/canopy-cross-section.js';

function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

function isCovered(point, samples, leafScale, coverageRadiusMultiplier) {
  return samples.some((sample) => {
    const radius = sample.scale * leafScale * coverageRadiusMultiplier;
    return distanceSquared(point, sample.position) <= radius * radius;
  });
}

function createSliceProbes(field, crossSection, gridResolution) {
  const probes = [];

  for (let xIndex = 0; xIndex < gridResolution; xIndex += 1) {
    const xRatio = (xIndex / (gridResolution - 1)) * 2 - 1;

    for (let zIndex = 0; zIndex < gridResolution; zIndex += 1) {
      const zRatio = (zIndex / (gridResolution - 1)) * 2 - 1;
      if (xRatio * xRatio + zRatio * zRatio > 1) continue;

      const point = {
        x: crossSection.center.x + xRatio * crossSection.radiusX,
        y: crossSection.height,
        z: crossSection.center.z + zRatio * crossSection.radiusZ,
      };
      if (field.sample(point) <= 0) probes.push(point);
    }
  }

  return probes;
}

function safeRatio(covered, total) {
  return total === 0 ? 1 : covered / total;
}

export class CanopyOccupancyAnalyzer {
  analyze(treeData, field, samples, options = {}) {
    const probeSlices =
      options.probeSlices ?? CANOPY_CLOSURE_CONSTANTS.qaProbeSlices;
    const gridResolution =
      options.gridResolution ??
      CANOPY_CLOSURE_CONSTANTS.qaProbeGridResolution;
    const coverageRadiusMultiplier =
      options.coverageRadiusMultiplier ??
      CANOPY_CLOSURE_CONSTANTS.qaCoverageRadiusMultiplier;
    const topRatio = options.topRatio ?? CANOPY_CLOSURE_CONSTANTS.qaTopRatio;
    const leafScale = treeData.palette.leafDetail.scale;
    const sliceCoverages = [];
    let coveredProbeCount = 0;
    let probeCount = 0;
    let coveredCapProbeCount = 0;
    let capProbeCount = 0;
    const topThreshold = field.bounds.maximum.y - field.crownHeight * topRatio;

    for (let slice = 0; slice < probeSlices; slice += 1) {
      const height = interpolateHeight(
        field.bounds,
        (slice + 0.5) / probeSlices,
        CANOPY_CLOSURE_CONSTANTS.volumeHeightPaddingRatio,
      );
      const crossSection = createCanopyCrossSection(treeData.lobes, height);
      if (!crossSection) continue;

      const probes = createSliceProbes(field, crossSection, gridResolution);
      let coveredInSlice = 0;

      for (const probe of probes) {
        const covered = isCovered(
          probe,
          samples,
          leafScale,
          coverageRadiusMultiplier,
        );
        probeCount += 1;
        if (covered) {
          coveredProbeCount += 1;
          coveredInSlice += 1;
        }

        if (probe.y >= topThreshold) {
          capProbeCount += 1;
          if (covered) coveredCapProbeCount += 1;
        }
      }

      sliceCoverages.push(safeRatio(coveredInSlice, probes.length));
    }

    const trunkSamples = samples.filter((sample) =>
      ['trunk', 'volume', 'saddle'].includes(sample.role),
    );
    let trunkProbeCount = 0;
    let coveredTrunkProbeCount = 0;

    for (let slice = 0; slice < probeSlices; slice += 1) {
      const height = interpolateHeight(
        field.bounds,
        (slice + 0.5) / probeSlices,
        CANOPY_CLOSURE_CONSTANTS.trunkHeightPaddingRatio,
      );
      const point = pointAtHeight(treeData.trunk.points, height);
      if (!point) continue;

      trunkProbeCount += 1;
      if (
        isCovered(
          point,
          trunkSamples,
          leafScale,
          coverageRadiusMultiplier,
        )
      ) {
        coveredTrunkProbeCount += 1;
      }
    }

    return Object.freeze({
      probeCount,
      coverageRatio: safeRatio(coveredProbeCount, probeCount),
      minimumSliceCoverage:
        sliceCoverages.length === 0 ? 1 : Math.min(...sliceCoverages),
      trunkCoverageRatio: safeRatio(
        coveredTrunkProbeCount,
        trunkProbeCount,
      ),
      capCoverageRatio: safeRatio(coveredCapProbeCount, capProbeCount),
    });
  }
}
