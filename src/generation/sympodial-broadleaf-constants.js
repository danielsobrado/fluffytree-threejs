export const SYMPODIAL_BROADLEAF_MODEL_ID = 'sympodial-broadleaf';

export const SYMPODIAL_BROADLEAF_LIMITS = Object.freeze({
  crownBaseRatio: Object.freeze([0.15, 0.8]),
  leaderCount: Object.freeze([2, 8]),
  branchingDepth: Object.freeze([2, 6]),
  childCount: Object.freeze([1, 5]),
  directionCandidates: Object.freeze([2, 24]),
  leaderReach: Object.freeze([0.55, 1.05]),
  lengthDecay: Object.freeze([0.35, 0.9]),
  lengthVariation: Object.freeze([0, 0.45]),
  radiusDecay: Object.freeze([0.35, 0.85]),
  branchAngle: Object.freeze([0.15, 1.45]),
  upwardBias: Object.freeze([0, 1]),
  branchSag: Object.freeze([0, 0.7]),
  crownSpread: Object.freeze([0, 1]),
  crownFlattening: Object.freeze([0, 1]),
  selfOrganization: Object.freeze([0, 1]),
  lowerLimbLoss: Object.freeze([0, 0.9]),
  childAttachmentRange: Object.freeze([0.25, 0.95]),
  foliageSitesPerTerminal: Object.freeze([1, 8]),
  foliageScale: Object.freeze([0.1, 3]),
  crownVolumeScale: Object.freeze([0.1, 2]),
  maximumStemCount: Object.freeze([8, 2048]),
  stemPathSegments: Object.freeze([2, 12]),
  trunkCurve: Object.freeze([0, 1]),
  taperPower: Object.freeze([0.2, 2]),
});

export const SYMPODIAL_BROADLEAF_CONSTANTS = Object.freeze({
  minimumStemRadius: 0.008,
  minimumStemLength: 0.08,
  minimumCrownAxis: 0.12,
  rootWindNodeId: 'wind:stem:root',
  goldenAngle: Math.PI * (3 - Math.sqrt(5)),
});
