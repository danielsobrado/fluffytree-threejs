# Deterministic procedural tree shape QA

**Status:** PASS

Analyzed 6144 generated trees across 3 presets using seeds 1–2048.

Silhouette grid: 64² per view. Volume grid: 14³. Deterministic replays: 2.

## Round orchard (roundOrchard)

- Status: **PASS**
- Profile: round
- Trees analyzed: 2048
- Failed trees: 0
- Unique trees: 2048/2048
- Determinism mismatches: 0

| Metric | Min | P05 | P50 | P95 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| lobeCount | 11 | 11 | 11 | 11 | 11 | 11 |
| branchCount | 6 | 6 | 6 | 6 | 6 | 6 |
| lobeComponentCount | 1 | 1 | 1 | 1 | 1 | 1 |
| crownAspectRatio | 1.0052 | 1.0978 | 1.2229 | 1.3645 | 1.5496 | 1.2253 |
| widthDepthRatio | 0.6573 | 0.8461 | 1.0299 | 1.2459 | 1.5205 | 1.0374 |
| silhouetteFillRatio | 0.5858 | 0.6292 | 0.6808 | 0.7372 | 0.7928 | 0.6822 |
| silhouetteHoleRatio | 0 | 0 | 0 | 0.0004 | 0.0025 | 0.0001 |
| targetCoverage | 0.6974 | 0.7557 | 0.8048 | 0.8536 | 0.9019 | 0.8051 |
| profileRmse | 0.0644 | 0.1008 | 0.1400 | 0.1861 | 0.2424 | 0.1415 |
| profileCorrelation | 0.2073 | 0.6281 | 0.8291 | 0.9201 | 0.9601 | 0.8095 |
| envelopeCoverage | 0.3359 | 0.4225 | 0.5006 | 0.5857 | 0.6553 | 0.5022 |
| unionSpillRatio | 0.0042 | 0.0180 | 0.0403 | 0.0693 | 0.1151 | 0.0414 |
| trunkTopFoliageDistance | 0.1703 | 0.1703 | 0.1703 | 0.1703 | 0.1703 | 0.1703 |
| maximumBranchInsertion | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 |

### Gate failures

No gate failures.

## Columnar (columnar)

- Status: **PASS**
- Profile: columnar
- Trees analyzed: 2048
- Failed trees: 0
- Unique trees: 2048/2048
- Determinism mismatches: 0

| Metric | Min | P05 | P50 | P95 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| lobeCount | 13 | 13 | 13 | 13 | 13 | 13 |
| branchCount | 5 | 5 | 5 | 5 | 5 | 5 |
| lobeComponentCount | 1 | 1 | 1 | 1 | 1 | 1 |
| crownAspectRatio | 2.3769 | 2.6255 | 2.8671 | 3.1457 | 3.5395 | 2.8757 |
| widthDepthRatio | 0.7194 | 0.8607 | 0.9982 | 1.1717 | 1.3159 | 1.0032 |
| silhouetteFillRatio | 0.5506 | 0.5961 | 0.6442 | 0.6893 | 0.7531 | 0.6440 |
| silhouetteHoleRatio | 0 | 0 | 0.0004 | 0.0036 | 0.0116 | 0.0009 |
| targetCoverage | 0.5526 | 0.6004 | 0.6427 | 0.6846 | 0.7281 | 0.6428 |
| profileRmse | 0.1219 | 0.1614 | 0.2112 | 0.2695 | 0.3142 | 0.2127 |
| profileCorrelation | 0.3175 | 0.6448 | 0.7915 | 0.8811 | 0.9328 | 0.7811 |
| envelopeCoverage | 0.2046 | 0.2427 | 0.2771 | 0.3158 | 0.3492 | 0.2780 |
| unionSpillRatio | 0 | 0 | 0 | 0.0246 | 0.0491 | 0.0056 |
| trunkTopFoliageDistance | 0.1652 | 0.3877 | 0.3877 | 0.3877 | 0.3877 | 0.3871 |
| maximumBranchInsertion | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 |

### Gate failures

No gate failures.

## Irregular autumn (irregularAutumn)

- Status: **PASS**
- Profile: vase
- Trees analyzed: 2048
- Failed trees: 0
- Unique trees: 2048/2048
- Determinism mismatches: 0

| Metric | Min | P05 | P50 | P95 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| lobeCount | 12 | 12 | 12 | 12 | 12 | 12 |
| branchCount | 7 | 7 | 7 | 7 | 7 | 7 |
| lobeComponentCount | 1 | 1 | 1 | 1 | 1 | 1 |
| crownAspectRatio | 1.0328 | 1.1679 | 1.3240 | 1.5134 | 1.7910 | 1.3310 |
| widthDepthRatio | 0.5936 | 0.8026 | 0.9978 | 1.2528 | 1.4966 | 1.0091 |
| silhouetteFillRatio | 0.5300 | 0.5979 | 0.6522 | 0.7061 | 0.7636 | 0.6518 |
| silhouetteHoleRatio | 0 | 0 | 0 | 0.0017 | 0.0075 | 0.0004 |
| targetCoverage | 0.6760 | 0.7346 | 0.7967 | 0.8540 | 0.9046 | 0.7957 |
| profileRmse | 0.0664 | 0.1059 | 0.1451 | 0.1926 | 0.2461 | 0.1465 |
| profileCorrelation | 0.5118 | 0.7215 | 0.8512 | 0.9278 | 0.9807 | 0.8419 |
| envelopeCoverage | 0.3121 | 0.4104 | 0.5014 | 0.5974 | 0.6834 | 0.5029 |
| unionSpillRatio | 0 | 0.0245 | 0.0639 | 0.1186 | 0.1787 | 0.0665 |
| trunkTopFoliageDistance | 0.2150 | 0.2150 | 0.2150 | 0.2150 | 0.2150 | 0.2150 |
| maximumBranchInsertion | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 | 0.5500 |

### Gate failures

No gate failures.
