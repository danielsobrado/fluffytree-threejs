import { CrownEnvelope } from '../generation/crown-envelope.js';
import { analyzeSilhouette } from './silhouette-analyzer.js';
import { analyzeTopology } from './tree-topology-analyzer.js';
import { analyzeVolume } from './volume-analyzer.js';

function calculateBounds(lobes) {
  const minimum = { x: Infinity, y: Infinity, z: Infinity };
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const lobe of lobes) {
    minimum.x = Math.min(minimum.x, lobe.position.x - lobe.scale.x);
    minimum.y = Math.min(minimum.y, lobe.position.y - lobe.scale.y);
    minimum.z = Math.min(minimum.z, lobe.position.z - lobe.scale.z);
    maximum.x = Math.max(maximum.x, lobe.position.x + lobe.scale.x);
    maximum.y = Math.max(maximum.y, lobe.position.y + lobe.scale.y);
    maximum.z = Math.max(maximum.z, lobe.position.z + lobe.scale.z);
  }

  return {
    width: maximum.x - minimum.x,
    height: maximum.y - minimum.y,
    depth: maximum.z - minimum.z,
  };
}

function countNonFiniteNumbers(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? 0 : 1;
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => total + countNonFiniteNumbers(item),
      0,
    );
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce(
      (total, item) => total + countNonFiniteNumbers(item),
      0,
    );
  }
  return 0;
}

function calculateVerticalBands(lobes, crown) {
  const bands = [0, 0, 0];

  for (const lobe of lobes) {
    const normalizedHeight =
      (lobe.position.y - crown.baseHeight) / crown.height;
    const index = Math.min(
      2,
      Math.max(0, Math.floor(normalizedHeight * 3)),
    );
    bands[index] += 1;
  }

  return bands;
}

function combineProjections(front, side) {
  return {
    silhouetteFillRatio: Math.min(front.fillRatio, side.fillRatio),
    silhouetteComponentCount: Math.max(
      front.componentCount,
      side.componentCount,
    ),
    silhouetteLargestComponentRatio: Math.min(
      front.largestComponentRatio,
      side.largestComponentRatio,
    ),
    silhouetteHoleRatio: Math.max(front.holeRatio, side.holeRatio),
    targetCoverage: Math.min(front.targetCoverage, side.targetCoverage),
    silhouetteExcessRatio: Math.max(
      front.excessRatio,
      side.excessRatio,
    ),
    profileRmse: Math.max(front.profileRmse, side.profileRmse),
    profileCorrelation: Math.min(
      front.profileCorrelation,
      side.profileCorrelation,
    ),
    upperLowerWidthRatio:
      (front.upperLowerWidthRatio + side.upperLowerWidthRatio) / 2,
    middleLowerWidthRatio:
      (front.middleLowerWidthRatio + side.middleLowerWidthRatio) / 2,
    middleUpperWidthRatio:
      (front.middleUpperWidthRatio + side.middleUpperWidthRatio) / 2,
  };
}

export class TreeShapeAnalyzer {
  constructor({
    silhouetteResolution,
    volumeResolution,
    profileSampleCount,
  }) {
    this.silhouetteResolution = silhouetteResolution;
    this.volumeResolution = volumeResolution;
    this.profileSampleCount = profileSampleCount;
  }

  analyze(tree, preset) {
    const bounds = calculateBounds(tree.lobes);
    const envelope = new CrownEnvelope(preset.crown);
    const front = analyzeSilhouette(
      tree.lobes,
      envelope,
      'x',
      this.silhouetteResolution,
      this.profileSampleCount,
    );
    const side = analyzeSilhouette(
      tree.lobes,
      envelope,
      'z',
      this.silhouetteResolution,
      this.profileSampleCount,
    );
    const verticalBandCounts = calculateVerticalBands(
      tree.lobes,
      preset.crown,
    );

    return {
      seed: tree.seed,
      lobeCount: tree.lobes.length,
      branchCount: tree.branches.length,
      trunkPointCount: tree.trunk.points.length,
      nonFiniteValueCount: countNonFiniteNumbers(tree),
      crownWidth: bounds.width,
      crownHeight: bounds.height,
      crownDepth: bounds.depth,
      crownAspectRatio:
        bounds.height / ((bounds.width + bounds.depth) / 2),
      widthDepthRatio: bounds.width / bounds.depth,
      minimumColorMix: Math.min(
        ...tree.lobes.map((lobe) => lobe.colorMix),
      ),
      maximumColorMix: Math.max(
        ...tree.lobes.map((lobe) => lobe.colorMix),
      ),
      lowerLobeCount: verticalBandCounts[0],
      middleLobeCount: verticalBandCounts[1],
      upperLobeCount: verticalBandCounts[2],
      ...analyzeTopology(tree),
      ...combineProjections(front, side),
      ...analyzeVolume(tree.lobes, envelope, this.volumeResolution),
    };
  }
}
