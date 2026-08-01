const DIRECTIONS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);

function indexOf(x, y, width) {
  return y * width + x;
}

export function countComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  let count = 0;
  let largest = 0;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 || visited[index] === 1) continue;

    count += 1;
    let size = 0;
    const pending = [index];
    visited[index] = 1;

    while (pending.length > 0) {
      const current = pending.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      size += 1;

      for (const [dx, dy] of DIRECTIONS) {
        const nextX = x + dx;
        const nextY = y + dy;

        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
          continue;
        }

        const next = indexOf(nextX, nextY, width);
        if (mask[next] === 1 && visited[next] === 0) {
          visited[next] = 1;
          pending.push(next);
        }
      }
    }

    largest = Math.max(largest, size);
  }

  return { count, largest };
}

export function calculateHoleRatio(mask, width, height, occupiedCount) {
  const exterior = new Uint8Array(mask.length);
  const pending = [];

  function addExterior(x, y) {
    const index = indexOf(x, y, width);
    if (mask[index] === 0 && exterior[index] === 0) {
      exterior[index] = 1;
      pending.push(index);
    }
  }

  for (let x = 0; x < width; x += 1) {
    addExterior(x, 0);
    addExterior(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    addExterior(0, y);
    addExterior(width - 1, y);
  }

  while (pending.length > 0) {
    const current = pending.pop();
    const x = current % width;
    const y = Math.floor(current / width);

    for (const [dx, dy] of DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;

      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
        continue;
      }

      addExterior(nextX, nextY);
    }
  }

  let holes = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 && exterior[index] === 0) holes += 1;
  }

  return occupiedCount === 0 ? 0 : holes / occupiedCount;
}
