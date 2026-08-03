import { CROWN_PROFILE_IDS } from '../generation/crown-envelope.js';
import {
  getTrunkStyleTaperPower,
  TRUNK_STYLE_OPTIONS,
} from '../generation/trunk-style.js';
import { LEAF_SHAPE_OPTIONS } from '../rendering/leaf-shape-library.js';

/**
 * What the tuning panel exposes, and the bounds it is allowed to explore.
 *
 * Every range here is inside the range the domain validator enforces, so a
 * control can never produce a configuration the preset factory would reject.
 * The panel is generated from this list; it holds no per-field knowledge.
 */

const CROWN_PROFILE_LABELS = Object.freeze({
  round: 'Round',
  columnar: 'Columnar',
  vase: 'Vase',
  pad: 'Bonsai pads',
});

const CROWN_PROFILE_OPTIONS = Object.freeze(
  CROWN_PROFILE_IDS.map((id) =>
    Object.freeze({ id, label: CROWN_PROFILE_LABELS[id] ?? id }),
  ),
);

function range(path, label, minimum, maximum, step, fallback) {
  return Object.freeze({
    path,
    label,
    type: 'range',
    minimum,
    maximum,
    step,
    fallback,
  });
}

function integer(path, label, minimum, maximum, fallback) {
  return Object.freeze({
    path,
    label,
    type: 'integer',
    minimum,
    maximum,
    step: 1,
    fallback,
  });
}

function pair(path, label, minimum, maximum, step, { integral = false } = {}) {
  return Object.freeze({
    path,
    label,
    type: 'pair',
    minimum,
    maximum,
    step,
    integral,
  });
}

function vector(path, label, minimum, maximum, step, axes) {
  return Object.freeze({
    path,
    label,
    type: 'vector',
    minimum,
    maximum,
    step,
    axes: Object.freeze(axes),
  });
}

function select(path, label, options, fallback) {
  return Object.freeze({ path, label, type: 'select', options, fallback });
}

function color(path, label) {
  return Object.freeze({ path, label, type: 'color' });
}

function colors(path, label, count) {
  return Object.freeze({ path, label, type: 'colors', count });
}

function toggle(path, label) {
  return Object.freeze({ path, label, type: 'toggle' });
}

export const TUNING_GROUPS = Object.freeze([
  Object.freeze({
    id: 'trunk',
    label: 'Trunk',
    open: true,
    note: 'Style sets the shape family. Movement and curves are how much of it you get.',
    controls: Object.freeze([
      select('trunk.style', 'Style', TRUNK_STYLE_OPTIONS, 'natural'),
      range('trunk.movement', 'Movement', 0, 2.5, 0.01, 1),
      range('trunk.curveCount', 'Curves', 0.5, 5, 0.05, 1),
      range('trunk.sweep', 'Sweep direction', -3.14, 3.14, 0.01, 0),
      range('trunk.bend', 'Bend', 0, 1.4, 0.01),
      // Taper is part of a style's identity, so an untouched slider shows the
      // chosen style's own value rather than a single global default.
      range('trunk.taperPower', 'Taper', 0.25, 1.6, 0.01, (config) =>
        getTrunkStyleTaperPower(config.trunk?.style),
      ),
      range('trunk.baseRadius', 'Base radius', 0.05, 0.8, 0.005),
      range('trunk.topRadius', 'Top radius', 0.02, 0.35, 0.005),
      range('trunk.flare', 'Root flare', 0, 1.5, 0.01),
      range('trunk.nebari', 'Nebari (surface roots)', 0, 2.5, 0.01, 1),
      integer('trunk.segments', 'Segments', 4, 16),
      color('trunk.color', 'Trunk colour'),
      colors('trunk.barkPalette', 'Bark palette', 3),
    ]),
  }),

  Object.freeze({
    id: 'branches',
    label: 'Branches',
    open: false,
    note: 'Low upward bias plus exposed tips is what makes a canopy read as layered pads.',
    controls: Object.freeze([
      integer('trunk.branching.depth', 'Depth', 1, 4),
      integer('trunk.branching.primaryCount', 'Primary limbs', 2, 7),
      pair('trunk.branching.childCount', 'Children per limb', 1, 4, 1, {
        integral: true,
      }),
      range('trunk.branching.lengthDecay', 'Length decay', 0.35, 0.9, 0.01),
      range('trunk.branching.radiusDecay', 'Radius decay', 0.35, 0.9, 0.01),
      range('trunk.branching.upwardBias', 'Upward bias', 0, 1, 0.01),
      range('trunk.branching.gnarl', 'Gnarl', 0, 1, 0.01),
      range('trunk.branching.twist', 'Twist', 0, 1, 0.01),
      range('trunk.branching.exposedTipRatio', 'Exposed tips', 0, 0.8, 0.01),
    ]),
  }),

  Object.freeze({
    id: 'crown',
    label: 'Crown',
    open: false,
    note: 'Flattened vertical scale on a pad profile is what turns lobes into foliage pads.',
    controls: Object.freeze([
      select('crown.profile', 'Profile', CROWN_PROFILE_OPTIONS),
      range('crown.baseHeight', 'Crown base', 0.1, 8, 0.01),
      range('crown.height', 'Crown height', 0.3, 8, 0.01),
      range('crown.radius', 'Crown radius', 0.3, 5, 0.01),
      integer('crown.lobeCount', 'Lobes', 4, 28),
      pair('crown.lobeScale', 'Lobe scale', 0.3, 1.6, 0.01),
      pair('crown.verticalScale', 'Vertical scale', 0.3, 2, 0.01),
      range('crown.lobeScaleMultiplier', 'Lobe size', 0.5, 2, 0.01),
      range('crown.scaleVariation', 'Size variation', 0, 0.5, 0.01),
      range('crown.radialBias', 'Radial bias', 0, 1, 0.01),
      range('crown.asymmetry', 'Asymmetry', 0, 1, 0.01),
      range('crown.surfaceTension', 'Surface tension', 0, 1, 0.01),
      vector('crown.lean', 'Lean', -2, 2, 0.01, ['X', 'Z']),
      integer('crown.clumps.macroCount', 'Macro clumps', 1, 10),
      range('crown.clumps.separation', 'Clump separation', 0, 1, 0.01),
      range('crown.clumps.anchoring', 'Clump anchoring', 0, 1, 0.01),
      range('crown.clumps.silhouetteBreakup', 'Silhouette breakup', 0, 1, 0.01),
    ]),
  }),

  Object.freeze({
    id: 'leaves',
    label: 'Leaves',
    open: true,
    note: 'Coverage packing is the gap control: lower packs more cards onto the same surface.',
    controls: Object.freeze([
      select('foliage.leafShape', 'Leaf shape', LEAF_SHAPE_OPTIONS, 'broadleaf'),
      colors('foliage.palette', 'Foliage palette', 4),
      range('foliage.shell.coverageCardRatio', 'Coverage packing', 0.2, 0.9, 0.005),
      integer('foliage.shell.candidatesPerLobe', 'Candidates per lobe', 96, 1800),
      pair('foliage.shell.sizeRatio', 'Card size', 0.04, 0.32, 0.005),
      pair('foliage.shell.widthRatio', 'Card width', 0.4, 1.4, 0.01),
      pair('foliage.shell.outwardRatio', 'Card lift', 0.9, 1.6, 0.01),
      integer('foliage.shell.planesPerCluster', 'Planes per cluster', 1, 4),
      range('foliage.shell.alphaTest', 'Alpha cut', 0.1, 0.8, 0.01),
      range('foliage.shell.exposureThreshold', 'Exposure threshold', 0, 0.4, 0.005),
      range('foliage.shell.paletteLift', 'Palette lift', -0.4, 0.4, 0.005),
      range('foliage.shell.colorJitter', 'Colour jitter', 0, 0.2, 0.005),
      range('foliage.shell.cavityScale', 'Cavity shading', 0, 1, 0.01),
      range('foliage.shell.normalBlend', 'Normal blend', 0, 1, 0.01),
    ]),
  }),

  Object.freeze({
    id: 'canopy',
    label: 'Canopy shading',
    open: false,
    note: 'The cores are the opaque interior mass. Shrinking them is what lets sky through.',
    controls: Object.freeze([
      range('foliage.core.scale', 'Core scale', 0.55, 1.15, 0.005),
      range('foliage.core.brightness', 'Core brightness', 0.2, 1, 0.01),
      range('foliage.variation', 'Variation', 0, 1, 0.01),
      range('foliage.paletteBase', 'Palette base', 0, 1, 0.01),
      range('foliage.heightPaletteShift', 'Height shift', -0.5, 0.5, 0.01),
      range('foliage.exposurePaletteShift', 'Exposure shift', -0.5, 0.5, 0.01),
      range('foliage.wrapLight', 'Wrap light', 0, 1, 0.01),
      range('foliage.skyLightStrength', 'Sky light', 0, 1, 0.01),
      range('foliage.cavityStrength', 'Cavity strength', 0, 1, 0.01),
      range('foliage.heightLightStrength', 'Height light', 0, 1, 0.01),
      toggle('foliage.heroLeaves.enabled', 'Hero leaves'),
      range('foliage.heroLeaves.density', 'Hero density', 0, 1, 0.005),
      range('foliage.heroLeaves.scale', 'Hero scale', 0.1, 3, 0.01),
      integer('foliage.heroLeaves.leavesPerCluster', 'Leaves per cluster', 1, 9),
    ]),
  }),
]);

export function readPath(source, path) {
  return path
    .split('.')
    .reduce((value, key) => (value === undefined ? undefined : value[key]), source);
}

export function writePath(target, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((current, key) => {
    if (current[key] === undefined || current[key] === null) current[key] = {};
    return current[key];
  }, target);
  parent[last] = value;
  return target;
}
