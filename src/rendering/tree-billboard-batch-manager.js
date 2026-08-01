import * as THREE from 'three';
import { TreeBillboardBatchState } from './tree-billboard-batch-state.js';

const DEFAULT_CAPACITY = 128;
const DITHER_FRAGMENT = `
  float treeBatchNoise = fract(
    52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))
  );
  if (vTreeBillboardInvert < 0.5) {
    if (treeBatchNoise > vTreeBillboardFade) discard;
  } else if (treeBatchNoise < 1.0 - vTreeBillboardFade) {
    discard;
  }
`;

function createGeometry(capacity) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.setAttribute(
    'treeBillboardScale',
    new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2),
  );
  geometry.setAttribute(
    'treeBillboardFade',
    new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1),
  );
  geometry.setAttribute(
    'treeBillboardInvert',
    new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1),
  );
  for (const name of [
    'treeBillboardScale',
    'treeBillboardFade',
    'treeBillboardInvert',
  ]) {
    geometry.getAttribute(name).setUsage(THREE.DynamicDrawUsage);
  }
  return geometry;
}

function createMaterial(texture) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: true,
    fog: true,
    toneMapped: true,
  });
  material.name = 'tree-impostor-batch-material';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `
      attribute vec2 treeBillboardScale;
      attribute float treeBillboardFade;
      attribute float treeBillboardInvert;
      varying float vTreeBillboardFade;
      varying float vTreeBillboardInvert;
      ${shader.vertexShader}
    `.replace(
      '#include <project_vertex>',
      `
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mvPosition.xy += position.xy * treeBillboardScale;
        gl_Position = projectionMatrix * mvPosition;
        vTreeBillboardFade = treeBillboardFade;
        vTreeBillboardInvert = treeBillboardInvert;
      `,
    );
    shader.fragmentShader = `
      varying float vTreeBillboardFade;
      varying float vTreeBillboardInvert;
      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `${DITHER_FRAGMENT}\n#include <dithering_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'tree-impostor-instanced-batch-v1';
  return material;
}

function findImpostor(tree) {
  let impostor = null;
  tree.traverse((object) => {
    if (object.name === 'tree-impostor') impostor = object;
  });
  return impostor;
}

export class TreeBillboardBatchManager {
  constructor(scene, { capacity = DEFAULT_CAPACITY } = {}) {
    this.scene = scene;
    this.capacity = capacity;
    this.batches = new Map();
    this.worldPosition = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
  }

  register(tree) {
    const presetId = tree.userData.tree.presetId;
    const impostor = findImpostor(tree);
    if (!impostor) return null;
    let batch = this.batches.get(presetId);
    if (!batch) {
      const geometry = createGeometry(this.capacity);
      const mesh = new THREE.InstancedMesh(
        geometry,
        createMaterial(impostor.material.map),
        this.capacity,
      );
      mesh.name = `tree-impostor-batch-${presetId}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      batch = { mesh, state: new TreeBillboardBatchState(this.capacity) };
      this.batches.set(presetId, batch);
      this.scene.add(mesh);
    }
    impostor.getWorldPosition(this.worldPosition);
    this.worldPosition.y += impostor.scale.y * 0.5;
    const index = batch.state.add(tree);
    this.matrix.makeTranslation(
      this.worldPosition.x,
      this.worldPosition.y,
      this.worldPosition.z,
    );
    batch.mesh.setMatrixAt(index, this.matrix);
    const scale = batch.mesh.geometry.getAttribute('treeBillboardScale');
    scale.setXY(index, impostor.scale.x, impostor.scale.y);
    batch.mesh.geometry.getAttribute('treeBillboardFade').setX(index, 0);
    batch.mesh.geometry.getAttribute('treeBillboardInvert').setX(index, 0);
    batch.mesh.count = batch.state.entries.length;
    batch.mesh.instanceMatrix.needsUpdate = true;
    scale.needsUpdate = true;
    impostor.visible = false;
    const handle = { batch, index };
    tree.userData.lod.billboardBatch = handle;
    return handle;
  }

  setFade(handle, value, invert = false) {
    if (!handle) return;
    handle.batch.state.setFade(handle.index, value, invert);
    const fade = handle.batch.mesh.geometry.getAttribute('treeBillboardFade');
    const inverted = handle.batch.mesh.geometry.getAttribute('treeBillboardInvert');
    fade.setX(handle.index, handle.batch.state.fades[handle.index]);
    inverted.setX(handle.index, handle.batch.state.inverted[handle.index]);
    fade.needsUpdate = true;
    inverted.needsUpdate = true;
  }

  clear() {
    for (const { mesh } of this.batches.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.batches.clear();
  }

  get drawCallCount() {
    return this.batches.size;
  }
}
