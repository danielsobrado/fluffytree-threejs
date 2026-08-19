import { SeededRandom } from '../generation/seeded-random.js';

/**
 * A walkable forest laid out around a clearing.
 *
 * The garden layout is a dozen hand-placed trees meant to be orbited. A forest
 * asks the other half of the question: what the same trees look like, and cost,
 * when there are hundreds of them and the camera stands underneath the canopy.
 *
 * The layout is a jittered grid rather than a hand list, thinned by distance
 * from the middle so the clearing stays open, the tree line around it reads as
 * a wall, and the outer rim fades out instead of ending on a hard circle. Trees
 * are emitted nearest first, because the build queue drains in order and the
 * clearing is where the camera starts.
 *
 * Nothing here is random at runtime: the same size and seed produce the same
 * forest, so one frame-rate reading can be compared with the next.
 */

// Metres over which the tree line thickens from the edge of the clearing. Short
// enough that the clearing has a wall around it rather than a gradient.
const TREE_LINE_BAND = 7;
// Fraction of the radius the outer thinning is spread over.
const RIM_BAND_RATIO = 0.42;
// Height bands, in metres, that decide what a cell is allowed to plant.
const CANOPY_HEIGHT = 5.5;
const UNDERSTORY_HEIGHT = 2.5;
const CANOPY_SHARE = 0.56;
const UNDERSTORY_SHARE = 0.19;
// Bushes standing in the meadow itself, so the clearing is not bare grass.
const CLEARING_BUSH_COUNT = 7;
// Beyond the hero radius a tree never renders its near levels, so it never
// generates the surface samples they need. The far rings are the bulk of a
// large forest and they are only ever seen as cores or impostors.
const FAR_MINIMUM_LOD = 2;
const SHADOW_EXTENT = 44;

export const DEFAULT_FOREST_SIZE = 'glade';
export const FOREST_SEED = 20260805;

export const FOREST_SIZES = Object.freeze({
  glade: Object.freeze({
    id: 'glade',
    label: 'Small glade',
    radius: 82,
    clearingRadius: 12,
    spacing: 6.6,
    fill: 0.42,
    rimDensity: 0.45,
    heroRadius: 82,
    fogNear: 26,
    fogFar: 98,
  }),
  woodland: Object.freeze({
    id: 'woodland',
    label: 'Woodland',
    radius: 140,
    clearingRadius: 14,
    spacing: 7.2,
    fill: 0.3,
    rimDensity: 0.4,
    heroRadius: 96,
    fogNear: 30,
    fogFar: 152,
  }),
  deepForest: Object.freeze({
    id: 'deepForest',
    label: 'Deep forest',
    radius: 230,
    clearingRadius: 16,
    spacing: 8,
    fill: 0.21,
    rimDensity: 0.34,
    heroRadius: 104,
    fogNear: 34,
    fogFar: 232,
  }),
});

export function isForestSceneRequested(search = window.location.search) {
  return new URLSearchParams(search).get('scene') === 'forest';
}

export function resolveForestSize(id) {
  return FOREST_SIZES[id] ?? FOREST_SIZES[DEFAULT_FOREST_SIZE];
}

function smoothstep(value) {
  const ratio = Math.min(1, Math.max(0, value));
  return ratio * ratio * (3 - 2 * ratio);
}

/** How likely a cell at this distance is to hold a tree. */
function densityAt(distance, size) {
  if (distance <= size.clearingRadius) return 0;

  const treeLine = smoothstep((distance - size.clearingRadius) / TREE_LINE_BAND);
  const rim = smoothstep((size.radius - distance) / (size.radius * RIM_BAND_RATIO));
  return treeLine * (size.rimDensity + (1 - size.rimDensity) * rim);
}

/**
 * Splits the presets into the three layers a forest plants from.
 *
 * A band that no preset falls into borrows from the tallest band that has one,
 * so a library of nothing but bushes still produces a forest rather than an
 * empty scene.
 */
function classifyPresets(presets) {
  const canopy = presets.filter((preset) => preset.height >= CANOPY_HEIGHT);
  const understory = presets.filter(
    (preset) => preset.height >= UNDERSTORY_HEIGHT && preset.height < CANOPY_HEIGHT,
  );
  const ground = presets.filter((preset) => preset.height < UNDERSTORY_HEIGHT);
  const fallback = [canopy, understory, ground].find((band) => band.length > 0);

  if (!fallback) throw new Error('A forest needs at least one tree preset.');

  return Object.freeze({
    canopy: canopy.length > 0 ? canopy : fallback,
    understory: understory.length > 0 ? understory : fallback,
    ground: ground.length > 0 ? ground : fallback,
  });
}

function pick(band, random) {
  return band[Math.min(band.length - 1, Math.floor(random.next() * band.length))];
}

function chooseBand(bands, random) {
  const roll = random.next();
  if (roll < CANOPY_SHARE) return bands.canopy;
  if (roll < CANOPY_SHARE + UNDERSTORY_SHARE) return bands.understory;
  return bands.ground;
}

function round(value, decimals = 3) {
  return Number(value.toFixed(decimals));
}

function createEntry(preset, x, z, size, random) {
  // Measured from the rounded position, so where a tree stands and how far out
  // it counts as standing can never disagree.
  const position = [round(x), 0, round(z)];
  const distance = Math.hypot(position[0], position[2]);

  return {
    preset: preset.id,
    seed: random.integer(1, 2000000000),
    position,
    rotationY: round(random.range(0, Math.PI * 2), 4),
    // Seeds vary the shape but not the height, so the size spread is what stops
    // a stand of one preset from reading as a row of copies.
    scale: round(random.range(0.84, 1.2)),
    minimumLod: distance > size.heroRadius ? FAR_MINIMUM_LOD : 0,
    distance,
  };
}

export function createForestLayout(size, presets, random) {
  const bands = classifyPresets(presets);
  const entries = [];
  const cells = Math.ceil((size.radius * 2) / size.spacing);
  const origin = -((cells - 1) * size.spacing) / 2;

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const jitter = size.spacing * 0.44;
      const x = origin + column * size.spacing + random.range(-jitter, jitter);
      const z = origin + row * size.spacing + random.range(-jitter, jitter);
      const distance = Math.hypot(x, z);

      if (distance > size.radius) continue;
      if (random.next() > densityAt(distance, size) * size.fill) continue;

      entries.push(createEntry(pick(chooseBand(bands, random), random), x, z, size, random));
    }
  }

  for (let index = 0; index < CLEARING_BUSH_COUNT; index += 1) {
    const angle = random.range(0, Math.PI * 2);
    const distance = size.clearingRadius * random.range(0.34, 0.86);
    entries.push(
      createEntry(
        pick(bands.ground, random),
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        size,
        random,
      ),
    );
  }

  // Nearest first: the build queue drains in order, so the clearing the camera
  // starts in fills before the rim nobody is looking at yet.
  entries.sort((first, second) => first.distance - second.distance);
  return entries.map(({ distance, ...entry }) => entry);
}

/**
 * The scene configuration for a forest of the given size, derived from the
 * garden configuration so lighting, renderer and LOD settings stay shared.
 *
 * `presets` carries `{ id, height }` for every preset the library holds, which
 * is what decides whether a preset plants as canopy, understory or ground
 * cover. Passing them in keeps this module free of the preset domain.
 */
export function createForestSceneConfig(
  config,
  { size = DEFAULT_FOREST_SIZE, presets = [], seed = FOREST_SEED } = {},
) {
  const settings = resolveForestSize(size);
  const layout = createForestLayout(settings, presets, new SeededRandom(seed));
  const groundSize = settings.radius * 2 + 60;

  return {
    ...config,
    scene: {
      ...config.scene,
      fogNear: settings.fogNear,
      fogFar: settings.fogFar,
      groundSize,
    },
    camera: {
      ...config.camera,
      // The far levels only exist a long way off, and the whole point of the
      // scene is to have all four of them on screen at once.
      near: 0.15,
      far: Math.ceil(settings.radius * 2 + 120),
      position: [0, 15, settings.clearingRadius + 19],
      target: [0, 5, 0],
      controlsMaxDistance: Math.round(settings.radius * 0.75),
    },
    lod: {
      ...config.lod,
      generationBudgetMs: 12,
      // Hundreds of trees, each of which changes level over metres of travel.
      // A third of them per frame keeps the switch imperceptible and the update
      // off the frame budget. The garden's dozen trees stay on every frame.
      updateStride: 3,
    },
    lighting: {
      ...config.lighting,
      shadowExtent: SHADOW_EXTENT,
      // One shadow map cannot cover a forest, so it follows the viewer instead.
      followFocus: true,
    },
    layout,
    forest: Object.freeze({
      size: settings.id,
      label: settings.label,
      radius: settings.radius,
      clearingRadius: settings.clearingRadius,
      treeCount: layout.length,
      // Kept inside the ground disc, so a walk cannot step off the world.
      walkRadius: groundSize * 0.5 - 4,
    }),
  };
}
