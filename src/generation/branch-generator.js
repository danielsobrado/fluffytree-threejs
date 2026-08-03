import { GENERATION_CONSTANTS } from './generation-constants.js';
import { lobeRadiusTowards, normalizeVector } from './lobe-geometry.js';
import { createTrunkStyle } from './trunk-style.js';

function lerp(minimum, maximum, ratio) {
  return minimum + (maximum - minimum) * ratio;
}

function distanceSquared(left, right) {
  return (
    (left.x - right.x) ** 2 +
    (left.y - right.y) ** 2 +
    (left.z - right.z) ** 2
  );
}

function distanceFromAxis(lobe) {
  return Math.hypot(lobe.position.x, lobe.position.z);
}

function createTrunkPoints(preset, random, style) {
  const { trunk, crown } = preset;
  const phase = random.range(0, Math.PI * 2);
  const apexHeight = crown.baseHeight + crown.height * 0.66;
  const points = [];

  for (let index = 0; index <= trunk.segments; index += 1) {
    const t = index / trunk.segments;
    // The style decides how the rise is distributed; the exponent is positive
    // for every style, so the sweep stays strictly ascending.
    const rise = style.heightPower === 1 ? t : Math.pow(t, style.heightPower);
    const offset = style.displace(t);
    const gnarl =
      Math.sin(t * Math.PI * 2.4 + phase) *
      trunk.branching.gnarl *
      trunk.baseRadius *
      Math.sin(t * Math.PI);
    const twist = phase + t * Math.PI * 2 * trunk.branching.twist;
    // Style, lean and gnarl all push the trunk off its axis, and any of them
    // can tilt the base enough to lift the swept tube's first ring out of the
    // ground. The ramp holds all three back until the trunk has cleared the
    // nebari; it is a flat 1 for the historic style.
    const ramp = style.rampAt(t);

    points.push({
      x: (crown.lean[0] * t + offset.x + Math.cos(twist) * gnarl) * ramp,
      y: lerp(0, apexHeight, rise),
      z: (crown.lean[1] * t + offset.z + Math.sin(twist) * gnarl) * ramp,
      radius: lerp(
        trunk.baseRadius,
        trunk.topRadius,
        Math.pow(t, style.taperPower),
      ),
    });
  }

  return points;
}

function findTrunkAttachment(points, targetY) {
  return points.reduce((best, point) =>
    Math.abs(point.y - targetY) < Math.abs(best.y - targetY) ? point : best,
  );
}

function selectPrimaryTargets(lobes, count) {
  const byMacro = new Map();
  for (const lobe of lobes) {
    const current = byMacro.get(lobe.macroClumpId);
    if (!current || distanceFromAxis(lobe) > distanceFromAxis(current)) {
      byMacro.set(lobe.macroClumpId, lobe);
    }
  }

  const targets = [...byMacro.values()].sort(
    (left, right) => distanceFromAxis(right) - distanceFromAxis(left),
  );
  if (targets.length < count) {
    for (const lobe of [...lobes].sort(
      (left, right) => distanceFromAxis(right) - distanceFromAxis(left),
    )) {
      if (!targets.includes(lobe)) targets.push(lobe);
      if (targets.length >= count) break;
    }
  }
  return targets.slice(0, count);
}

function createEmbeddedEndpoint(start, lobe, insertionDepth) {
  const towardStart = normalizeVector({
    x: start.x - lobe.position.x,
    y: start.y - lobe.position.y,
    z: start.z - lobe.position.z,
  });
  const distance = lobeRadiusTowards(lobe, towardStart) * insertionDepth;
  return {
    x: lobe.position.x + towardStart.x * distance,
    y: lobe.position.y + towardStart.y * distance,
    z: lobe.position.z + towardStart.z * distance,
  };
}

function createControls(start, end, random, settings, order) {
  const direction = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  });
  const length = Math.sqrt(distanceSquared(start, end));
  const side = normalizeVector({ x: -direction.z, y: 0.15, z: direction.x });
  const upward = settings.upwardBias * length * (0.14 + order * 0.025);
  const gnarl = settings.gnarl * length * 0.12;
  const sideOffset = random.signed() * gnarl;

  return [
    {
      x: lerp(start.x, end.x, 0.34) + side.x * sideOffset,
      y: lerp(start.y, end.y, 0.34) + upward,
      z: lerp(start.z, end.z, 0.34) + side.z * sideOffset,
    },
    {
      x: lerp(start.x, end.x, 0.72) - side.x * sideOffset * 0.45,
      y: lerp(start.y, end.y, 0.72) + upward * 0.58,
      z: lerp(start.z, end.z, 0.72) - side.z * sideOffset * 0.45,
    },
  ];
}

function pointNearTip(branch, ratio = 0.72) {
  const left = branch.points[branch.points.length - 2];
  const right = branch.points.at(-1);
  return {
    x: lerp(left.x, right.x, ratio),
    y: lerp(left.y, right.y, ratio),
    z: lerp(left.z, right.z, ratio),
  };
}

function createBranch({ id, parentId, order, start, target, random, preset, exposed = false }) {
  const settings = preset.trunk.branching;
  const insertionDepth = exposed
    ? lerp(1.04, 1.18, random.next())
    : GENERATION_CONSTANTS.branchInsertionDepth;
  const end = createEmbeddedEndpoint(start, target, insertionDepth);
  const controls = createControls(start, end, random, settings, order);
  const parentScale = settings.radiusDecay ** Math.max(0, order - 1);
  const startRadius = Math.max(
    0.035,
    preset.trunk.baseRadius * 0.68 * parentScale,
  );
  const endRadius = Math.max(0.018, startRadius * lerp(0.22, 0.34, random.next()));

  return {
    id,
    parentId,
    order,
    macroClumpId: target.macroClumpId,
    targetLobeId: target.id,
    exposed,
    points: [{ x: start.x, y: start.y, z: start.z }, ...controls, end],
    startRadius,
    endRadius,
  };
}

function selectParent(branches, target, depth, childCounts, maximumChildren) {
  return branches
    .filter(
      (branch) =>
        branch.order < depth &&
        (childCounts.get(branch.id) ?? 0) < maximumChildren,
    )
    .sort((left, right) => {
      const leftMacro = left.macroClumpId === target.macroClumpId ? 0 : 1;
      const rightMacro = right.macroClumpId === target.macroClumpId ? 0 : 1;
      if (leftMacro !== rightMacro) return leftMacro - rightMacro;
      const orderDifference = left.order - right.order;
      if (orderDifference !== 0) return orderDifference;
      return (
        distanceSquared(left.points.at(-1), target.position) -
        distanceSquared(right.points.at(-1), target.position)
      );
    })[0];
}

function attachLobes(lobes, branches) {
  return lobes.map((lobe) => {
    const exact = branches.findLast((branch) => branch.targetLobeId === lobe.id);
    const nearest =
      exact ??
      [...branches].sort(
        (left, right) =>
          distanceSquared(left.points.at(-1), lobe.position) -
          distanceSquared(right.points.at(-1), lobe.position),
      )[0];
    return { ...lobe, branchId: nearest?.id ?? null };
  });
}

export class BranchGenerator {
  generate(preset, sourceLobes, random) {
    const style = createTrunkStyle(preset.trunk);
    const trunkPoints = createTrunkPoints(preset, random, style);
    const settings = preset.trunk.branching;
    const primaryTargets = selectPrimaryTargets(sourceLobes, settings.primaryCount);
    const branches = [];

    for (const target of primaryTargets) {
      const attachmentHeight = Math.max(
        preset.crown.baseHeight * 0.62,
        target.position.y - preset.crown.height * random.range(0.28, 0.44),
      );
      const start = findTrunkAttachment(trunkPoints, attachmentHeight);
      branches.push(
        createBranch({
          id: branches.length,
          parentId: null,
          order: 1,
          start,
          target,
          random,
          preset,
        }),
      );
    }

    const primaryIds = new Set(primaryTargets.map((lobe) => lobe.id));
    const childCounts = new Map();
    const maximumChildren = Math.round(settings.childCount[1]);
    for (const target of sourceLobes.filter((lobe) => !primaryIds.has(lobe.id))) {
      const parent = selectParent(
        branches,
        target,
        settings.depth,
        childCounts,
        maximumChildren,
      );
      const order = Math.min(settings.depth, (parent?.order ?? 1) + 1);
      const start = parent ? pointNearTip(parent, random.range(0.48, 0.78)) : trunkPoints.at(-2);
      branches.push(
        createBranch({
          id: branches.length,
          parentId: parent?.id ?? null,
          order,
          start,
          target,
          random,
          preset,
        }),
      );
      if (parent) childCounts.set(parent.id, (childCounts.get(parent.id) ?? 0) + 1);
    }

    for (const parent of [...branches]) {
      if (parent.order >= settings.depth || random.next() > settings.exposedTipRatio) {
        continue;
      }
      const target = sourceLobes[parent.targetLobeId];
      branches.push(
        createBranch({
          id: branches.length,
          parentId: parent.id,
          order: Math.min(settings.depth, parent.order + 1),
          start: pointNearTip(parent, random.range(0.58, 0.84)),
          target,
          random,
          preset,
          exposed: true,
        }),
      );
    }

    return {
      trunk: {
        points: trunkPoints.map(({ x, y, z }) => ({ x, y, z })),
        startRadius: preset.trunk.baseRadius,
        endRadius: preset.trunk.topRadius,
        flare: preset.trunk.flare,
        taperPower: style.taperPower,
        nebari: Number(preset.trunk.nebari ?? 1),
        style: style.id,
      },
      branches: Object.freeze(branches),
      lobes: Object.freeze(attachLobes(sourceLobes, branches)),
    };
  }
}
