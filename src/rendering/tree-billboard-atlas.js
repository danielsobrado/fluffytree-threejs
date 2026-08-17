export const BILLBOARD_BATCH_CAPACITY = 32;
export const BILLBOARD_TEXTURE_SIZE = 128;
export const BILLBOARD_ATLAS_GUTTER_PIXELS = 4;

export function createBillboardAtlasLayout(capacity = BILLBOARD_BATCH_CAPACITY) {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError(`Invalid billboard atlas capacity '${capacity}'.`);
  }

  const columns = Math.ceil(Math.sqrt(capacity));
  const rows = Math.ceil(capacity / columns);
  return Object.freeze({ capacity, columns, rows });
}

export function calculateBillboardAtlasSlot(index, layout) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= layout.capacity) {
    throw new RangeError(`Invalid billboard atlas slot '${index}'.`);
  }

  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return Object.freeze({
    column,
    row,
    offsetX: column / layout.columns,
    offsetY: (layout.rows - row - 1) / layout.rows,
    scaleX: 1 / layout.columns,
    scaleY: 1 / layout.rows,
  });
}

function requireAtlasDimension(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`Invalid billboard atlas ${label} '${value}'.`);
  }
  return value;
}

function requireGutter(gutterPixels) {
  if (!Number.isSafeInteger(gutterPixels) || gutterPixels < 0) {
    throw new RangeError(
      `Invalid billboard atlas gutter '${gutterPixels}'.`,
    );
  }
  return gutterPixels;
}

export function calculateBillboardAtlasUvTransform(
  slot,
  textureWidth,
  textureHeight,
  gutterPixels = 0,
) {
  const width = requireAtlasDimension(textureWidth, 'width');
  const height = requireAtlasDimension(textureHeight, 'height');
  const gutter = requireGutter(gutterPixels);
  const cellWidth = width * slot.scaleX;
  const cellHeight = height * slot.scaleY;
  const insetX = (gutter + 0.5) / width;
  const insetY = (gutter + 0.5) / height;
  const scaleX = (cellWidth - gutter * 2 - 1) / width;
  const scaleY = (cellHeight - gutter * 2 - 1) / height;
  if (scaleX <= 0 || scaleY <= 0) {
    throw new RangeError(
      'The billboard atlas cell is too small for its filtering gutter.',
    );
  }

  return Object.freeze({
    offsetX: slot.offsetX + insetX,
    offsetY: slot.offsetY + insetY,
    scaleX,
    scaleY,
  });
}
