/**
 * Pulling a preset's canopy palette toward a season.
 *
 * A season cannot just replace a palette. A preset's palette is a value ramp —
 * dark cavity green through to near-cream top — and that ramp is what the
 * shader's palette texture samples for cavity, height and exposure. Replace it
 * and every crown in the scene flattens to the same colour, whatever it was
 * before.
 *
 * So the season carries a ramp of its own, and each entry of the preset's
 * palette is mixed toward the season's ramp *at the same position along it*.
 * Dark entries meet the season's dark end and light entries meet its light end,
 * so an autumn oak keeps the oak's value structure and gains the autumn's hue,
 * and a pale birch stays paler than the oak beside it.
 *
 * Kept free of the renderer — this is hex in, hex out — so the transform can be
 * checked without one.
 */

function parseHex(value) {
  const match =
    typeof value === 'string' ? /^#?([0-9a-f]{6})$/i.exec(value.trim()) : null;
  if (!match) return null;

  const packed = Number.parseInt(match[1], 16);
  return {
    r: (packed >> 16) & 0xff,
    g: (packed >> 8) & 0xff,
    b: packed & 0xff,
  };
}

function toHex({ r, g, b }) {
  const channel = (value) =>
    Math.round(Math.min(Math.max(value, 0), 255))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** The season's ramp read at a position from 0 (darkest) to 1 (lightest). */
export function sampleRamp(ramp, position) {
  const stops = ramp.map(parseHex).filter(Boolean);
  if (stops.length === 0) return null;
  if (stops.length === 1) return stops[0];

  const scaled = Math.min(Math.max(position, 0), 1) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const fraction = scaled - index;
  const from = stops[index];
  const to = stops[index + 1];

  return {
    r: from.r + (to.r - from.r) * fraction,
    g: from.g + (to.g - from.g) * fraction,
    b: from.b + (to.b - from.b) * fraction,
  };
}

/**
 * The palette, moved `amount` of the way toward the season's ramp.
 *
 * An entry that cannot be parsed is passed through untouched rather than
 * dropped, because a palette is positional: losing an entry would shift every
 * entry after it to a different point on the ramp.
 */
export function blendPaletteToSeason(palette, ramp, amount) {
  if (!ramp?.length || amount <= 0) return [...palette];

  const strength = Math.min(amount, 1);
  const span = Math.max(1, palette.length - 1);

  return palette.map((entry, index) => {
    const base = parseHex(entry);
    const target = sampleRamp(ramp, index / span);
    if (!base || !target) return entry;

    return toHex({
      r: base.r + (target.r - base.r) * strength,
      g: base.g + (target.g - base.g) * strength,
      b: base.b + (target.b - base.b) * strength,
    });
  });
}
