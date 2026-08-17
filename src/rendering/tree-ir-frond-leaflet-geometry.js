import * as THREE from 'three';
import {
  appendTreeIrFrondVertex,
  createTreeIrFrondBuffers,
  createTreeIrFrondSampler,
  finishTreeIrFrondGeometry,
  offsetTreeIrFrondPoint,
  setTreeIrFrondColor,
  treeIrFrondWindPhase,
} from './tree-ir-frond-geometry-common.js';

function appendRachis(
  treeIr,
  site,
  frond,
  segmentCount,
  rachisWidthRatio,
  buffers,
) {
  const sample = createTreeIrFrondSampler(site, frond);
  const color = new THREE.Color();
  const phase = treeIrFrondWindPhase(treeIr, site);
  const firstVertex = buffers.positions.length / 3;
  const halfWidth = Math.max(0.006, frond.width * rachisWidthRatio * 0.5);

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const center = sample(t);
    setTreeIrFrondColor(color, treeIr, site, t, -0.08);
    appendTreeIrFrondVertex(
      buffers,
      offsetTreeIrFrondPoint(center, -halfWidth),
      color,
      t,
      phase,
    );
    appendTreeIrFrondVertex(
      buffers,
      offsetTreeIrFrondPoint(center, halfWidth),
      color,
      t,
      phase,
    );

    if (index >= segmentCount) continue;
    const left = firstVertex + index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;
    buffers.indices.push(left, nextLeft, right, right, nextLeft, nextRight);
  }
}

function appendLeaflets(
  treeIr,
  site,
  frond,
  segmentCount,
  style,
  buffers,
) {
  const sample = createTreeIrFrondSampler(site, frond);
  const color = new THREE.Color();
  const phase = treeIrFrondWindPhase(treeIr, site);
  const step = 1 / segmentCount;
  const rachisHalfWidth = Math.max(
    0.006,
    frond.width * style.rachisWidthRatio * 0.5,
  );

  for (let index = 0; index < segmentCount; index += 1) {
    const t = (index + 0.5) * step;
    const halfSpan = step * style.leafletWidthRatio * 0.5;
    const beforeT = Math.max(0, t - halfSpan);
    const afterT = Math.min(1, t + halfSpan);
    const before = sample(beforeT);
    const after = sample(afterT);
    const center = sample(t);

    for (const sign of [-1, 1]) {
      setTreeIrFrondColor(
        color,
        treeIr,
        site,
        t,
        sign < 0 ? -0.035 : 0.035,
      );
      const first = appendTreeIrFrondVertex(
        buffers,
        offsetTreeIrFrondPoint(before, sign * rachisHalfWidth),
        color,
        beforeT,
        phase,
      );
      const second = appendTreeIrFrondVertex(
        buffers,
        offsetTreeIrFrondPoint(after, sign * rachisHalfWidth),
        color,
        afterT,
        phase,
      );
      const tip = appendTreeIrFrondVertex(
        buffers,
        offsetTreeIrFrondPoint(
          center,
          sign * center.halfWidth * style.leafletLengthRatio,
        ),
        color,
        t,
        phase,
      );
      if (sign < 0) buffers.indices.push(first, tip, second);
      else buffers.indices.push(first, second, tip);
    }
  }
}

export function createTreeIrFrondLeafletGeometry(
  treeIr,
  site,
  frond,
  segmentCount,
  style,
) {
  const buffers = createTreeIrFrondBuffers();
  appendRachis(
    treeIr,
    site,
    frond,
    segmentCount,
    style.rachisWidthRatio,
    buffers,
  );
  appendLeaflets(treeIr, site, frond, segmentCount, style, buffers);
  return finishTreeIrFrondGeometry(buffers);
}
