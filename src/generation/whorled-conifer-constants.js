export const WHORLED_CONIFER_MODEL_ID = 'whorled-conifer';

export const WHORLED_CONIFER_LIMITS = Object.freeze({
  whorlCount: Object.freeze([2, 32]),
  branchesPerWhorl: Object.freeze([2, 9]),
  crownTaperPower: Object.freeze([0.25, 3]),
  branchSag: Object.freeze([0, 0.8]),
  branchLengthVariation: Object.freeze([0, 0.45]),
  whorlTwist: Object.freeze([0, 1]),
  lowerBranchMortality: Object.freeze([0, 0.8]),
  leaderWander: Object.freeze([0, 0.35]),
  foliageScale: Object.freeze([0.2, 1.5]),
});

export const WHORLED_CONIFER_CONSTANTS = Object.freeze({
  shellSeedSalt: 0x7f4a7c15,
  minimumBranchLength: 0.18,
  minimumBranchRadius: 0.018,
  minimumBranchTipRadius: 0.008,
  minimumFoliageAxis: 0.12,
  branchRadiusRatio: 0.46,
  branchTipRadiusRatio: 0.24,
  lowerWhorlHeightRatio: 0.04,
  upperWhorlHeightRatio: 0.92,
  apexFoliageScale: 0.2,
});
