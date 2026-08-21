import { readPath } from './tuning-schema.js?v=2.0.0-20260814.2';

/**
 * One DOM control per schema entry.
 *
 * Each factory returns `{ element, refresh }`. `refresh` re-reads the value from
 * the configuration, which is how loading a different preset repopulates the
 * whole panel without rebuilding any DOM. Controls report through two callbacks:
 * `onPreview`, which fires continuously while a slider moves and only updates
 * the readout, and `onCommit`, which fires once the value settles and is what
 * triggers a rebuild. A tree takes a few hundred milliseconds to generate, so
 * rebuilding on every intermediate slider position would make the panel unusable.
 */

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createField(control) {
  const field = createElement('div', 'tuning-field');
  const header = createElement('div', 'tuning-field-header');
  const label = createElement('label', 'tuning-label', control.label);
  const readout = createElement('span', 'tuning-readout');
  header.append(label, readout);
  field.append(header);
  return { field, label, readout };
}

function formatNumber(value, step) {
  const decimals = step >= 1 ? 0 : String(step).split('.')[1]?.length ?? 2;
  return Number(value).toFixed(decimals);
}

function createSlider(control, value) {
  const slider = createElement('input', 'tuning-slider');
  slider.type = 'range';
  slider.min = String(control.minimum);
  slider.max = String(control.maximum);
  slider.step = String(control.step);
  slider.value = String(value);
  return slider;
}

function readValue(config, control) {
  const value = readPath(config, control.path);

  if (value !== undefined) return value;

  // A fallback may depend on the rest of the configuration, as taper depends on
  // the chosen trunk style.
  return typeof control.fallback === 'function'
    ? control.fallback(config)
    : control.fallback;
}

function createNumberControl(control, context) {
  const { field, readout } = createField(control);
  const toNumber = (raw) =>
    control.type === 'integer' ? Math.round(Number(raw)) : Number(raw);
  const slider = createSlider(control, readValue(context.config, control) ?? 0);

  const show = (value) => {
    readout.textContent = formatNumber(value, control.step);
  };

  slider.addEventListener('input', () => {
    show(toNumber(slider.value));
    context.onPreview();
  });
  slider.addEventListener('change', () => {
    context.onCommit(control.path, toNumber(slider.value));
  });

  field.append(slider);
  show(toNumber(slider.value));

  return {
    element: field,
    refresh() {
      const value = readValue(context.config, control) ?? 0;
      slider.value = String(value);
      show(toNumber(value));
    },
  };
}

function createPairControl(control, context) {
  const { field, readout } = createField(control);
  const row = createElement('div', 'tuning-pair');
  const current = () => readPath(context.config, control.path) ?? [0, 0];
  const sliders = [0, 1].map((index) => {
    const slider = createSlider(control, current()[index]);
    row.append(slider);
    return slider;
  });

  const values = () => {
    const raw = sliders.map((slider) =>
      control.integral ? Math.round(Number(slider.value)) : Number(slider.value),
    );
    // The domain rejects an inverted pair, so a dragged minimum pushes the
    // maximum rather than producing a configuration that cannot be applied.
    return [raw[0], Math.max(raw[0], raw[1])];
  };

  const show = () => {
    const [minimum, maximum] = values();
    readout.textContent = `${formatNumber(minimum, control.step)} – ${formatNumber(maximum, control.step)}`;
  };

  for (const slider of sliders) {
    slider.addEventListener('input', () => {
      show();
      context.onPreview();
    });
    slider.addEventListener('change', () => {
      const pair = values();
      sliders[1].value = String(pair[1]);
      context.onCommit(control.path, pair);
    });
  }

  field.append(row);
  show();

  return {
    element: field,
    refresh() {
      const pair = current();
      sliders.forEach((slider, index) => {
        slider.value = String(pair[index]);
      });
      show();
    },
  };
}

function createVectorControl(control, context) {
  const { field, readout } = createField(control);
  const row = createElement('div', 'tuning-pair');
  const current = () => readPath(context.config, control.path) ?? [0, 0];
  const sliders = control.axes.map((axis, index) => {
    const slider = createSlider(control, current()[index]);
    slider.title = axis;
    row.append(slider);
    return slider;
  });

  const show = () => {
    readout.textContent = sliders
      .map(
        (slider, index) =>
          `${control.axes[index]} ${formatNumber(slider.value, control.step)}`,
      )
      .join('  ');
  };

  for (const slider of sliders) {
    slider.addEventListener('input', () => {
      show();
      context.onPreview();
    });
    slider.addEventListener('change', () => {
      context.onCommit(
        control.path,
        sliders.map((entry) => Number(entry.value)),
      );
    });
  }

  field.append(row);
  show();

  return {
    element: field,
    refresh() {
      const vectorValue = current();
      sliders.forEach((slider, index) => {
        slider.value = String(vectorValue[index]);
      });
      show();
    },
  };
}

function createSelectControl(control, context) {
  const { field } = createField(control);
  const select = createElement('select', 'tuning-select');

  for (const option of control.options) {
    const element = createElement('option', null, option.label);
    element.value = option.id;
    select.append(element);
  }

  select.addEventListener('change', () => {
    context.onCommit(control.path, select.value);
  });

  field.append(select);
  select.value = readValue(context.config, control) ?? control.options[0].id;

  return {
    element: field,
    refresh() {
      select.value = readValue(context.config, control) ?? control.options[0].id;
    },
  };
}

function createToggleControl(control, context) {
  const { field } = createField(control);
  const input = createElement('input', 'tuning-toggle');
  input.type = 'checkbox';
  input.checked = Boolean(readPath(context.config, control.path));
  input.addEventListener('change', () => {
    context.onCommit(control.path, input.checked);
  });
  field.append(input);

  return {
    element: field,
    refresh() {
      input.checked = Boolean(readPath(context.config, control.path));
    },
  };
}

function createColorInput(value, onChange) {
  const input = createElement('input', 'tuning-color');
  input.type = 'color';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function createColorControl(control, context) {
  const { field } = createField(control);
  const input = createColorInput(
    readPath(context.config, control.path) ?? '#000000',
    (value) => context.onCommit(control.path, value),
  );
  field.append(input);

  return {
    element: field,
    refresh() {
      input.value = readPath(context.config, control.path) ?? '#000000';
    },
  };
}

function createColorsControl(control, context) {
  const { field } = createField(control);
  const row = createElement('div', 'tuning-colors');
  const current = () => readPath(context.config, control.path) ?? [];
  const inputs = Array.from({ length: control.count }, (_unused, index) => {
    const input = createColorInput(current()[index] ?? '#000000', (value) => {
      const next = [...current()];
      next[index] = value;
      context.onCommit(control.path, next);
    });
    row.append(input);
    return input;
  });

  field.append(row);

  return {
    element: field,
    refresh() {
      const palette = current();
      inputs.forEach((input, index) => {
        input.value = palette[index] ?? '#000000';
      });
    },
  };
}

const CONTROL_FACTORIES = Object.freeze({
  range: createNumberControl,
  integer: createNumberControl,
  pair: createPairControl,
  vector: createVectorControl,
  select: createSelectControl,
  toggle: createToggleControl,
  color: createColorControl,
  colors: createColorsControl,
});

export function createControl(control, context) {
  const factory = CONTROL_FACTORIES[control.type];

  if (!factory) {
    throw new Error(`Unsupported tuning control type '${control.type}'.`);
  }

  return factory(control, context);
}

export { createElement };
