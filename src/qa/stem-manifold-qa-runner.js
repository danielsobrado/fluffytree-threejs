import { TreeGenerator } from '../generation/tree-generator.js';
import { TrunkGeometryFactory } from '../rendering/trunk-geometry-factory.js';
import { analyzeBufferGeometryManifold } from './mesh-manifold-analyzer.js';

function validateConfiguration(configuration) {
  const seedStart = Number(configuration?.run?.seedStart);
  const seedCount = Number(configuration?.run?.seedCount);
  const variants = configuration?.run?.variants;

  if (!Number.isSafeInteger(seedStart)) {
    throw new Error('Stem manifold QA seedStart must be an integer.');
  }
  if (!Number.isSafeInteger(seedCount) || seedCount <= 0) {
    throw new Error('Stem manifold QA seedCount must be a positive integer.');
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('Stem manifold QA requires at least one geometry variant.');
  }

  for (const variant of variants) {
    if (
      typeof variant.id !== 'string' ||
      !Number.isSafeInteger(variant.radialSegments) ||
      variant.radialSegments < 3 ||
      !Number.isSafeInteger(variant.trunkCurveSamples) ||
      variant.trunkCurveSamples < 2
    ) {
      throw new Error('Stem manifold QA contains an invalid geometry variant.');
    }
  }
}

function collectFailures(metrics) {
  const checks = [
    ['malformedPositionValueCount', metrics.malformedPositionValueCount],
    ['malformedIndexValueCount', metrics.malformedIndexValueCount],
    ['invalidIndexCount', metrics.invalidIndexCount],
    ['nonFiniteVertexCount', metrics.nonFiniteVertexCount],
    ['unreferencedVertexCount', metrics.unreferencedVertexCount],
    ['degenerateTriangleCount', metrics.degenerateTriangleCount],
    ['duplicateTriangleCount', metrics.duplicateTriangleCount],
    ['boundaryEdgeCount', metrics.boundaryEdgeCount],
    ['nonManifoldEdgeCount', metrics.nonManifoldEdgeCount],
    ['orientationConflictCount', metrics.orientationConflictCount],
    ['selfIntersectionCount', metrics.selfIntersectionCount],
  ];
  const failures = checks
    .filter(([, value]) => value !== 0)
    .map(([metric, value]) => ({ metric, value, expected: 0 }));

  if (metrics.componentCount !== 1) {
    failures.push({
      metric: 'componentCount',
      value: metrics.componentCount,
      expected: 1,
    });
  }
  if (metrics.eulerCharacteristic !== metrics.expectedEulerCharacteristic) {
    failures.push({
      metric: 'eulerCharacteristic',
      value: metrics.eulerCharacteristic,
      expected: metrics.expectedEulerCharacteristic,
    });
  }
  if (
    !Number.isFinite(metrics.signedVolume) ||
    metrics.signedVolume <= metrics.minimumSignedVolume
  ) {
    failures.push({
      metric: 'signedVolume',
      value: metrics.signedVolume,
      expected: `> ${metrics.minimumSignedVolume}`,
    });
  }
  return failures;
}

function incrementFailures(tally, failures) {
  for (const failure of failures) {
    tally[failure.metric] = (tally[failure.metric] ?? 0) + 1;
  }
}

export class StemManifoldQaRunner {
  constructor({
    treeGenerator = new TreeGenerator(),
    trunkGeometryFactory = new TrunkGeometryFactory(),
  } = {}) {
    this.treeGenerator = treeGenerator;
    this.trunkGeometryFactory = trunkGeometryFactory;
  }

  run(presets, configuration) {
    validateConfiguration(configuration);
    const analysisOptions = configuration.analysis ?? {};
    const maximumFailureExamples = Number(
      configuration.report?.maximumFailureExamples ?? 20,
    );
    const failuresByMetric = {};
    const failureExamples = [];
    const variants = Object.fromEntries(
      configuration.run.variants.map((variant) => [
        variant.id,
        {
          radialSegments: variant.radialSegments,
          trunkCurveSamples: variant.trunkCurveSamples,
          geometriesAnalyzed: 0,
          failedGeometryCount: 0,
          maximumBoundaryEdges: 0,
          maximumNonManifoldEdges: 0,
          maximumOrientationConflicts: 0,
          maximumSelfIntersections: 0,
          maximumSelfIntersectionPairsTested: 0,
          minimumSignedVolume: Number.POSITIVE_INFINITY,
        },
      ]),
    );
    let geometriesAnalyzed = 0;
    let failedGeometryCount = 0;

    for (const [presetId, preset] of presets) {
      for (let offset = 0; offset < configuration.run.seedCount; offset += 1) {
        const seed = configuration.run.seedStart + offset;
        const tree = this.treeGenerator.generate(preset, seed, {
          includeSurfaceSamples: false,
        });

        for (const variant of configuration.run.variants) {
          const geometry = this.trunkGeometryFactory.create(tree, variant);
          const metrics = analyzeBufferGeometryManifold(
            geometry,
            analysisOptions,
          );
          geometry.dispose();
          const failures = collectFailures(metrics);
          const variantReport = variants[variant.id];

          geometriesAnalyzed += 1;
          variantReport.geometriesAnalyzed += 1;
          variantReport.maximumBoundaryEdges = Math.max(
            variantReport.maximumBoundaryEdges,
            metrics.boundaryEdgeCount,
          );
          variantReport.maximumNonManifoldEdges = Math.max(
            variantReport.maximumNonManifoldEdges,
            metrics.nonManifoldEdgeCount,
          );
          variantReport.maximumOrientationConflicts = Math.max(
            variantReport.maximumOrientationConflicts,
            metrics.orientationConflictCount,
          );
          variantReport.maximumSelfIntersections = Math.max(
            variantReport.maximumSelfIntersections,
            metrics.selfIntersectionCount,
          );
          variantReport.maximumSelfIntersectionPairsTested = Math.max(
            variantReport.maximumSelfIntersectionPairsTested,
            metrics.selfIntersectionTestedPairCount,
          );
          variantReport.minimumSignedVolume = Math.min(
            variantReport.minimumSignedVolume,
            metrics.signedVolume,
          );

          if (failures.length === 0 && metrics.closedTwoManifold) continue;

          failedGeometryCount += 1;
          variantReport.failedGeometryCount += 1;
          incrementFailures(failuresByMetric, failures);
          if (failureExamples.length < maximumFailureExamples) {
            failureExamples.push({
              presetId,
              seed,
              variantId: variant.id,
              failures,
              metrics,
            });
          }
        }
      }
    }

    for (const report of Object.values(variants)) {
      report.minimumSignedVolume = Number.isFinite(report.minimumSignedVolume)
        ? report.minimumSignedVolume
        : null;
      report.passed = report.failedGeometryCount === 0;
    }

    return Object.freeze({
      schemaVersion: 2,
      passed: failedGeometryCount === 0,
      configuration: structuredClone(configuration),
      summary: {
        presetCount: presets.size,
        seedCount: configuration.run.seedCount,
        variantCount: configuration.run.variants.length,
        geometriesAnalyzed,
        failedGeometryCount,
      },
      failuresByMetric,
      failureExamples,
      variants,
    });
  }
}
