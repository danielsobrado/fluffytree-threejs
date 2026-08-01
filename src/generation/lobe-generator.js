import { GENERATION_CONSTANTS } from './generation-constants.js';

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createAnchorLobe(envelope, crown, t, scaleMultiplier, id) {
  const center = envelope.centerAt(t);
  const radius = envelope.radiusAt(t);
  const horizontalScale = Math.max(
    GENERATION_CONSTANTS.minimumLobeScale,
    radius * scaleMultiplier * crown.lobeScaleMultiplier,
  );

  return {
    id,
    position: center,
    scale: {
      x: horizontalScale,
      y: horizontalScale * 0.94,
      z: horizontalScale,
    },
    rotation: { x: 0, y: 0, z: 0 },
    colorMix: clamp(0.38 + t * 0.3, 0, 1),
  };
}

function createColorMix(height, angle, random) {
  const broadPatch = Math.sin(angle * 0.74 + height * 3.2) * 0.5 + 0.5;
  return clamp(height * 0.42 + broadPatch * 0.42 + random.next() * 0.16, 0, 1);
}

export class LobeGenerator {
  generate(preset, envelope, random) {
    const { crown } = preset;
    const lobes = [
      createAnchorLobe(envelope, crown, 0.32, 0.5, 0),
      createAnchorLobe(envelope, crown, 0.59, 0.47, 1),
      createAnchorLobe(envelope, crown, 0.78, 0.38, 2),
    ];

    const generatedCount = Math.max(0, crown.lobeCount - lobes.length);
    const tension = crown.surfaceTension;
    const radialContraction = 1 - tension * 0.34;
    const heightJitterScale = 1 - tension * 0.48;

    for (let index = 0; index < generatedCount; index += 1) {
      const sequence = (index + 0.5) / generatedCount;
      const jitteredHeight = clamp(
        sequence +
          random.signed() *
            (0.32 / Math.max(3, generatedCount)) *
            heightJitterScale,
        0.06,
        0.94,
      );
      const center = envelope.centerAt(jitteredHeight);
      const envelopeRadius = envelope.radiusAt(jitteredHeight);
      const angle = index * GENERATION_CONSTANTS.goldenAngle + random.signed() * 0.3;
      const radialAmount =
        lerp(0.16, crown.radialBias, Math.pow(random.next(), 0.78)) *
        radialContraction;
      const lobeScale = lerp(crown.lobeScale[0], crown.lobeScale[1], random.next());
      const verticalScale = lerp(
        crown.verticalScale[0],
        crown.verticalScale[1],
        random.next(),
      );
      const baseScale = Math.max(
        GENERATION_CONSTANTS.minimumLobeScale,
        envelopeRadius * 0.47 * lobeScale * crown.lobeScaleMultiplier,
      );
      const asymmetryOffset = crown.asymmetry * jitteredHeight;
      const scaleVariation = crown.scaleVariation;

      lobes.push({
        id: lobes.length,
        position: {
          x:
            center.x +
            Math.cos(angle) * envelopeRadius * radialAmount +
            asymmetryOffset * 0.42,
          y:
            center.y +
            random.signed() * crown.height * 0.03 * heightJitterScale,
          z:
            center.z +
            Math.sin(angle) * envelopeRadius * radialAmount +
            random.signed() * asymmetryOffset * 0.22,
        },
        scale: {
          x: baseScale * random.range(1 - scaleVariation, 1 + scaleVariation),
          y: baseScale * verticalScale,
          z: baseScale * random.range(1 - scaleVariation, 1 + scaleVariation),
        },
        rotation: {
          x: random.signed() * 0.16,
          y: random.range(0, Math.PI * 2),
          z: random.signed() * 0.14,
        },
        colorMix: createColorMix(jitteredHeight, angle, random),
      });
    }

    return lobes;
  }
}
