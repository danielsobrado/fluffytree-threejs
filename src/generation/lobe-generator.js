import { GENERATION_CONSTANTS } from './generation-constants.js?v=2.0.0-20260814.2';

function lerp(minimum, maximum, ratio) {
  return minimum + (maximum - minimum) * ratio;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createColorMix(height, angle, random) {
  const patch = Math.sin(angle * 0.74 + height * 3.2) * 0.5 + 0.5;
  return clamp(height * 0.42 + patch * 0.42 + random.next() * 0.16, 0, 1);
}

function allocateLobes(lobeCount, macroCount) {
  const allocations = Array.from({ length: macroCount }, () => 0);
  for (let index = 0; index < lobeCount; index += 1) {
    allocations[index % macroCount] += 1;
  }
  return allocations;
}

function createMacroAnchor(envelope, crown, random, index, count) {
  const sequence = (index + 0.5) / count;
  // A pad crown is short, so its anchors have to reach further towards both
  // ends of the envelope than a tall crown does before the layers read as
  // separate pads rather than one mass.
  const heightRange =
    crown.profile === 'columnar'
      ? [0.08, 0.92]
      : crown.profile === 'vase'
        ? [0.2, 0.9]
        : crown.profile === 'pad'
          ? [0.12, 0.9]
          : [0.2, 0.82];
  const height = clamp(
    lerp(heightRange[0], heightRange[1], sequence) +
      random.signed() * 0.045 * (1 - crown.surfaceTension * 0.35),
    0.08,
    0.94,
  );
  const center = envelope.centerAt(height);
  const radius = envelope.radiusAt(height);
  const angle = index * GENERATION_CONSTANTS.goldenAngle + random.signed() * 0.2;
  const radialRatio =
    crown.clumps.separation *
    lerp(0.58, 0.88, random.next()) *
    lerp(0.82, 1, crown.radialBias);

  return {
    height,
    angle,
    radius,
    position: {
      x: center.x + Math.cos(angle) * radius * radialRatio,
      y: center.y + random.signed() * crown.height * 0.035,
      z: center.z + Math.sin(angle) * radius * radialRatio,
    },
  };
}

function createSubClump(preset, random, macro, macroId, subIndex, subCount, id) {
  const { crown } = preset;
  const lobeScale = lerp(crown.lobeScale[0], crown.lobeScale[1], random.next());
  const verticalScale = lerp(
    crown.verticalScale[0],
    crown.verticalScale[1],
    random.next(),
  );
  const baseScale = Math.max(
    GENERATION_CONSTANTS.minimumLobeScale,
    macro.radius * 0.43 * lobeScale * crown.lobeScaleMultiplier,
  );
  const localAngle =
    macro.angle + subIndex * GENERATION_CONSTANTS.goldenAngle + random.signed() * 0.3;
  const localRatio =
    subIndex === 0
      ? 0
      : Math.sqrt(subIndex / Math.max(1, subCount - 1)) *
        (0.42 + crown.clumps.silhouetteBreakup * 1.2) *
        baseScale;
  const verticalBreakup =
    subIndex === 0
      ? 0
      : random.signed() *
        baseScale *
        (0.24 + crown.clumps.silhouetteBreakup * 0.55);
  const scaleVariation = crown.scaleVariation + crown.clumps.silhouetteBreakup * 0.08;

  return {
    id,
    macroClumpId: macroId,
    position: {
      x: macro.position.x + Math.cos(localAngle) * localRatio,
      y: macro.position.y + verticalBreakup,
      z: macro.position.z + Math.sin(localAngle) * localRatio,
    },
    scale: {
      x: baseScale * random.range(1 - scaleVariation, 1 + scaleVariation),
      y: baseScale * verticalScale,
      z: baseScale * random.range(1 - scaleVariation, 1 + scaleVariation),
    },
    rotation: {
      x: random.signed() * 0.2,
      y: random.range(0, Math.PI * 2),
      z: random.signed() * 0.18,
    },
    colorMix: createColorMix(macro.height, localAngle, random),
  };
}

export class LobeGenerator {
  generate(preset, envelope, random) {
    const { crown } = preset;
    const macroCount = Math.min(crown.lobeCount, crown.clumps.macroCount);
    const allocations = allocateLobes(crown.lobeCount, macroCount);
    const lobes = [];

    for (let macroId = 0; macroId < macroCount; macroId += 1) {
      const macro = createMacroAnchor(envelope, crown, random, macroId, macroCount);
      const subCount = allocations[macroId];

      for (let subIndex = 0; subIndex < subCount; subIndex += 1) {
        lobes.push(
          createSubClump(
            preset,
            random,
            macro,
            macroId,
            subIndex,
            subCount,
            lobes.length,
          ),
        );
      }
    }

    return lobes;
  }
}
