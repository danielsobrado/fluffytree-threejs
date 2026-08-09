import * as THREE from 'three';
import {
  BILLBOARD_BATCH_CAPACITY,
  calculateBillboardAtlasSlot,
  createBillboardAtlasLayout,
} from './tree-billboard-atlas.js';
import { TreeBillboardBatchState } from './tree-billboard-batch-state.js';

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
    this.matrix = new THREE.Matrix4();
  }

  createBatch(presetId, sourceTexture) {
    const atlas = createAtlas(this.capacity, sourceTexture);
    const mesh = new THREE.InstancedMesh(
      createGeometry(this.capacity),
      createMaterial(atlas.texture),
      this.capacity,
    );
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
    presetBatches.push(batch);
    this.batches.set(presetId, presetBatches);
    this.scene.add(mesh);
    return batch;
  }

  register(tree) {
    const presetId = tree.userData.tree.presetId;
    tree.userData.lod.rebuildImpostor?.(tree.rotation.y);
    tree.updateMatrixWorld(true);
    const impostor = findImpostor(tree);
    const sourceTexture = impostor?.material?.map;
    if (!impostor || !sourceTexture) return null;

    const presetBatches = this.batches.get(presetId) ?? [];
    let batch = presetBatches.at(-1);
    if (!batch || batch.state.entries.length >= batch.state.capacity) {
      batch = this.createBatch(presetId, sourceTexture);
    }

    impostor.getWorldPosition(this.worldPosition);
    const index = batch.state.add(tree);
    this.matrix.makeTranslation(
      this.worldPosition.x,
      this.worldPosition.y,
      this.worldPosition.z,
    );
    batch.mesh.setMatrixAt(index, this.matrix);

    const scale = batch.mesh.geometry.getAttribute('treeBillboardScale');
    scale.setXY(index, impostor.scale.x, impostor.scale.y);
    const slot = calculateBillboardAtlasSlot(index, batch.atlas.layout);
    batch.atlas.context.drawImage(
      sourceTexture.image,
      slot.column * batch.atlas.cellWidth,
      slot.row * batch.atlas.cellHeight,
      batch.atlas.cellWidth,
      batch.atlas.cellHeight,
    );
    batch.atlas.texture.needsUpdate = true;

    const uvTransform = batch.mesh.geometry.getAttribute(
      'treeBillboardUvTransform',
    );
    uvTransform.setXYZW(
      index,
      slot.offsetX,
      slot.offsetY,
      slot.scaleX,
      slot.scaleY,
    );
    batch.mesh.geometry.getAttribute('treeBillboardFade').setX(index, 0);
    batch.mesh.geometry.getAttribute('treeBillboardInvert').setX(index, 0);
    batch.mesh.count = batch.state.entries.length;
    batch.mesh.instanceMatrix.needsUpdate = true;
    scale.needsUpdate = true;
    uvTransform.needsUpdate = true;
    impostor.visible = false;
    releaseSourceTexture(impostor, sourceTexture);

    const handle = { batch, index };
    tree.userData.lod.billboardBatch = handle;
    return handle;
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
      for (const { mesh, atlas } of presetBatches) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        atlas.texture.dispose();
      }
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
