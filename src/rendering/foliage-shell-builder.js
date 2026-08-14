import * as THREE from 'three';
import { FoliageShellGeometryFactory } from './foliage-shell-geometry-factory.js';
import { FoliageShellMaterialFactory } from './foliage-shell-material-factory.js';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js';
import { hashUnit } from './deterministic-hash.js';
import { selectFoliageLodInstances } from './foliage-lod-selector.js';

const LOCAL_OUTWARD = new THREE.Vector3(0, 0, 1);

function crownDirection(position, center, result) {
  const x = position.x - center.x;
  const y = position.y - center.y;
  const z = position.z - center.z;
  const length = Math.hypot(x, y, z);

  if (length <= Number.EPSILON) {
    result.x = 0;
    result.y = 1;
    result.z = 0;
    return result;
  }

  result.x = x / length;
  result.y = y / length;
  result.z = z / length;
  return result;
}

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
    const outerSelection = selectFoliageLodInstances(treeData.shell, density);
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
    let geometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(planesPerCluster);
      addFoliageInstanceAttributes(geometry, instances, {
        getExposure: (instance) => instance.exposure,
        getCrownDirection: (instance, _index, target) =>
          crownDirection(instance.position, treeData.crownCenter, target),
      });

      material = this.materialFactory.create({
        foliage: treeData.palette,
        paletteTexture,
        alphaTexture,
        sunDirection,
      });
      const shell = new THREE.InstancedMesh(
        geometry,
        material,
        instances.length,
      );
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const twist = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const compensatedScaleMultiplier =
        scaleMultiplier * outerSelection.scaleCompensation;

      instances.forEach((instance, index) => {
        position.set(
          instance.position.x,
          instance.position.y,
          instance.position.z,
        );
        normal
          .set(instance.normal.x, instance.normal.y, instance.normal.z)
          .normalize();
        quaternion.setFromUnitVectors(LOCAL_OUTWARD, normal);
        twist.setFromAxisAngle(LOCAL_OUTWARD, instance.rotation);
        quaternion.multiply(twist);
        const shellScale = instance.shellScale ?? instance.scale;
        scale.set(
          shellScale * instance.widthRatio * compensatedScaleMultiplier,
          shellScale * instance.widthRatio * compensatedScaleMultiplier,
          shellScale * instance.outwardRatio * compensatedScaleMultiplier,
        );
        matrix.compose(position, quaternion, scale);
        shell.setMatrixAt(index, matrix);
      });

      shell.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      shell.instanceMatrix.needsUpdate = true;
      shell.name = name;
      shell.castShadow = false;
      shell.receiveShadow = true;
      shell.renderOrder = 1;
      shell.computeBoundingBox();
      shell.computeBoundingSphere();
      shell.userData.foliageShell = {
        instanceCount: instances.length,
        exteriorInstanceCount: outerInstances.length,
        interiorInstanceCount: interiorInstances.length,
        planesPerCluster,
        density,
        actualDensity: outerSelection.actualDensity,
        scaleCompensation: outerSelection.scaleCompensation,
        maximumCoverageRatio: outerSelection.maximumCoverageRatio,
      };

      geometry = null;
      material = null;
      return shell;
    } catch (error) {
      geometry?.dispose();
      material?.dispose();
      throw error;
    }
  }
}
