import { blendPaletteToSeason } from '../rendering/seasonal-palette.js';

/**
 * The seasons, as a modifier over whatever scene is on screen.
 *
 * A season is not a different layout and not a different preset family. Snow
 * falls on everything standing outside, and autumn turns every broadleaf in the
 * wood at once, so a season is the same garden or the same forest with a
 * different rig over it and a different colour on every crown in it. That is
 * why this applies to the preset map rather than swapping the layout: a bonsai
 * in winter is the bonsai, under snow.
 *
 * Four things move, and they are the four that carry a season:
 *
 * 1. **The canopy palette**, mixed toward the season's own ramp rather than
 *    replaced by it, so each preset keeps the value structure the shader's
 *    palette texture depends on. See `seasonal-palette.js`.
 * 2. **The light rig.** A season is mostly its light: the sun's colour and
 *    height, and what the ground bounces back. Snow bounces almost as much as
 *    the sky, which is why shadows on it are pale blue.
 * 3. **The ground and the carpet.** Grass, dry grass, or dead grass through
 *    snow, with the flowers that belong to each.
 * 4. **Snow**, which only winter has, through the foliage shader's own term.
 *
 * A preset can opt out with `foliage.seasonal: false`. `gladeFrost` and
 * `gladeRust` are authored *as* seasons, and a season has no business
 * overruling a preset that has already made that choice.
 *
 * Derived from the configured scene the way the forest is, rather than being
 * four copies of `scene.yaml`, so a change to the shared lighting, LOD or
 * camera settings reaches every season.
 */

export const SUMMER_SEASON = 'summer';

const DEFINITIONS = Object.freeze({
  spring: Object.freeze({
    id: 'spring',
    label: 'Spring',
    scene: Object.freeze({
      backgroundColor: '#d6e9ea',
      fogColor: '#d6e9ea',
      groundColor: '#8fb35f',
    }),
    lighting: Object.freeze({
      hemisphereSkyColor: '#e2f0ff',
      hemisphereGroundColor: '#8aa25c',
      hemisphereIntensity: 2.2,
      sunColor: '#fff2cf',
      sunIntensity: 2.3,
      // Higher and softer than summer's: spring light is bright but thin.
      sunPosition: Object.freeze([12, 15, 8]),
    }),
    meadow: Object.freeze({
      count: 4200,
      flowerShare: 0.44,
      grassColors: Object.freeze(['#8fb85e', '#a6cc6e', '#7ba854', '#bcd98a']),
      flowerColors: Object.freeze(['#f6eef6', '#e7bcd9', '#fbf7dc', '#b6cdf0']),
    }),
    foliage: Object.freeze({
      // New growth: yellower and lighter than the summer it becomes.
      ramp: Object.freeze(['#4f7442', '#7fa752', '#b4cd72', '#e6efbc']),
      paletteBlend: 0.4,
    }),
  }),
  summer: Object.freeze({
    id: 'summer',
    label: 'Summer',
    // Summer is the configuration itself. Nothing to apply.
  }),
  autumn: Object.freeze({
    id: 'autumn',
    label: 'Autumn',
    scene: Object.freeze({
      backgroundColor: '#d8ddda',
      fogColor: '#d8ddda',
      groundColor: '#93924f',
    }),
    lighting: Object.freeze({
      hemisphereSkyColor: '#dde8f2',
      hemisphereGroundColor: '#8a7c4c',
      hemisphereIntensity: 2.0,
      sunColor: '#ffdca4',
      sunIntensity: 2.4,
      // Low and long. Autumn in the reference is carried by raking light more
      // than by the leaf colour.
      sunPosition: Object.freeze([16, 8, 6]),
    }),
    lightPools: Object.freeze({ warmth: 0.75, amplitude: 0.07 }),
    meadow: Object.freeze({
      count: 3200,
      flowerShare: 0.12,
      grassColors: Object.freeze(['#a89a5c', '#bcae6f', '#8f8449', '#cfc186']),
      flowerColors: Object.freeze(['#e8dcc0', '#d9b98a']),
    }),
    foliage: Object.freeze({
      ramp: Object.freeze(['#6b3520', '#a85a2c', '#cf8442', '#eab97a']),
      paletteBlend: 0.72,
    }),
  }),
  winter: Object.freeze({
    id: 'winter',
    label: 'Winter',
    scene: Object.freeze({
      // Pale and milky rather than blue. A winter sky in the reference is
      // closer to the snow than to a summer sky, which is what flattens the
      // distance into the tree line.
      backgroundColor: '#dde7ef',
      fogColor: '#dde7ef',
      groundColor: '#e4eaef',
    }),
    lighting: Object.freeze({
      hemisphereSkyColor: '#e8f1ff',
      // Snow is the brightest thing in the scene, so the bounce off the ground
      // goes from a warm grass green to almost as bright as the sky. Pale blue
      // shadows on snow come from this, without touching a single material.
      hemisphereGroundColor: '#c6d3dd',
      hemisphereIntensity: 2.45,
      sunColor: '#fff1d8',
      sunIntensity: 2.15,
      sunPosition: Object.freeze([14, 9, 7]),
    }),
    lightPools: Object.freeze({
      // Snow lies more evenly than grass grows, and where the sun catches it, it
      // does not warm — it only brightens, and it is already near white.
      amplitude: 0.035,
      warmth: 0.08,
    }),
    contactShadow: Object.freeze({
      // Snow bounces light back into the shade under a crown, so the pool that
      // grounds a tree on grass is too heavy on snow.
      strength: 0.3,
    }),
    meadow: Object.freeze({
      // Bent dead grass through snow, not a meadow. Thinner, shorter, and the
      // flowers are the first thing a winter takes.
      count: 1900,
      scale: Object.freeze([0.22, 0.44]),
      flowerShare: 0.06,
      grassColors: Object.freeze(['#bfc3b6', '#a9a493', '#d2d6cd', '#93907f']),
      flowerColors: Object.freeze(['#f2f6fa', '#dfe6ee']),
    }),
    foliage: Object.freeze({
      // Desaturated before the snow goes on. A summer green showing through the
      // gaps in a laden crown reads wrong however white the caps are.
      ramp: Object.freeze(['#43514f', '#63726c', '#8b968c', '#c2ccc2']),
      paletteBlend: 0.5,
      snow: Object.freeze({
        snowColor: '#f3f7fb',
        snowStrength: 0.68,
        // Laden rather than dusted: snow carries well past the top of each
        // puff, which is what the reference's crowns look like.
        snowSharpness: 1.7,
      }),
    }),
  }),
});

export const SEASONS = Object.freeze(
  Object.values(DEFINITIONS).map((season) =>
    Object.freeze({ id: season.id, label: season.label }),
  ),
);

export function resolveSeason(id) {
  return DEFINITIONS[id] ? id : SUMMER_SEASON;
}

export function requestedSeason(search) {
  const query =
    search ??
    (typeof window === 'undefined' ? '' : window.location?.search ?? '');

  return resolveSeason(new URLSearchParams(query).get('season'));
}

/** The scene, dressed for the season. Summer is the configuration itself. */
export function applySeasonToScene(config, id) {
  const season = DEFINITIONS[resolveSeason(id)];
  if (!season.scene) return config;

  return {
    ...config,
    scene: {
      ...config.scene,
      ...season.scene,
      lightPools: { ...config.scene.lightPools, ...season.lightPools },
      contactShadow: {
        ...config.scene.contactShadow,
        ...season.contactShadow,
      },
      meadow: { ...config.scene.meadow, ...season.meadow },
    },
    lighting: { ...config.lighting, ...season.lighting },
  };
}

export function applySeasonToPreset(preset, id) {
  const season = DEFINITIONS[resolveSeason(id)];
  if (!season.foliage || preset.foliage.seasonal === false) return preset;
  return turn(preset, season.foliage);
}

/** The presets, turned for the season, except those that opted out. */
export function applySeasonToPresets(presets, id) {
  const season = DEFINITIONS[resolveSeason(id)];
  if (!season.foliage) return presets;

  const seasonal = new Map();
  for (const [presetId, preset] of presets) {
    seasonal.set(presetId, applySeasonToPreset(preset, id));
  }

  return seasonal;
}

function turn(preset, foliage) {
  return Object.freeze({
    ...preset,
    foliage: Object.freeze({
      ...preset.foliage,
      ...foliage.snow,
      palette: Object.freeze(
        blendPaletteToSeason(
          preset.foliage.palette,
          foliage.ramp,
          foliage.paletteBlend,
        ),
      ),
    }),
  });
}
