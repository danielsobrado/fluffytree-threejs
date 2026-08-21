import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';

/**
 * The directions a foliage card is hidden from by the core it sits on.
 *
 * The crown is a shell of alpha-cut cards over opaque cores and nothing else:
 * the inside is empty, which is what lets the tree skip its interior branches.
 * The same emptiness means a card on the far side of a lobe contributes nothing
 * to a view from this side, because every ray to it passes through the core
 * first. Those cards can be dropped before they are rasterized.
 *
 * A card is not simply dropped when it faces away, which would cut the
 * silhouette open: near the rim a card is exactly what the eye sees, and the
 * core behind it has already ended. The test is instead the cone of directions
 * from which the core genuinely covers the card.
 *
 * The bound is conservative on every count. The occluder is the sphere
 * inscribed in the lobe's core ellipsoid, not the ellipsoid; it uses the
 * smallest core scale any level draws; a neighbouring core that would occlude
 * more is ignored; and the card is treated as a ball around its centre, so the
 * occluder is shrunk by that ball's radius before the angle is taken. Shrinking
 * is what makes the test exact for the whole card rather than for its centre:
 * if the ray leaving the centre clears the core's centre by no more than
 * `radius - reach`, then every parallel ray leaving a point within `reach` of
 * the centre clears it by no more than `radius`, and so still meets the core.
 */

/** Absorbs the wind's rigid sway and the rounding in the attribute. */
const CONE_MARGIN = 0.05;

/**
 * The core scale the cone has to survive.
 *
 * Cards are drawn at levels 0 and 1, and level 0 draws the smaller core of the
 * two. A cone computed against the smaller core is valid for the larger one,
 * which only hides more.
 */
const MINIMUM_LOD_CORE_SCALE = 1;

/** A cosine no direction can exceed, so the card is never culled. */
const NEVER_OCCLUDED = 2;

export function calculateCoreOccluderRadius(lobe, coreScale) {
  const minimumSemiAxis = Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);
  return (
    minimumSemiAxis *
    coreScale *
    FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier *
    MINIMUM_LOD_CORE_SCALE
  );
}

/**
 * `reach` is the radius of a ball around the card's centre that contains the
 * whole card, in the same units as the lobe.
 */
export function calculateOcclusionCone(position, lobe, occluderRadius, reach) {
  const dx = lobe.position.x - position.x;
  const dy = lobe.position.y - position.y;
  const dz = lobe.position.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  const effectiveRadius = occluderRadius - reach;

  if (!(distance > 0) || effectiveRadius <= 0 || effectiveRadius >= distance) {
    return { x: 0, y: 1, z: 0, w: NEVER_OCCLUDED };
  }

  const sine = effectiveRadius / distance;
  const cosine = Math.sqrt(Math.max(0, 1 - sine * sine)) + CONE_MARGIN;

  return {
    x: dx / distance,
    y: dy / distance,
    z: dz / distance,
    w: cosine >= 1 ? NEVER_OCCLUDED : cosine,
  };
}
