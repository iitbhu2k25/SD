// GeoJSON collection and processing utilities

import { ManagedLayer } from '../types/map.types';

/**
 * Collect GeoJSON from active overlay layers and drawn features
 */
export function collectMapGeoJSON(
  map: any, 
  managedLayers: ManagedLayer[], 
  drawnItems: any
): GeoJSON.FeatureCollection {
  const fc: GeoJSON.FeatureCollection = { 
    type: 'FeatureCollection', 
    features: [] as GeoJSON.Feature[] 
  };
  
  // Collect from managed layers
  managedLayers.forEach(ml => {
    if (ml.layer && ml.visible && ml.layer.toGeoJSON) {
      const gj = ml.layer.toGeoJSON();
      if (gj?.type === 'FeatureCollection') {
        fc.features.push(...(gj.features as any));
      } else if (gj?.type === 'Feature') {
        fc.features.push(gj as any);
      }
    }
  });
  
  // Collect from drawn items
  if (drawnItems && typeof drawnItems.eachLayer === 'function') {
    drawnItems.eachLayer((layer: any) => {
      if (layer?.toGeoJSON) {
        const gj = layer.toGeoJSON();
        if (gj?.type === 'FeatureCollection') {
          fc.features.push(...(gj.features as any));
        } else if (gj?.type === 'Feature') {
          fc.features.push(gj as any);
        }
      }
    });
  }
  
  return { type: 'FeatureCollection', features: fc.features };
}