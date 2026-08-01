import { CrownVolumeField } from './crown-volume-field.js';
import { extractIsoSurface } from './marching-tetrahedra.js';

export class CrownVolumeGenerator {
  generate(treeData) {
    const field = new CrownVolumeField(treeData);
    const volume = extractIsoSurface(
      field,
      treeData.palette.volume.resolution,
    );

    if (volume.triangleCount === 0) {
      throw new Error('The procedural crown volume generated no surface triangles.');
    }

    return volume;
  }
}
