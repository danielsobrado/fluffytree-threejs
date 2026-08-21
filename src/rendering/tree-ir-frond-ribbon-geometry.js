import * as THREE from 'three';
import {
  appendTreeIrFrondVertex,
  createTreeIrFrondBuffers,
  createTreeIrFrondSampler,
  finishTreeIrFrondGeometry,
  offsetTreeIrFrondPoint,
  setTreeIrFrondColor,
  treeIrFrondWindPhase,
} from './tree-ir-frond-geometry-common.js?v=2.0.0-20260814.2';

export function createTreeIrFrondRibbonGeometry(
  treeIr,
  site,
  frond,
  segmentCount,
) {
  const sample = createTreeIrFrondSampler(site, frond);
  const buffers = createTreeIrFrondBuffers();
  const color = new THREE.Color();
  const phase = treeIrFrondWindPhase(treeIr, site);

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const center = sample(t);
    setTreeIrFrondColor(color, treeIr, site, t);
    appendTreeIrFrondVertex(
      buffers,
      offsetTreeIrFrondPoint(center, -center.halfWidth),
      color,
      t,
      phase,
    );
    appendTreeIrFrondVertex(
      buffers,
      offsetTreeIrFrondPoint(center, center.halfWidth),
      color,
      t,
      phase,
    );

    if (index >= segmentCount) continue;
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;
    buffers.indices.push(left, nextLeft, right, right, nextLeft, nextRight);
  }

  return finishTreeIrFrondGeometry(buffers);
}
