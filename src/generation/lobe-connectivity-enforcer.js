import { GENERATION_CONSTANTS } from './generation-constants.js?v=2.0.0-20260814.2';
import {
  lobeOverlapRatio,
  lobeRadiusTowards,
  normalizeVector,
} from './lobe-geometry.js?v=2.0.0-20260814.2';

function cloneLobes(lobes) {
  return lobes.map((lobe) => ({
    ...lobe,
    position: { ...lobe.position },
    scale: { ...lobe.scale },
    rotation: { ...lobe.rotation },
  }));
}

function findComponents(lobes) {
  const adjacency = Array.from({ length: lobes.length }, () => []);

  for (let left = 0; left < lobes.length; left += 1) {
    for (let right = left + 1; right < lobes.length; right += 1) {
      if (lobeOverlapRatio(lobes[left], lobes[right]) <= 1) {
        adjacency[left].push(right);
        adjacency[right].push(left);
      }
    }
  }

  const visited = new Set();
  const components = [];

  for (let index = 0; index < lobes.length; index += 1) {
    if (visited.has(index)) continue;

    const component = [];
    const pending = [index];
    visited.add(index);

    while (pending.length > 0) {
      const current = pending.pop();
      component.push(current);

      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function selectMainComponent(components) {
  return [...components].sort((left, right) => {
    const sizeDifference = right.length - left.length;
    return sizeDifference !== 0
      ? sizeDifference
      : Math.min(...left) - Math.min(...right);
  })[0];
}

function findClosestPair(lobes, mainComponent, detachedComponents) {
  let closest = null;

  for (const detached of detachedComponents) {
    for (const mainIndex of mainComponent) {
      for (const detachedIndex of detached) {
        const ratio = lobeOverlapRatio(
          lobes[mainIndex],
          lobes[detachedIndex],
        );

        if (!closest || ratio < closest.ratio) {
          closest = { ratio, mainIndex, detachedIndex, detached };
        }
      }
    }
  }

  return closest;
}

function connectComponent(lobes, connection) {
  const mainLobe = lobes[connection.mainIndex];
  const detachedLobe = lobes[connection.detachedIndex];
  const towardMain = normalizeVector({
    x: mainLobe.position.x - detachedLobe.position.x,
    y: mainLobe.position.y - detachedLobe.position.y,
    z: mainLobe.position.z - detachedLobe.position.z,
  });
  const distance = Math.hypot(
    mainLobe.position.x - detachedLobe.position.x,
    mainLobe.position.y - detachedLobe.position.y,
    mainLobe.position.z - detachedLobe.position.z,
  );
  const desiredDistance =
    GENERATION_CONSTANTS.lobeConnectivityTargetOverlap *
    (lobeRadiusTowards(mainLobe, {
      x: -towardMain.x,
      y: -towardMain.y,
      z: -towardMain.z,
    }) + lobeRadiusTowards(detachedLobe, towardMain));
  const shiftDistance = Math.max(0, distance - desiredDistance);

  for (const index of connection.detached) {
    lobes[index].position.x += towardMain.x * shiftDistance;
    lobes[index].position.y += towardMain.y * shiftDistance;
    lobes[index].position.z += towardMain.z * shiftDistance;
  }
}

export class LobeConnectivityEnforcer {
  enforce(sourceLobes) {
    const lobes = cloneLobes(sourceLobes);
    const iterationLimit =
      lobes.length * GENERATION_CONSTANTS.connectivityIterationMultiplier;

    for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
      const components = findComponents(lobes);

      if (components.length <= 1) {
        return lobes;
      }

      const mainComponent = selectMainComponent(components);
      const detachedComponents = components.filter(
        (component) => component !== mainComponent,
      );
      const connection = findClosestPair(
        lobes,
        mainComponent,
        detachedComponents,
      );

      if (!connection) break;
      connectComponent(lobes, connection);
    }

    throw new Error('Unable to create a connected foliage crown.');
  }
}
