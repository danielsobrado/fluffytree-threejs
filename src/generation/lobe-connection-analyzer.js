import {
  lobeOverlapRatio,
  lobeRadiusTowards,
  normalizeVector,
} from './lobe-geometry.js?v=2.0.0-20260814.2';

function negate(vector) {
  return { x: -vector.x, y: -vector.y, z: -vector.z };
}

function freezeVector(vector) {
  return Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
}

export class LobeConnectionAnalyzer {
  analyze(lobes) {
    const connections = [];

    for (let leftIndex = 0; leftIndex < lobes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < lobes.length; rightIndex += 1) {
        const left = lobes[leftIndex];
        const right = lobes[rightIndex];
        const overlapRatio = lobeOverlapRatio(left, right);
        if (overlapRatio > 1) continue;

        const delta = {
          x: right.position.x - left.position.x,
          y: right.position.y - left.position.y,
          z: right.position.z - left.position.z,
        };
        const distance = Math.hypot(delta.x, delta.y, delta.z);
        const direction = normalizeVector(delta);

        connections.push(
          Object.freeze({
            leftLobeId: left.id,
            rightLobeId: right.id,
            leftMacroClumpId: left.macroClumpId,
            rightMacroClumpId: right.macroClumpId,
            sameMacro: left.macroClumpId === right.macroClumpId,
            overlapRatio,
            distance,
            verticalAlignment:
              distance <= Number.EPSILON ? 1 : Math.abs(delta.y) / distance,
            direction: freezeVector(direction),
            leftRadius: lobeRadiusTowards(left, direction),
            rightRadius: lobeRadiusTowards(right, negate(direction)),
          }),
        );
      }
    }

    connections.sort(
      (left, right) =>
        left.leftLobeId - right.leftLobeId ||
        left.rightLobeId - right.rightLobeId,
    );
    return Object.freeze(connections);
  }
}
