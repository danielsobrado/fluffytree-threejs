import { GENERATION_CONSTANTS } from './generation-constants.js';

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createAnchorLobe(envelope, t, scaleMultiplier, id) {
  const center = envelope.centerAt(t);
  const radius = envelope.radiusAt(t);
  const horizontalScale = Math.max(
    GENERATION_CONSTANTS.minimumLobeScale,
    radius * scaleMultiplier,
  );

  return {
    id,
    position: center,
    scale: {
      x: horizontalScale,
      y: horizontalScale * 0.92,
      z: horizontalScale,
    },
    rotation: { x: 0, y: 0, z: 0 },
    colorMix: 0.52,
  };
}

export class LobeGenerator {
  generate(preset, envelope, random) {
    const { crown } = preset;
    const lobes = [
      createAnchorLobe(envelope, 0.34, 0.52, 0),
      createAnchorLobe(envelope, 0.62, 0.48, 1),
    ];

    const generatedCount = Math.max(0, crown.lobeCount - lobes.length);

    for (let index = 0; index < generatedCount; index += 1) {
      const sequence = (index + 0.5) / generatedCount;
      const jitteredHeight = clamp(
        sequence + random.signed() * (0.32 / Math.max(3, generatedCount)),
        0.06,
        0.94,
      );
      const center = envelope.centerAt(jitteredHeight);
      const envelopeRadius = envelope.radiusAt(jitteredHeight);
      const angle = index * GENERATION_CONSTANTS.goldenAngle + random.signed() * 0.34;
      const radialAmount = lerp(0.2, crown.radialBias, Math.pow(random.next(), 0.72));
      const lobeScale = lerp(crown.lobeScale[0], crown.lobeScale[1], random.next());
      const verticalScale = lerp(
        crown.verticalScale[0],
        crown.verticalScale[1],
        random.next(),
      );
      const baseScale = Math.max(
        GENERATION_CONSTANTS.minimumLobeScale,
        envelopeRadius * 0.47 * lobeScale,
      );
      const asymmetryOffset = crown.asymmetry * jitteredHeight;

      lobes.push({
        id: lobes.length,
        position: {
          x:
            center.x +
            Math.cos(angle) * envelopeRadius * radialAmount +
            asymmetryOffset * 0.45,
          y: center.y + random.signed() * crown.height * 0.035,
          z:
            center.z +
            Math.sin(angle) * envelopeRadius * radialAmount +
            random.signed() * asymmetryOffset * 0.25,
        },
        scale: {
          x: baseScale * random.range(0.88, 1.12),
          y: baseScale * verticalScale,
          z: baseScale * random.range(0.88, 1.12),
        },
        rotation: {
          x: random.signed() * 0.22,
          y: random.range(0, Math.PI * 2),
          z: random.signed() * 0.2,
        },
        colorMix: random.next(),
      });
    }

    return lobes;
  }
}
