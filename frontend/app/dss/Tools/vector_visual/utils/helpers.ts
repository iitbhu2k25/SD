// Utility helper functions

/**
 * Parse matrix transform to extract translate values
 */
export function parseTranslateFromTransform(transform: string): { tx: number; ty: number } {
  if (!transform || transform === 'none') return { tx: 0, ty: 0 };
  
  if (transform.startsWith('matrix3d')) {
    const parts = transform.replace('matrix3d(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[12] || 0, ty: parts[13] || 0 };
  }
  
  if (transform.startsWith('matrix')) {
    const parts = transform.replace('matrix(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[4] || 0, ty: parts[5] || 0 };
  }
  
  return { tx: 0, ty: 0 };
}

/**
 * Download a text file (used for GeoJSON export)
 */
export function downloadTextFile(filename: string, text: string, mime = 'application/geo+json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Format latitude with direction
 */
export function formatLatitude(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(4)}°${dir}`;
}

/**
 * Format longitude with direction
 */
export function formatLongitude(lng: number): string {
  const dir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lng).toFixed(4)}°${dir}`;
}

/**
 * Wait for all tile layers to finish loading
 */
export async function waitForAllLayersReady(map: any, timeoutMs = 6000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { 
      if (!done) { 
        done = true; 
        resolve(); 
      } 
    };
    
    const allLayers: any[] = [];
    map.eachLayer((layer: any) => { 
      allLayers.push(layer); 
    });
    
    const tileLayers = allLayers.filter(layer => layer._tiles || typeof layer.getTileUrl === 'function');
    
    if (tileLayers.length === 0) {
      setTimeout(finish, 200);
      return;
    }
    
    const allTilesComplete = () => {
      return tileLayers.every((layer) => {
        const tiles = layer._tiles;
        if (!tiles) return true;
        const keys = Object.keys(tiles);
        if (keys.length === 0) return false;
        return keys.every((k) => {
          const tile = tiles[k];
          const img: HTMLImageElement | undefined = tile?.el || tile;
          return img && (img as any).complete;
        });
      });
    };
    
    const poll = setInterval(() => {
      if (allTilesComplete()) {
        clearInterval(poll);
        clearTimeout(safety);
        finish();
      }
    }, 120);
    
    const safety = setTimeout(() => {
      clearInterval(poll);
      finish();
    }, timeoutMs);
  });
}

/**
 * Validate shapefile upload files
 */
export function validateShapefileUpload(files: FileList | null, acceptedExtensions: string[]): { ok: boolean; reason: string } {
  if (!files || files.length === 0) {
    return { ok: false, reason: 'No file selected' };
  }
  
  const names = Array.from(files).map(f => f.name.toLowerCase());
  const hasZip = names.some(n => n.endsWith('.zip'));
  const hasShp = names.some(n => n.endsWith('.shp'));
  const allAllowed = names.every(n => acceptedExtensions.some(ext => n.endsWith(ext)));
  
  if (!allAllowed) {
    return { 
      ok: false, 
      reason: 'Wrong format. Upload a .zip or the .shp with sidecar files (.shx, .dbf, .prj, .cpg).' 
    };
  }
  
  if (!hasZip && !hasShp) {
    return { 
      ok: false, 
      reason: 'No .zip or .shp found. Select a zipped shapefile or include at least the .shp file.' 
    };
  }
  
  return { ok: true, reason: '' };
}