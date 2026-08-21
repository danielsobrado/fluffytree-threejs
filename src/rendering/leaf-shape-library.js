import { FOLIAGE_ALPHA_SHAPES } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';

/**
 * Leaf silhouettes for the alpha-cut foliage cards.
 *
 * A shape is a set of blades plus an optional stem. Each blade is an ellipse
 * with a leaf-like longitudinal taper, and the card's alpha is the strongest
 * blade at that texel, so blades overlap into one spray rather than punching
 * holes in each other.
 *
 * Coverage is the property that matters beyond looks: the canopy solidity gate
 * measures what the camera can see through, so a sparse silhouette such as
 * needles has to carry enough blades to stay opaque at the card scale the
 * preset renders it at. `broadleaf` is the historic spray, unchanged.
 */

const BROADLEAF_STEM = Object.freeze({
  halfWidth: [0.04, 0.15],
  halfLength: [0.45, 0.51],
  strength: 0.92,
  centerY: 0,
});

function blade(x, y, radiusX, radiusY, angle) {
  return Object.freeze({ x, y, radiusX, radiusY, angle });
}

/**
 * Blades radiating from one point, as a needle bunch or a leaf spray does.
 *
 * `lean` rotates the whole bunch, which is what lets several bunches sit at
 * different places on the card facing different ways. A single fan leaves the
 * corners of the card empty however many blades it has, because they all share
 * an origin.
 */
function fan({
  count,
  spread,
  radiusX,
  radiusY,
  radius,
  originX = 0,
  originY = 0,
  lean = 0,
  taper = 0,
}) {
  return Object.freeze(
    Array.from({ length: count }, (_unused, index) => {
      const ratio = count === 1 ? 0.5 : index / (count - 1);
      const angle = (ratio - 0.5) * spread + lean;
      const shrink = 1 - Math.abs(ratio - 0.5) * 2 * taper;

      return blade(
        originX + Math.sin(angle) * radius,
        originY + Math.cos(angle) * radius,
        radiusX * shrink,
        radiusY * shrink,
        angle,
      );
    }),
  );
}

/**
 * Blobs on a circle, which is what makes a scalloped outline.
 *
 * A fan shares one origin and so leaves the card's corners empty. A ring pushes
 * its blobs outward instead, and the shallow notches where neighbouring blobs
 * meet are the scallops the silhouette is made of.
 */
function ring({ count, radius, radiusX, radiusY, phase = 0, centerY = 0 }) {
  return Object.freeze(
    Array.from({ length: count }, (_unused, index) => {
      const angle = phase + (index / count) * Math.PI * 2;

      return blade(
        Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        radiusX,
        radiusY,
        // Radial, so each blob's own taper runs outward and thins the rim.
        angle - Math.PI * 0.5,
      );
    }),
  );
}

const LEAF_SHAPES = Object.freeze({
  broadleaf: Object.freeze({
    label: 'Broadleaf spray',
    blades: FOLIAGE_ALPHA_SHAPES,
    stem: BROADLEAF_STEM,
    softness: Object.freeze([0.72, 1.03]),
  }),

  // Palmate lobes off one stem. Reads as maple or trident maple, the deciduous
  // bonsai silhouette.
  maple: Object.freeze({
    label: 'Maple (palmate)',
    blades: Object.freeze([
      blade(0, 0.08, 0.135, 0.3, 0),
      blade(-0.2, 0.0, 0.125, 0.27, -0.66),
      blade(0.2, 0.0, 0.125, 0.27, 0.66),
      blade(-0.31, -0.15, 0.105, 0.22, -1.2),
      blade(0.31, -0.15, 0.105, 0.22, 1.2),
      blade(-0.12, -0.26, 0.1, 0.18, -0.3),
      blade(0.12, -0.26, 0.1, 0.18, 0.3),
    ]),
    stem: Object.freeze({
      halfWidth: [0.03, 0.11],
      halfLength: [0.34, 0.44],
      strength: 0.9,
      centerY: -0.12,
    }),
    softness: Object.freeze([0.7, 1.02]),
  }),

  // Juniper and pine. Thin blades, so the fan is dense enough that the card
  // still reads as solid foliage rather than a comb.
  needle: Object.freeze({
    label: 'Needle (juniper)',
    blades: Object.freeze([
      ...fan({
        count: 11,
        spread: 1.95,
        radiusX: 0.056,
        radiusY: 0.27,
        radius: 0.18,
        originY: -0.16,
        taper: 0.14,
      }),
      ...fan({
        count: 8,
        spread: 1.5,
        radiusX: 0.054,
        radiusY: 0.23,
        radius: 0.14,
        originX: -0.24,
        originY: -0.02,
        lean: -0.7,
        taper: 0.12,
      }),
      ...fan({
        count: 8,
        spread: 1.5,
        radiusX: 0.054,
        radiusY: 0.23,
        radius: 0.14,
        originX: 0.24,
        originY: -0.02,
        lean: 0.7,
        taper: 0.12,
      }),
      ...fan({
        count: 7,
        spread: 1.3,
        radiusX: 0.052,
        radiusY: 0.19,
        radius: 0.1,
        originY: -0.34,
        taper: 0.1,
      }),
    ]),
    stem: Object.freeze({
      halfWidth: [0.03, 0.1],
      halfLength: [0.36, 0.46],
      strength: 0.85,
      centerY: -0.1,
    }),
    softness: Object.freeze([0.74, 1.04]),
  }),

  // Jade and ficus: few, fat, rounded leaves with a lot of alpha per card.
  oval: Object.freeze({
    label: 'Oval (ficus)',
    blades: Object.freeze([
      blade(0, 0.2, 0.16, 0.23, 0),
      blade(-0.22, 0.02, 0.155, 0.22, -0.5),
      blade(0.22, 0.02, 0.155, 0.22, 0.5),
      blade(-0.16, -0.24, 0.145, 0.2, -0.28),
      blade(0.16, -0.24, 0.145, 0.2, 0.28),
      blade(0, -0.08, 0.15, 0.21, 0),
    ]),
    stem: Object.freeze({
      halfWidth: [0.035, 0.12],
      halfLength: [0.4, 0.5],
      strength: 0.88,
      centerY: -0.06,
    }),
    softness: Object.freeze([0.7, 1.02]),
  }),

  // Long narrow blades hanging below the attachment point, for weeping crowns.
  willow: Object.freeze({
    label: 'Willow (weeping)',
    blades: Object.freeze([
      blade(0, -0.06, 0.07, 0.4, 0),
      blade(-0.15, -0.1, 0.068, 0.36, -0.16),
      blade(0.15, -0.1, 0.068, 0.36, 0.16),
      blade(-0.28, -0.16, 0.062, 0.3, -0.3),
      blade(0.28, -0.16, 0.062, 0.3, 0.3),
      blade(-0.08, -0.22, 0.065, 0.32, -0.08),
      blade(0.08, -0.22, 0.065, 0.32, 0.08),
      blade(-0.22, 0.04, 0.06, 0.26, -0.22),
      blade(0.22, 0.04, 0.06, 0.26, 0.22),
    ]),
    stem: Object.freeze({
      halfWidth: [0.028, 0.1],
      halfLength: [0.42, 0.5],
      strength: 0.86,
      centerY: 0.04,
    }),
    softness: Object.freeze([0.74, 1.04]),
  }),

  // Not a leaf spray but a cluster of foliage seen from far enough away that
  // individual leaves have stopped being the subject. The card reads as a
  // rounded mass with a scalloped rim, which is the storybook canopy the glade
  // presets are built from. Wide softness feathers the edge, and with
  // alpha-to-coverage that feathering is what removes the cut-out look at the
  // silhouette rather than a wider alpha test would.
  puff: Object.freeze({
    label: 'Puff (storybook canopy)',
    blades: Object.freeze([
      blade(0, 0, 0.235, 0.245, 0),
      ...ring({
        count: 7,
        radius: 0.225,
        radiusX: 0.155,
        radiusY: 0.175,
        phase: 0.32,
      }),
    ]),
    stem: null,
    softness: Object.freeze([0.5, 1.08]),
  }),
});

export const LEAF_SHAPE_IDS = Object.freeze(Object.keys(LEAF_SHAPES));

export const LEAF_SHAPE_OPTIONS = Object.freeze(
  LEAF_SHAPE_IDS.map((id) => Object.freeze({ id, label: LEAF_SHAPES[id].label })),
);

export const DEFAULT_LEAF_SHAPE_ID = 'broadleaf';

export function isLeafShapeId(value) {
  return Object.hasOwn(LEAF_SHAPES, value);
}

export function getLeafShape(id = DEFAULT_LEAF_SHAPE_ID) {
  const shape = LEAF_SHAPES[id];

  if (!shape) {
    throw new Error(`Unsupported leaf shape '${id}'.`);
  }

  return shape;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const normalized = clamp01((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function sampleBlade(x, y, blade, softness) {
  const cos = Math.cos(blade.angle);
  const sin = Math.sin(blade.angle);
  const offsetX = x - blade.x;
  const offsetY = y - blade.y;
  const localX = offsetX * cos + offsetY * sin;
  const localY = -offsetX * sin + offsetY * cos;
  const longitudinal = localY / blade.radiusY;
  const leafEnvelope = Math.max(0.08, 1 - Math.abs(longitudinal) ** 1.65);
  const lateral = localX / (blade.radiusX * Math.sqrt(leafEnvelope));
  const distance = lateral ** 2 + longitudinal ** 2;

  return 1 - smoothstep(softness[0], softness[1], distance);
}

function sampleStem(x, y, stem) {
  if (!stem) return 0;

  const along = Math.abs(y - stem.centerY);
  return (
    (1 - smoothstep(stem.halfWidth[0], stem.halfWidth[1], Math.abs(x))) *
    (1 - smoothstep(stem.halfLength[0], stem.halfLength[1], along)) *
    stem.strength
  );
}

/**
 * Alpha of a leaf card at a texel, with the card spanning [-0.5, 0.5] on both
 * axes. Blades combine by maximum rather than by sum, so overlapping blades read
 * as one spray instead of cutting each other out.
 */
export function sampleLeafAlpha(x, y, leafShape) {
  let alpha = 0;

  for (const blade of leafShape.blades) {
    alpha = Math.max(alpha, sampleBlade(x, y, blade, leafShape.softness));
  }

  return clamp01(Math.max(alpha, sampleStem(x, y, leafShape.stem)));
}
