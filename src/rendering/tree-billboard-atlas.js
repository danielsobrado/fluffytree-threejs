export const BILLBOARD_BATCH_CAPACITY = 32;
export const BILLBOARD_TEXTURE_SIZE = 128;

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

export function calculateBillboardAtlasUvTransform(
  slot,
  textureWidth,
  textureHeight,
) {
  if (!Number.isSafeInteger(textureWidth) || textureWidth <= 0) {
    throw new RangeError(`Invalid billboard atlas width '${textureWidth}'.`);
  }
  if (!Number.isSafeInteger(textureHeight) || textureHeight <= 0) {
    throw new RangeError(`Invalid billboard atlas height '${textureHeight}'.`);
  }

  const insetX = 0.5 / textureWidth;
  const insetY = 0.5 / textureHeight;
  const scaleX = slot.scaleX - insetX * 2;
  const scaleY = slot.scaleY - insetY * 2;
  if (scaleX <= 0 || scaleY <= 0) {
    throw new RangeError('The billboard atlas cell is too small for linear filtering.');
  }

  return Object.freeze({
    offsetX: slot.offsetX + insetX,
    offsetY: slot.offsetY + insetY,
    scaleX,
    scaleY,
  });
}
