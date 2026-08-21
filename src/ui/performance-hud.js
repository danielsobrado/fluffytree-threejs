import { createElement } from './tuning-controls.js?v=2.0.0-20260814.2';

/**
 * What the current frame costs.
 *
 * The point of a forest scene is the numbers, and the number that matters most
 * is not the frame rate on its own: it is the frame rate next to how many trees
 * are still being grown, and next to how the levels of detail are distributed.
 * A forest that runs at sixty because every tree is an impostor has not proved
 * anything, so the distribution is drawn as a bar rather than buried in text.
 */

const LEVEL_LABELS = Object.freeze(['L0', 'L1', 'L2', 'L3', 'off']);

function formatCount(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

export class PerformanceHud {
  constructor() {
    this.element = createElement('section', 'perf-hud');
    this.element.append(createElement('h3', null, 'Performance'));
    this.rows = new Map();

    for (const [key, label] of [
      ['frames', 'Frames'],
      ['draws', 'Draw calls'],
      ['triangles', 'Triangles'],
      ['trees', 'Trees'],
      ['queued', 'Queued work'],
      ['memory', 'Buffers'],
    ]) {
      const row = createElement('div', 'tuning-metric');
      const value = createElement('span', 'tuning-metric-value', '–');
      row.append(createElement('span', 'tuning-metric-label', label), value);
      this.rows.set(key, value);
      this.element.append(row);
    }

    this.bar = createElement('div', 'perf-bar');
    this.segments = LEVEL_LABELS.map((_, index) => {
      const segment = createElement('span', 'perf-bar-segment');
      segment.dataset.level = String(index);
      this.bar.append(segment);
      return segment;
    });
    this.levels = createElement('p', 'perf-levels', 'Levels of detail');
    this.element.append(this.bar, this.levels);
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }

  update(sample) {
    const { levels, culled, total } = sample.lod;
    const counts = [...levels, culled];

    this.rows.get('frames').textContent =
      `${sample.fps.toFixed(0)} fps · ${sample.frameMs.toFixed(1)} ms (${sample.worstFrameMs.toFixed(0)} worst)`;
    this.rows.get('draws').textContent = String(sample.drawCalls);
    this.rows.get('triangles').textContent = formatCount(sample.triangles);
    this.rows.get('trees').textContent =
      sample.built < sample.total
        ? `${sample.built} of ${sample.total} growing`
        : `${total} live`;
    // The queue carries the near levels being prewarmed for trees that are
    // already standing, which is what a walk towards them costs.
    this.rows.get('queued').textContent =
      sample.pending > 0 ? `${sample.pending} builds` : 'idle';
    this.rows.get('memory').textContent =
      `${sample.geometries} geometries · ${sample.textures} textures`;

    const drawn = Math.max(1, counts.reduce((sum, count) => sum + count, 0));
    this.segments.forEach((segment, index) => {
      segment.style.flexGrow = String(counts[index]);
      segment.hidden = counts[index] === 0;
      segment.title = `${LEVEL_LABELS[index]}: ${counts[index]} trees`;
    });
    this.levels.textContent = counts
      .map((count, index) => `${LEVEL_LABELS[index]} ${count}`)
      .join(' · ');
    this.bar.title = `${drawn} trees tracked`;
  }
}
