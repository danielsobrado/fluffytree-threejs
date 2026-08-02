const BACKGROUND = Object.freeze([26, 32, 40]);
const HOLE = Object.freeze([255, 0, 255]);

/**
 * Composes the read-back frame into a reviewable image with every counted hole
 * flooded in magenta, so a failing gate points at the opening it measured.
 * Read-back rows run bottom-up, so the composition flips them.
 */
export function createSolidityViewImage(pixels, holeMask, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);

  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = (index - x) / width;
    const destination = (x + (height - 1 - y) * width) * 4;
    const source = index * 4;

    if (holeMask[index] === 1) {
      image.data[destination] = HOLE[0];
      image.data[destination + 1] = HOLE[1];
      image.data[destination + 2] = HOLE[2];
    } else if (pixels[source + 3] === 0) {
      image.data[destination] = BACKGROUND[0];
      image.data[destination + 1] = BACKGROUND[1];
      image.data[destination + 2] = BACKGROUND[2];
    } else {
      image.data[destination] = pixels[source];
      image.data[destination + 1] = pixels[source + 1];
      image.data[destination + 2] = pixels[source + 2];
    }

    image.data[destination + 3] = 255;
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
