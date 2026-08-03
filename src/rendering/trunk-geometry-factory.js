import {
  calculateRootRadiusScale,
  extendPathBelowGround,
} from './root-flare-profile.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

export class TrunkGeometryFactory {
  constructor({ geometryFactory = new TaperedCurveGeometryFactory() } = {}) {
    this.geometryFactory = geometryFactory;
  }

  create(
    treeData,
    {
      radialSegments = TREE_STRUCTURE_RENDERING_CONSTANTS.radialSegments,
      trunkCurveSamples = TREE_STRUCTURE_RENDERING_CONSTANTS.trunkCurveSamples,
    } = {},
  ) {
    const path = extendPathBelowGround(treeData.trunk.points);
    const geometry = this.geometryFactory.create({
      path,
      startRadius: treeData.trunk.startRadius,
      endRadius: treeData.trunk.endRadius,
      sampleCount: trunkCurveSamples,
      sampleBias: TREE_STRUCTURE_RENDERING_CONSTANTS.trunkSampleBias,
      taperExponent:
        treeData.trunk.taperPower ??
        TREE_STRUCTURE_RENDERING_CONSTANTS.taperExponent,
      radiusScale: ({ angle, height }) =>
        calculateRootRadiusScale(
          treeData.trunk.flare,
          angle,
          height,
          treeData.seed,
          treeData.trunk.nebari ?? 1,
        ),
      capStart: true,
      capEnd: true,
      radialSegments,
    });
    geometry.userData.trunkPath = path;
    return geometry;
  }
}
