import { requireTreeIrFrond } from './tree-ir-frond-geometry-common.js?v=2.0.0-20260814.2';
import { createTreeIrFrondLeafletGeometry } from './tree-ir-frond-leaflet-geometry.js?v=2.0.0-20260814.2';
import { createTreeIrFrondRibbonGeometry } from './tree-ir-frond-ribbon-geometry.js?v=2.0.0-20260814.2';

export class TreeIrFrondGeometryFactory {
  create(
    treeIr,
    site,
    {
      segmentRatio = 1,
      leaflets = false,
      rachisWidthRatio = 0.08,
      leafletLengthRatio = 0.96,
      leafletWidthRatio = 0.72,
    } = {},
  ) {
    const frond = requireTreeIrFrond(site);
    const segmentCount = Math.max(
      2,
      Math.round(frond.segmentCount * segmentRatio),
    );
    if (!leaflets) {
      return createTreeIrFrondRibbonGeometry(
        treeIr,
        site,
        frond,
        segmentCount,
      );
    }
    return createTreeIrFrondLeafletGeometry(
      treeIr,
      site,
      frond,
      segmentCount,
      {
        rachisWidthRatio,
        leafletLengthRatio,
        leafletWidthRatio,
      },
    );
  }
}
