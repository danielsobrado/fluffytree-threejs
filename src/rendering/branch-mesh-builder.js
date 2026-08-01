import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const RADIAL_SEGMENTS = 7;
const TRUNK_CURVE_SAMPLES = 14;
const BRANCH_CURVE_SAMPLES = 8;

function toVector3(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function createCurve(points) {
  const vectors = points.map(toVector3);

  if (vectors.length === 3) {
    return new THREE.QuadraticBezierCurve3(vectors[0], vectors[1], vectors[2]);
  }

  return new THREE.CatmullRomCurve3(vectors, false, 'centripetal');
}

function createTaperedCurveGeometry(path, startRadius, endRadius, sampleCount) {
  const curve = createCurve(path);
  const points = curve.getPoints(sampleCount);
  const geometries = [];
  const direction = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const transform = new THREE.Matrix4();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = start.distanceTo(end);

    if (length <= Number.EPSILON) {
      continue;
    }

    const startT = index / (points.length - 1);
    const endT = (index + 1) / (points.length - 1);
    const radiusStart = THREE.MathUtils.lerp(startRadius, endRadius, startT);
    const radiusEnd = THREE.MathUtils.lerp(startRadius, endRadius, endT);
    const geometry = new THREE.CylinderGeometry(
      radiusEnd,
      radiusStart,
      length,
      RADIAL_SEGMENTS,
      1,
      false,
    );

    direction.subVectors(end, start).normalize();
    midpoint.addVectors(start, end).multiplyScalar(0.5);
    quaternion.setFromUnitVectors(UP, direction);
    transform.compose(midpoint, quaternion, scale);
    geometry.applyMatrix4(transform);
    geometries.push(geometry);
  }

  if (geometries.length === 0) {
    throw new Error('Cannot create branch geometry from an empty path.');
  }

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());

  if (!merged) {
    throw new Error('Failed to merge branch geometry.');
  }

  merged.computeVertexNormals();
  return merged;
}

export class BranchMeshBuilder {
  build(treeData) {
    const geometries = [
      createTaperedCurveGeometry(
        treeData.trunk.points,
        treeData.trunk.startRadius,
        treeData.trunk.endRadius,
        TRUNK_CURVE_SAMPLES,
      ),
      ...treeData.branches.map((branch) =>
        createTaperedCurveGeometry(
          branch.points,
          branch.startRadius,
          branch.endRadius,
          BRANCH_CURVE_SAMPLES,
        ),
      ),
    ];
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());

    if (!merged) {
      throw new Error('Failed to merge the generated tree structure.');
    }

    const material = new THREE.MeshStandardMaterial({
      color: treeData.trunkColor,
      roughness: 1,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'tree-structure';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
