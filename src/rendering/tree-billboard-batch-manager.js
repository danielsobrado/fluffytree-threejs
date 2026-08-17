import * as THREE from 'three';
import {
  BILLBOARD_BATCH_CAPACITY,
  calculateBillboardAtlasSlot,
  calculateBillboardAtlasUvTransform,
  createBillboardAtlasLayout,
} from './tree-billboard-atlas.js';
import { TreeBillboardBatchState } from './tree-billboard-batch-state.js';
import { calculateTreeBillboardWorldSize } from './tree-billboard-scale.js';
import { calculateTreeWorldYaw } from './tree-world-yaw.js';

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

  try {
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
    geometry.setAttribute(
      'treeBillboardUvTransform',
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4),
    );
    for (const name of [
      'treeBillboardScale',
      'treeBillboardFade',
      'treeBillboardInvert',
      'treeBillboardUvTransform',
    ]) {
      geometry.getAttribute(name).setUsage(THREE.DynamicDrawUsage);
    }
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
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
      attribute vec4 treeBillboardUvTransform;
      varying float vTreeBillboardFade;
      varying float vTreeBillboardInvert;
      ${shader.vertexShader}
    `
      .replace(
        '#include <uv_vertex>',
        `
          #include <uv_vertex>
          #ifdef USE_MAP
            vMapUv = vMapUv * treeBillboardUvTransform.zw +
              treeBillboardUvTransform.xy;
          #endif
        `,
      )
      .replace(
        '#include <project_vertex>',
        `
          vec4 mvPosition = modelViewMatrix * instanceMatrix *
            vec4(0.0, 0.0, 0.0, 1.0);
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
  material.customProgramCacheKey = () => 'tree-impostor-instanced-atlas-v2';
  return material;
}

function createAtlas(capacity, sourceTexture) {
  const image = sourceTexture.image;
  if (!image?.width || !image?.height) {
    throw new Error('The tree impostor texture has no drawable image.');
  }

  const layout = createBillboardAtlasLayout(capacity);
  const canvas = document.createElement('canvas');
  canvas.width = image.width * layout.columns;
  canvas.height = image.height * layout.rows;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the tree billboard atlas.');

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'tree-impostor-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {
    canvas,
    context,
    texture,
    layout,
    cellWidth: image.width,
    cellHeight: image.height,
  };
}

function disposeBatch(scene, batch) {
  scene.remove(batch.mesh);
  batch.mesh.geometry.dispose();
  batch.mesh.material.dispose();
  batch.atlas.texture.dispose();
}

function findImpostor(tree) {
  let impostor = null;
  tree.traverse((object) => {
    if (object.name === 'tree-impostor') impostor = object;
  });
  return impostor;
}

function releaseSourceTexture(impostor, texture) {
  impostor.material.userData.disposables = (
    impostor.material.userData.disposables ?? []
  ).filter((resource) => resource !== texture);
  impostor.material.map = null;
  texture.dispose();
}

export class TreeBillboardBatchManager {
  constructor(scene, { capacity = BILLBOARD_BATCH_CAPACITY } = {}) {
    this.scene = scene;
    this.capacity = capacity;
    this.batches = new Map();
    this.worldPosition = new THREE.Vector3();
    this.worldScale = new THREE.Vector3();
    this.worldQuaternion = new THREE.Quaternion();
    this.worldForward = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
  }

  createBatch(presetId, sourceTexture) {
    let atlas = null;
    let geometry = null;
    let material = null;
    let mesh = null;

    try {
      atlas = createAtlas(this.capacity, sourceTexture);
      geometry = createGeometry(this.capacity);
      material = createMaterial(atlas.texture);
      mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      const presetBatches = this.batches.get(presetId) ?? [];
      mesh.name = `tree-impostor-batch-${presetId}-${presetBatches.length}`;
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const batch = {
        mesh,
        atlas,
        state: new TreeBillboardBatchState(this.capacity),
      };

      this.scene.add(mesh);
      presetBatches.push(batch);
      this.batches.set(presetId, presetBatches);
      return batch;
    } catch (error) {
      if (mesh) this.scene.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      atlas?.texture?.dispose();
      throw error;
    }
  }

  removeEmptyBatch(presetId, batch) {
    if (batch.state.entries.length !== 0) return;
    const presetBatches = this.batches.get(presetId);
    if (!presetBatches) return;
    const index = presetBatches.indexOf(batch);
    if (index < 0) return;

    presetBatches.splice(index, 1);
    if (presetBatches.length === 0) this.batches.delete(presetId);
    disposeBatch(this.scene, batch);
  }

  register(tree) {
    const presetId = tree.userData.tree.presetId;
    tree.getWorldQuaternion(this.worldQuaternion);
    this.worldForward.set(0, 0, 1).applyQuaternion(this.worldQuaternion);
    const worldYaw = calculateTreeWorldYaw(this.worldForward, tree.rotation.y);
    tree.userData.lod.rebuildImpostor?.(worldYaw);
    tree.updateMatrixWorld(true);
    tree.getWorldScale(this.worldScale);
    const impostor = findImpostor(tree);
    const sourceTexture = impostor?.material?.map;
    if (!impostor || !sourceTexture) return null;

    const presetBatches = this.batches.get(presetId) ?? [];
    let batch = presetBatches.at(-1);
    let createdBatch = false;
    if (!batch || batch.state.entries.length >= batch.state.capacity) {
      batch = this.createBatch(presetId, sourceTexture);
      createdBatch = true;
    }

    try {
      const index = batch.state.entries.length;
      impostor.getWorldPosition(this.worldPosition);
      this.matrix.makeTranslation(
        this.worldPosition.x,
        this.worldPosition.y,
        this.worldPosition.z,
      );
      batch.mesh.setMatrixAt(index, this.matrix);

      const scale = batch.mesh.geometry.getAttribute('treeBillboardScale');
      const billboardSize = calculateTreeBillboardWorldSize(
        impostor.scale,
        this.worldScale,
      );
      scale.setXY(index, billboardSize.x, billboardSize.y);
      const slot = calculateBillboardAtlasSlot(index, batch.atlas.layout);
      batch.atlas.context.drawImage(
        sourceTexture.image,
        slot.column * batch.atlas.cellWidth,
        slot.row * batch.atlas.cellHeight,
        batch.atlas.cellWidth,
        batch.atlas.cellHeight,
      );
      batch.atlas.texture.needsUpdate = true;

      const uv = calculateBillboardAtlasUvTransform(
        slot,
        batch.atlas.canvas.width,
        batch.atlas.canvas.height,
      );
      const uvTransform = batch.mesh.geometry.getAttribute(
        'treeBillboardUvTransform',
      );
      uvTransform.setXYZW(
        index,
        uv.offsetX,
        uv.offsetY,
        uv.scaleX,
        uv.scaleY,
      );
      batch.mesh.geometry.getAttribute('treeBillboardFade').setX(index, 0);
      batch.mesh.geometry.getAttribute('treeBillboardInvert').setX(index, 0);

      releaseSourceTexture(impostor, sourceTexture);
      batch.state.add(tree);
      batch.mesh.count = batch.state.entries.length;
      batch.mesh.instanceMatrix.needsUpdate = true;
      scale.needsUpdate = true;
      uvTransform.needsUpdate = true;
      impostor.visible = false;

      const handle = { batch, index };
      tree.userData.lod.billboardBatch = handle;
      return handle;
    } catch (error) {
      if (createdBatch) this.removeEmptyBatch(presetId, batch);
      throw error;
    }
  }

  setFade(handle, value, invert = false) {
    if (!handle) return;
    if (!handle.batch.state.setFade(handle.index, value, invert)) return;

    const fade = handle.batch.mesh.geometry.getAttribute('treeBillboardFade');
    const inverted = handle.batch.mesh.geometry.getAttribute('treeBillboardInvert');
    fade.setX(handle.index, handle.batch.state.fades[handle.index]);
    inverted.setX(handle.index, handle.batch.state.inverted[handle.index]);
    fade.needsUpdate = true;
    inverted.needsUpdate = true;
    handle.batch.mesh.visible = handle.batch.state.activeCount > 0;
  }

  clear() {
    for (const presetBatches of this.batches.values()) {
      for (const batch of presetBatches) disposeBatch(this.scene, batch);
    }
    this.batches.clear();
  }

  get drawCallCount() {
    return [...this.batches.values()].reduce(
      (total, presetBatches) => total + presetBatches.length,
      0,
    );
  }
}
