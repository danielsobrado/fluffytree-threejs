import { CrownVolumeField } from './crown-volume-field.js?v=2.0.0-20260814.2';
import { extractIsoSurface } from './marching-tetrahedra.js?v=2.0.0-20260814.2';

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
