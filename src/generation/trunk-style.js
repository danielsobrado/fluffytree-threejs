/**
 * Trunk shape families.
 *
 * A style is a lateral displacement along the trunk expressed in world units,
 * plus the two scalars that decide how the trunk reads from a distance: how
 * fast it thins (`taperPower`) and how the sweep distributes its height
 * (`heightPower`). Gnarl and twist stay in the generator because they need the
 * seeded phase; a style only supplies the deliberate movement on top of them.
 *
 * Three invariants make a style safe to drop into an existing preset:
 *
 * - `heightPower` is positive, so the swept path is strictly ascending and the
 *   monotonic-trunk gate holds for every style.
 * - `displace(0)` is zero for every bonsai style, so the trunk leaves the ground
 *   at the origin and the root flare stays centred on the nebari.
 * - the root ramp holds the base vertical, so the swept tube's first ring stays
 *   level and buried however far the style travels higher up.
 *
 * `natural` reproduces the historic trunk expression exactly and is deliberately
 * exempt from the second invariant: its z term starts at `-0.07 * bend`, so its
 * trunks have always emerged slightly off the tree origin. Reproducing that is
 * the point — every existing preset and every accepted QA baseline was measured
 * against it.
 *
 * `natural` also keeps the historic habit of letting the trunk top drift away
 * from the crown centre. Every bonsai style instead anchors the crown on its own
 * apex, because their apexes travel far enough that a fixed crown would float
 * beside the tree.
 */

const DEFAULT_STYLE_ID = 'natural';
const DEFAULT_MOVEMENT = 1;
const DEFAULT_CURVE_COUNT = 1;
const DEFAULT_SWEEP = 0;
const DEFAULT_SEGMENTS = 12;

/**
 * How much of the trunk emerges from the nebari before its movement starts.
 *
 * A bonsai trunk leaves its root flare vertically and develops movement above
 * the base; the curve does not begin at ground level. That is also what keeps
 * the swept tube's first ring level: the ring is perpendicular to the tangent
 * and as wide as the flare, so a trunk that launched at an angle would tip its
 * own base out of the ground however deep the sweep started.
 */
const ROOT_RAMP_SPAN = 0.36;

/**
 * The first trunk point above the base sits at `t = 1/segments`, and that point
 * is what sets the launch angle. Stretching the span for a coarse trunk places
 * that point equally low on the ramp however many segments the preset uses, so
 * lowering the segment count in the studio cannot tilt the base out of the
 * ground.
 */
const ROOT_RAMP_SEGMENT_REACH = 4.3;

/** Zero value and zero slope at the base, fully open by the end of the span. */
function createRootRamp(segments) {
  const segmentCount = Math.max(1, Number(segments) || DEFAULT_SEGMENTS);
  const span = Math.min(
    1,
    Math.max(ROOT_RAMP_SPAN, ROOT_RAMP_SEGMENT_REACH / segmentCount),
  );

  return (t) => {
    const ratio = Math.min(1, t / span);
    return ratio * ratio * (3 - 2 * ratio);
  };
}

function rotate(lateral, cross, sweep) {
  const cos = Math.cos(sweep);
  const sin = Math.sin(sweep);

  return {
    x: cos * lateral - sin * cross,
    z: sin * lateral + cos * cross,
  };
}

const TRUNK_STYLES = Object.freeze({
  natural: Object.freeze({
    label: 'Natural',
    taperPower: 0.76,
    heightPower: 1,
    // The shape every existing preset and accepted QA baseline was measured
    // against. It is exempt from the root ramp and from crown anchoring so it
    // reproduces the historic trunk exactly.
    legacy: true,
    displace(t, context) {
      const bend = Math.sin(t * Math.PI * 0.9) * context.amplitude;

      return {
        x: bend * 0.68 + Math.sin(t * Math.PI * 2.1) * context.amplitude * 0.08,
        z: bend * 0.24 - Math.cos(t * Math.PI * 1.7) * context.amplitude * 0.07,
      };
    },
  }),

  // Chokkan. A single straight rise with only enough sway to stop the sweep
  // reading as a cylinder, and the apex directly over the nebari.
  formalUpright: Object.freeze({
    label: 'Formal upright (chokkan)',
    taperPower: 0.5,
    heightPower: 1,
    displace(t, context) {
      const settle = Math.pow(1 - t, 0.85);
      const sway = Math.sin(t * Math.PI * context.curveCount) * settle;
      const cross = Math.sin(t * Math.PI * context.curveCount * 0.5) * settle;

      return rotate(
        context.amplitude * 0.34 * sway,
        context.amplitude * 0.16 * cross,
        context.sweep,
      );
    },
  }),

  // Moyogi, the classic bonsai silhouette. Alternating curves that are widest
  // low on the trunk and shrink as they climb, so the apex still returns over
  // the base the way the style demands.
  informalUpright: Object.freeze({
    label: 'Informal upright (moyogi)',
    taperPower: 0.52,
    heightPower: 1,
    displace(t, context) {
      const settle = Math.pow(1 - t, 0.5);
      const wave = Math.sin(t * Math.PI * context.curveCount) * settle;
      const cross = Math.sin(t * Math.PI * context.curveCount * 0.5) * settle;

      return rotate(
        context.amplitude * 1.35 * wave,
        context.amplitude * 0.46 * cross,
        context.sweep,
      );
    },
  }),

  // Shakan. A steady lean off the vertical with one soft curve through the
  // middle, so the trunk leans without looking snapped.
  slant: Object.freeze({
    label: 'Slant (shakan)',
    taperPower: 0.58,
    heightPower: 0.94,
    displace(t, context) {
      const lean = Math.pow(t, 0.88);
      const curve = Math.sin(t * Math.PI) * 0.3;
      const cross = Math.sin(t * Math.PI * context.curveCount);

      return rotate(
        context.amplitude * (1.85 * lean + curve),
        context.amplitude * 0.24 * cross,
        context.sweep,
      );
    },
  }),

  // Fukinagashi. Everything is dragged one way and the rise flattens near the
  // top, so the crown reaches downwind instead of sitting over the roots.
  windswept: Object.freeze({
    label: 'Windswept (fukinagashi)',
    taperPower: 0.55,
    heightPower: 0.86,
    displace(t, context) {
      const drag = Math.pow(t, 1.45);
      const ripple = Math.sin(t * Math.PI * context.curveCount) * (1 - t * 0.5);
      const cross = Math.sin(t * Math.PI * context.curveCount * 0.7);

      return rotate(
        context.amplitude * (2.35 * drag + 0.3 * ripple),
        context.amplitude * 0.2 * cross,
        context.sweep,
      );
    },
  }),

  // Bunjin. A thin wandering trunk that keeps almost none of its taper and
  // leans further the higher it gets, carrying a small crown at the very top.
  literati: Object.freeze({
    label: 'Literati (bunjin)',
    taperPower: 0.9,
    heightPower: 1,
    displace(t, context) {
      const wander =
        Math.sin(t * Math.PI * context.curveCount * 1.35) * Math.pow(t, 0.55);
      const reach = Math.pow(t, 2.4);
      const cross = Math.sin(t * Math.PI * context.curveCount * 0.8);

      return rotate(
        context.amplitude * (0.85 * wander + 1.15 * reach),
        context.amplitude * 0.5 * cross,
        context.sweep,
      );
    },
  }),

  // Han-kengai. The trunk climbs quickly, then spends the rest of its length
  // travelling sideways. The height power keeps the sweep ascending, so the
  // arc reads as a cascade without breaking the monotonic-trunk invariant.
  semiCascade: Object.freeze({
    label: 'Semi-cascade (han-kengai)',
    taperPower: 0.55,
    heightPower: 0.66,
    displace(t, context) {
      const arc = Math.pow(t, 1.7);
      const lift = Math.sin(t * Math.PI * 0.85);
      const cross = Math.sin(t * Math.PI * context.curveCount * 0.6);

      return rotate(
        context.amplitude * (3.05 * arc + 0.35 * lift),
        context.amplitude * 0.32 * cross,
        context.sweep,
      );
    },
  }),
});

export const TRUNK_STYLE_IDS = Object.freeze(Object.keys(TRUNK_STYLES));

export const TRUNK_STYLE_OPTIONS = Object.freeze(
  TRUNK_STYLE_IDS.map((id) =>
    Object.freeze({ id, label: TRUNK_STYLES[id].label }),
  ),
);

export function isTrunkStyleId(value) {
  return Object.hasOwn(TRUNK_STYLES, value);
}

/** How fast this style thins when the preset does not say. */
export function getTrunkStyleTaperPower(id = DEFAULT_STYLE_ID) {
  return (TRUNK_STYLES[id] ?? TRUNK_STYLES[DEFAULT_STYLE_ID]).taperPower;
}

/**
 * Resolves a trunk configuration into the shape it describes.
 *
 * The result is deterministic from configuration alone, which is what lets the
 * crown envelope place the canopy on the trunk apex before the seeded trunk
 * path has been generated.
 */
export function createTrunkStyle(trunk) {
  const id = trunk.style ?? DEFAULT_STYLE_ID;
  const style = TRUNK_STYLES[id];

  if (!style) {
    throw new Error(`Unsupported trunk style '${id}'.`);
  }

  const context = Object.freeze({
    amplitude: Number(trunk.bend) * Number(trunk.movement ?? DEFAULT_MOVEMENT),
    curveCount: Number(trunk.curveCount ?? DEFAULT_CURVE_COUNT),
    sweep: Number(trunk.sweep ?? DEFAULT_SWEEP),
  });
  const apex = style.displace(1, context);

  return Object.freeze({
    id,
    label: style.label,
    taperPower: Number(trunk.taperPower ?? style.taperPower),
    heightPower: style.heightPower,
    displace: (t) => style.displace(t, context),
    /**
     * Scales everything that pushes the trunk off its axis at a given height.
     *
     * The generator applies it to the whole lateral offset — style, crown lean
     * and seeded gnarl together — because any of the three can tip the base.
     * It reaches 1 well before the apex, so it shapes how the trunk leaves the
     * ground without moving the point the crown is anchored to.
     */
    rampAt: style.legacy ? () => 1 : createRootRamp(trunk.segments),
    // The first generated segment of a bonsai trunk is pinned to the base axis
    // by the branch generator. The below-ground extension then shares that
    // axis, which makes the rendered root ring horizontal at every tuning
    // extreme. Natural remains byte-for-byte on its historic sloped launch.
    verticalRoot: !style.legacy,
    // Where the crown sits relative to the preset's own lean. Styles that walk
    // their apex away from the roots take the canopy with them.
    crownAnchor: Object.freeze(
      style.legacy ? { x: 0, z: 0 } : { x: apex.x, z: apex.z },
    ),
  });
}
