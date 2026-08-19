/**
 * Frame timings over a short trailing window.
 *
 * A forest is judged on how it holds up while it is being built and walked
 * through, so the readout has to answer two different questions: what the rate
 * settles at, and how bad the worst frame in the last moment was. An average
 * over the whole session answers neither.
 */

const DEFAULT_WINDOW_MS = 700;

export class FrameStatistics {
  constructor({ windowMs = DEFAULT_WINDOW_MS } = {}) {
    this.windowMs = windowMs;
    this.times = [];
  }

  sample(timeMs) {
    this.times.push(timeMs);

    const oldest = timeMs - this.windowMs;
    let dropped = 0;
    while (dropped < this.times.length - 2 && this.times[dropped] < oldest) {
      dropped += 1;
    }
    if (dropped > 0) this.times.splice(0, dropped);

    return this;
  }

  get span() {
    if (this.times.length < 2) return 0;
    return this.times.at(-1) - this.times[0];
  }

  get fps() {
    const span = this.span;
    return span > 0 ? ((this.times.length - 1) * 1000) / span : 0;
  }

  get frameMs() {
    const span = this.span;
    return span > 0 ? span / (this.times.length - 1) : 0;
  }

  get worstFrameMs() {
    let worst = 0;
    for (let index = 1; index < this.times.length; index += 1) {
      worst = Math.max(worst, this.times[index] - this.times[index - 1]);
    }
    return worst;
  }

  reset() {
    this.times.length = 0;
  }
}
