import { resolveFoliageCoverageGuard } from './foliage-coverage-guard-plan.js';
import { FoliageShellGeometryFactory } from './foliage-shell-geometry-factory.js';
import { buildFoliageShellInstanceMesh } from './foliage-shell-instance-mesh-builder.js';
import { FoliageShellMaterialFactory } from './foliage-shell-material-factory.js';
import { hashUnit } from './deterministic-hash.js';
import { selectFoliageLodInstances } from './foliage-lod-selector.js';

function averageLobeScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function createInteriorInstances(
  treeData,
  outerInstances,
  density,
  insetRatio,
  scaleRatio,
) {
  if (density <= 0) return [];

  const lobes = new Map(treeData.lobes.map((lobe) => [lobe.id, lobe]));
  return outerInstances
    .filter(
      (instance) =>
        hashUnit(treeData.seed, instance.id, 0x6c8e9cf5) <= density,
    )
    .map((instance) => {
      const lobe = lobes.get(instance.lobeId);
      const inset = averageLobeScale(lobe) * insetRatio;
      return {
        ...instance,
        position: {
          x: instance.position.x - instance.normal.x * inset,
          y: instance.position.y - instance.normal.y * inset,
          z: instance.position.z - instance.normal.z * inset,
        },
        scale: instance.scale * scaleRatio,
        shellScale: (instance.shellScale ?? instance.scale) * scaleRatio,
        exposure: instance.exposure * 0.32,
        colorMix: Math.max(0, instance.colorMix - 0.12),
        rotation: instance.rotation + Math.PI * 0.618,
      };
    });
}

export class FoliageShellBuilder {
  constructor({
    geometryFactory = new FoliageShellGeometryFactory(),
    materialFactory = new FoliageShellMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.materialFactory = materialFactory;
  }

  build(
    treeData,
    {
      paletteTexture,
      alphaTexture,
      sunDirection,
      density = 1,
      planesPerCluster = treeData.palette.shell.planesPerCluster,
      scaleMultiplier = 1,
      interiorDensity = 0,
      interiorInsetRatio = 0.28,
      interiorScaleRatio = 0.92,
      name = 'foliage-shell',
    },
  ) {
    const outerSelection = selectFoliageLodInstances(treeData.shell, density, {
      renderedPlaneCount: planesPerCluster,
    });
    const outerInstances = outerSelection.instances;
    const interiorInstances = createInteriorInstances(
      treeData,
      outerInstances,
      interiorDensity,
      interiorInsetRatio,
      interiorScaleRatio,
    );
    const instances =
      interiorInstances.length === 0
        ? outerInstances
        : outerInstances.concat(interiorInstances);
    const coverageGuardPlan = resolveFoliageCoverageGuard(
      outerInstances,
      planesPerCluster,
    );
    const repairInstances = coverageGuardPlan.repairInstances;
    const certifiedPlaneCount = coverageGuardPlan.certifiedPlaneCount;
    const coverageGuardPlaneCount = coverageGuardPlan.planeCount;
    const compensatedScaleMultiplier =
      scaleMultiplier * outerSelection.scaleCompensation;
    let geometry = null;
    let coverageGuardGeometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(planesPerCluster);
      material = this.materialFactory.create({
        foliage: treeData.palette,
        paletteTexture,
        alphaTexture,
        sunDirection,
      });
      const shell = buildFoliageShellInstanceMesh(
        treeData,
        geometry,
        material,
        instances,
        {
          scaleMultiplier: compensatedScaleMultiplier,
          name,
        },
      );

      if (repairInstances.length > 0 && coverageGuardPlaneCount > 0) {
        coverageGuardGeometry = this.geometryFactory.create(certifiedPlaneCount, {
          firstPlaneIndex: coverageGuardPlan.firstPlaneIndex,
          planeCount: coverageGuardPlaneCount,
        });
        const coverageGuardMesh = buildFoliageShellInstanceMesh(
          treeData,
          coverageGuardGeometry,
          material,
          repairInstances,
          {
            scaleMultiplier: compensatedScaleMultiplier,
            name: `${name}-coverage-guard`,
          },
        );
        coverageGuardMesh.userData.foliageCoverageGuard = Object.freeze({
          instanceCount: repairInstances.length,
          firstPlaneIndex: coverageGuardPlan.firstPlaneIndex,
          planeCount: coverageGuardPlaneCount,
          certifiedPlaneCount,
        });
        shell.add(coverageGuardMesh);
      }

      shell.userData.foliageShell = {
        instanceCount: instances.length,
        exteriorInstanceCount: outerInstances.length,
        interiorInstanceCount: interiorInstances.length,
        planesPerCluster,
        density,
        actualDensity: outerSelection.actualDensity,
        scaleCompensation: outerSelection.scaleCompensation,
        maximumCoverageRatio: outerSelection.maximumCoverageRatio,
        coverageRepairInvariantCount:
          outerSelection.coverageRepairInvariantCount,
        coverageLimited: outerSelection.coverageLimited,
        coverageGuardInstanceCount:
          coverageGuardPlaneCount > 0 ? repairInstances.length : 0,
        coverageGuardPlaneCount: Math.max(0, coverageGuardPlaneCount),
        certifiedRepairPlaneCount: certifiedPlaneCount,
      };

      geometry = null;
      coverageGuardGeometry = null;
      material = null;
      return shell;
    } catch (error) {
      geometry?.dispose();
      coverageGuardGeometry?.dispose();
      material?.dispose();
      throw error;
    }
  }
}
