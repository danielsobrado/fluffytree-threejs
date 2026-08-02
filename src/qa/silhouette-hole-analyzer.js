const NEIGHBOUR_OFFSETS = Object.freeze([
  Object.freeze([1, 0]),
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([0, -1]),
]);

const EMPTY = 0;
const EXTERIOR = 1;
const HOLE = 2;

function floodExterior(mask, width, height, state) {
  const stack = [];

  for (let x = 0; x < width; x += 1) {
    stack.push(x, x + (height - 1) * width);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push(y * width, width - 1 + y * width);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (mask[index] !== 0 || state[index] !== EMPTY) continue;

    state[index] = EXTERIOR;
    const x = index % width;
    const y = (index - x) / width;

    for (const [stepX, stepY] of NEIGHBOUR_OFFSETS) {
      const nextX = x + stepX;
      const nextY = y + stepY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const next = nextX + nextY * width;
      if (mask[next] === 0 && state[next] === EMPTY) stack.push(next);
    }
  }
}

function measureHole(mask, width, height, state, start, thick, visited) {
  const stack = [start];
  let thickPixels = 0;
  visited.length = 0;
  state[start] = HOLE;

  while (stack.length > 0) {
    const index = stack.pop();
    visited.push(index);
    if (thick[index] !== 0) thickPixels += 1;
    const x = index % width;
    const y = (index - x) / width;

    for (const [stepX, stepY] of NEIGHBOUR_OFFSETS) {
      const nextX = x + stepX;
      const nextY = y + stepY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const next = nextX + nextY * width;
      if (mask[next] === 0 && state[next] === EMPTY) {
        state[next] = HOLE;
        stack.push(next);
      }
    }
  }

  return { pixels: visited.length, thickPixels };
}

/**
 * Marks background pixels whose whole (2 * radius + 1) square neighbourhood is
 * also background. A hole containing at least one marked pixel is wide enough to
 * see through; the single-pixel stipple between neighbouring leaf cards, which is
 * what makes the canopy read as foliage rather than as a solid shell, is not.
 */
function markThickBackground(mask, width, height, radius) {
  const thick = new Uint8Array(width * height);

  if (radius <= 0) {
    for (let index = 0; index < thick.length; index += 1) {
      thick[index] = mask[index] === 0 ? 1 : 0;
    }
    return thick;
  }

  const horizontal = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let open = 1;
      for (let offset = -radius; offset <= radius && open === 1; offset += 1) {
        const sampleX = x + offset;
        if (sampleX < 0 || sampleX >= width || mask[sampleX + y * width] !== 0) {
          open = 0;
        }
      }
      horizontal[x + y * width] = open;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let open = 1;
      for (let offset = -radius; offset <= radius && open === 1; offset += 1) {
        const sampleY = y + offset;
        if (
          sampleY < 0 ||
          sampleY >= height ||
          horizontal[x + sampleY * width] === 0
        ) {
          open = 0;
        }
      }
      thick[x + y * width] = open;
    }
  }

  return thick;
}

function safeRatio(value, total) {
  return total === 0 ? 0 : value / total;
}

/**
 * Background pixels that cannot reach the image border are enclosed by the
 * rendered tree, so every one of them is a place where the camera looks straight
 * through the model. Background is flood filled with four-way connectivity,
 * which keeps a diagonal chain of leaf pixels from draining a hole that is still
 * plainly visible.
 */
export function analyzeSilhouetteHoles(mask, width, height, options = {}) {
  const minimumHolePixels = options.minimumHolePixels ?? 1;
  const minimumHoleRadius = options.minimumHoleRadius ?? 0;

  if (mask.length !== width * height) {
    throw new Error('The silhouette mask does not match the requested size.');
  }

  const state = new Uint8Array(width * height);
  floodExterior(mask, width, height, state);
  const thick = markThickBackground(mask, width, height, minimumHoleRadius);
  const holeMask = options.holeMask ?? null;
  const visited = [];

  let coveredPixels = 0;
  let holePixels = 0;
  let countedHolePixels = 0;
  let holeCount = 0;
  let largestHolePixels = 0;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0) {
      coveredPixels += 1;
      continue;
    }
    if (state[index] !== EMPTY) continue;

    const hole = measureHole(mask, width, height, state, index, thick, visited);
    holePixels += hole.pixels;

    if (hole.pixels >= minimumHolePixels && hole.thickPixels > 0) {
      holeCount += 1;
      countedHolePixels += hole.pixels;
      largestHolePixels = Math.max(largestHolePixels, hole.pixels);
      if (holeMask) for (const pixel of visited) holeMask[pixel] = 1;
    }
  }

  const filledPixels = coveredPixels + holePixels;

  return Object.freeze({
    width,
    height,
    coveredPixels,
    filledPixels,
    holePixels,
    countedHolePixels,
    holeCount,
    largestHolePixels,
    coverageRatio: safeRatio(coveredPixels, width * height),
    holeRatio: safeRatio(countedHolePixels, filledPixels),
    largestHoleRatio: safeRatio(largestHolePixels, filledPixels),
  });
}

/**
 * Builds the silhouette mask from an RGBA read-back. The probe clears its render
 * target to a fully transparent background, so a non-zero alpha means a surface
 * survived depth testing and alpha cut-out at that pixel.
 */
export function createAlphaMask(pixels, width, height, alphaThreshold = 64) {
  if (pixels.length < width * height * 4) {
    throw new Error('The pixel buffer is smaller than the requested size.');
  }

  const mask = new Uint8Array(width * height);

  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = pixels[index * 4 + 3] >= alphaThreshold ? 1 : 0;
  }

  return mask;
}
