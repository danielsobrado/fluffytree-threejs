function requireImage(image) {
  if (!image?.width || !image?.height) {
    throw new Error('Billboard atlas source image must have positive dimensions.');
  }
  return image;
}

function requireGutter(gutterPixels) {
  if (!Number.isSafeInteger(gutterPixels) || gutterPixels < 0) {
    throw new RangeError('Billboard atlas gutter must be a non-negative integer.');
  }
  return gutterPixels;
}

export function drawBillboardAtlasCell(
  context,
  imageInput,
  cellX,
  cellY,
  gutterPixels,
) {
  const image = requireImage(imageInput);
  const gutter = requireGutter(gutterPixels);
  const innerX = cellX + gutter;
  const innerY = cellY + gutter;

  context.drawImage(image, innerX, innerY, image.width, image.height);
  if (gutter === 0) return;

  const rightSource = image.width - 1;
  const bottomSource = image.height - 1;

  context.drawImage(image, 0, 0, 1, image.height, cellX, innerY, gutter, image.height);
  context.drawImage(
    image,
    rightSource,
    0,
    1,
    image.height,
    innerX + image.width,
    innerY,
    gutter,
    image.height,
  );
  context.drawImage(image, 0, 0, image.width, 1, innerX, cellY, image.width, gutter);
  context.drawImage(
    image,
    0,
    bottomSource,
    image.width,
    1,
    innerX,
    innerY + image.height,
    image.width,
    gutter,
  );

  context.drawImage(image, 0, 0, 1, 1, cellX, cellY, gutter, gutter);
  context.drawImage(
    image,
    rightSource,
    0,
    1,
    1,
    innerX + image.width,
    cellY,
    gutter,
    gutter,
  );
  context.drawImage(
    image,
    0,
    bottomSource,
    1,
    1,
    cellX,
    innerY + image.height,
    gutter,
    gutter,
  );
  context.drawImage(
    image,
    rightSource,
    bottomSource,
    1,
    1,
    innerX + image.width,
    innerY + image.height,
    gutter,
    gutter,
  );
}
