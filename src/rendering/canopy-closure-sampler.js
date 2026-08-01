import { CanopyCapSampler } from './canopy-cap-sampler.js';
import { CanopySaddleSampler } from './canopy-saddle-sampler.js';
import { CanopyVolumeSampler } from './canopy-volume-sampler.js';

export class CanopyClosureSampler {
  constructor({
    volumeSampler = new CanopyVolumeSampler(),
    saddleSampler = new CanopySaddleSampler(),
    capSampler = new CanopyCapSampler(),
  } = {}) {
    this.volumeSampler = volumeSampler;
    this.saddleSampler = saddleSampler;
    this.capSampler = capSampler;
  }

  generate(treeData, field) {
    const settings = treeData.palette.leafDetail.closure;
    if (!settings.enabled) return Object.freeze([]);

    const volume = this.volumeSampler.generate(treeData, field, settings);
    const saddle = this.saddleSampler.generate(treeData, field, settings);
    const cap = this.capSampler.generate(treeData, field, settings);
    return Object.freeze([...volume, ...saddle, ...cap]);
  }
}
