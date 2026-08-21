import { SeededRandom } from '../generation/seeded-random.js?v=2.0.0-20260814.2';

/**
 * Where the grass tufts and flower sprigs stand.
 *
 * The reference frames never show bare ground. What reads as a meadow is a
 * carpet of small pale things at the same scale as the leaf cards, sharing the
 * canopy's palette, so the eye finds the same texture underfoot as overhead —
 * and, more usefully, so the ground has something for the depth of field to
 * dissolve. A sharp empty plane in the foreground is the one thing that breaks
 * the diorama read.
 *
 * The scatter is uniform over the disc's *area*, not over its radius: sampling
 * the radius uniformly crowds everything into the middle, which is exactly
 * where the camera stands.
 *
 * Deterministic, like every other layout in the scene, so two frame-rate
 * readings are taken over the same meadow.
 */

export const DEFAULT_MEADOW = Object.freeze({
  enabled: true,
  /** Instances. One draw call carries all of them, so the cost is vertices. */
  count: 3600,
  /** How far the carpet reaches. A forest widens it to its clearing. */
  radius: 24,
  seed: 90210,
  scale: Object.freeze([0.3, 0.62]),
  /** Share of the carpet that draws from the flower palette. */
  flowerShare: 0.3,
  grassColors: Object.freeze(['#8fae62', '#a3bf70', '#7d9c58', '#b6cd86']),
  flowerColors: Object.freeze(['#e9e2f2', '#c9a7d8', '#f0f4e0', '#9db7e6']),
});

export function resolveMeadowSettings(config = {}) {
  const settings = { ...DEFAULT_MEADOW, ...config };

  settings.enabled = config.enabled !== false;
  settings.count = Math.max(0, Math.floor(settings.count));
  settings.radius = Math.max(0, settings.radius);
  settings.flowerShare = Math.min(Math.max(settings.flowerShare, 0), 1);
  settings.grassColors = settings.grassColors.length
    ? settings.grassColors
    : DEFAULT_MEADOW.grassColors;
  settings.flowerColors = settings.flowerColors.length
    ? settings.flowerColors
    : DEFAULT_MEADOW.flowerColors;

  return settings;
}

export function createMeadowScatter(settings) {
  const random = new SeededRandom(settings.seed);
  const instances = [];
  const [minimumScale, maximumScale] = settings.scale;

  for (let index = 0; index < settings.count; index += 1) {
    // sqrt of a uniform sample spreads the tufts evenly over the area.
    const distance = settings.radius * Math.sqrt(random.next());
    const angle = random.range(0, Math.PI * 2);
    const flower = random.next() < settings.flowerShare;
    const palette = flower ? settings.flowerColors : settings.grassColors;

    instances.push({
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      rotationY: random.range(0, Math.PI * 2),
      scale: random.range(minimumScale, maximumScale),
      flower,
      color: palette[Math.min(palette.length - 1, Math.floor(random.next() * palette.length))],
    });
  }

  return instances;
}
