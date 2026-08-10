export function createJavaScriptCodeMask(source) {
  const mask = new Uint8Array(source.length);

  const scanString = (start, quote) => {
    let index = start + 1;
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index] === quote) return index + 1;
      index += 1;
    }
    return index;
  };

  const scanLineComment = (start) => {
    let index = start + 2;
    while (index < source.length && source[index] !== '\n') index += 1;
    return index;
  };

  const scanBlockComment = (start) => {
    const end = source.indexOf('*/', start + 2);
    return end === -1 ? source.length : end + 2;
  };

  const scanCode = (start, templateExpression = false) => {
    let index = start;
    let braces = templateExpression ? 1 : 0;

    while (index < source.length) {
      const current = source[index];
      const next = source[index + 1];

      if (current === "'" || current === '"') {
        index = scanString(index, current);
        continue;
      }
      if (current === '/' && next === '/') {
        index = scanLineComment(index);
        continue;
      }
      if (current === '/' && next === '*') {
        index = scanBlockComment(index);
        continue;
      }
      if (current === '`') {
        index = scanTemplate(index);
        continue;
      }

      if (templateExpression) {
        if (current === '{') braces += 1;
        if (current === '}') {
          braces -= 1;
          if (braces === 0) return index + 1;
        }
      }

      mask[index] = 1;
      index += 1;
    }

    return index;
  };

  const scanTemplate = (start) => {
    let index = start + 1;

    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index] === '`') return index + 1;
      if (source[index] === '$' && source[index + 1] === '{') {
        index = scanCode(index + 2, true);
        continue;
      }
      index += 1;
    }

    return index;
  };

  scanCode(0);
  return mask;
}

export function isJavaScriptCodeOffset(mask, offset) {
  return mask[offset] === 1;
}
