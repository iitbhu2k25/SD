type ControlOptions = {
  enableScale?: boolean;
  enableFullscreen?: boolean;
  enableCoordinates?: boolean;
  enableDraw?: boolean;
};

export async function attachLeafletCommonControls(
  L: any,
  map: any,
  opts: ControlOptions = {}
): Promise<() => void> {
  const {
    enableScale = true,
    enableFullscreen = true,
    enableCoordinates = true,
    enableDraw = true,
  } = opts;

  const cleanups: Array<() => void> = [];

  if (enableScale) {
    const scale = L.control.scale({ position: 'bottomleft', metric: true, imperial: true });
    scale.addTo(map);
    cleanups.push(() => {
      try { map.removeControl(scale); } catch {}
    });
  }

  if (enableFullscreen) {
    const fullscreenControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-control-fullscreen');
        const button = L.DomUtil.create('button', 'fullscreen-button', container) as HTMLButtonElement;

        button.style.cssText = `
          background: white;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 4px;
          width: 30px;
          height: 30px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        `;

        const updateButton = () => {
          const isFs = !!document.fullscreenElement;
          button.innerHTML = isFs ? '[-]' : '[ ]';
          button.title = isFs ? 'Exit Fullscreen' : 'Enter Fullscreen';
        };
        updateButton();
        button.onmouseover = () => { button.style.backgroundColor = '#f4f4f4'; };
        button.onmouseout = () => { button.style.backgroundColor = 'white'; };

        L.DomEvent.on(button, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(button, 'click', () => {
          const target = map.getContainer() as HTMLElement;
          if (!document.fullscreenElement) target.requestFullscreen?.().catch(() => {});
          else document.exitFullscreen?.().catch(() => {});
        });
        document.addEventListener('fullscreenchange', updateButton);

        (container as any).__cleanupFullscreen = () => {
          document.removeEventListener('fullscreenchange', updateButton);
        };

        return container;
      },
      onRemove: (container: any) => {
        container?.__cleanupFullscreen?.();
      },
    });

    const fsControl = new fullscreenControl({ position: 'topleft' });
    map.addControl(fsControl);
    cleanups.push(() => {
      try { map.removeControl(fsControl); } catch {}
    });
  }

  if (enableCoordinates) {
    const coordControl = L.control({ position: 'bottomright' });
    coordControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
      div.style.padding = '4px 8px';
      div.style.background = 'rgba(255,255,255,0.95)';
      div.style.fontSize = '11px';
      div.style.fontFamily = 'monospace';
      div.style.color = '#7d0707';
      div.innerHTML = 'Lat --, Lng --';
      return div;
    };
    coordControl.addTo(map);

    const update = (e: any) => {
      const el = (coordControl as any)._container as HTMLElement | undefined;
      if (!el) return;
      el.innerHTML = `Lat ${e.latlng.lat.toFixed(5)}, Lng ${e.latlng.lng.toFixed(5)}`;
    };
    const reset = () => {
      const el = (coordControl as any)._container as HTMLElement | undefined;
      if (!el) return;
      el.innerHTML = 'Lat --, Lng --';
    };
    map.on('mousemove', update);
    map.on('mouseout', reset);
    cleanups.push(() => {
      try {
        map.off('mousemove', update);
        map.off('mouseout', reset);
        map.removeControl(coordControl);
      } catch {}
    });
  }

  if (enableDraw) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      
      await import('leaflet-draw');
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const drawControl = new (L as any).Control.Draw({
        position: 'topleft',
        edit: { featureGroup: drawnItems },
        draw: {
          circlemarker: false,
          marker: true,
          polyline: true,
          polygon: true,
          rectangle: true,
          circle: true,
        },
      });
      map.addControl(drawControl);

      const formatDistance = (meters: number) => {
        if (!Number.isFinite(meters)) return '0 m';
        return meters >= 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`;
      };
      const formatArea = (sqm: number) => {
        if (!Number.isFinite(sqm)) return '0 m2';
        if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(3)} km2`;
        if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(3)} ha`;
        return `${sqm.toFixed(2)} m2`;
      };
      const polylineLength = (latlngs: any[]) => {
        let total = 0;
        for (let i = 1; i < latlngs.length; i += 1) total += map.distance(latlngs[i - 1], latlngs[i]);
        return total;
      };
      const polygonAreaApprox = (latlngs: any[]) => {
        if (!Array.isArray(latlngs) || latlngs.length < 3) return 0;
        const rad = Math.PI / 180;
        const pts = latlngs.map((p: any) => {
          const x = p.lng * 111320 * Math.cos(p.lat * rad);
          const y = p.lat * 110540;
          return { x, y };
        });
        let sum = 0;
        for (let i = 0; i < pts.length; i += 1) {
          const j = (i + 1) % pts.length;
          sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        }
        return Math.abs(sum) / 2;
      };

      const onCreated = (e: any) => {
        const layerType = String(e?.layerType ?? '');
        const layer = e?.layer;
        if (!layer) return;
        drawnItems.addLayer(layer);

        let html = '<b>Draw Result</b>';
        if (layerType === 'marker') {
          const p = layer.getLatLng?.();
          html += `<br/>Point: ${p?.lat?.toFixed?.(6) ?? '--'}, ${p?.lng?.toFixed?.(6) ?? '--'}`;
        } else if (layerType === 'polyline') {
          const latlngs = layer.getLatLngs?.() ?? [];
          const len = polylineLength(latlngs);
          html += `<br/>Length: ${formatDistance(len)}`;
        } else if (layerType === 'polygon' || layerType === 'rectangle') {
          const ring = (layer.getLatLngs?.()?.[0] ?? []) as any[];
          const area = polygonAreaApprox(ring);
          html += `<br/>Area: ${formatArea(area)}`;
        } else if (layerType === 'circle') {
          const radius = Number(layer.getRadius?.() ?? 0);
          const area = Math.PI * radius * radius;
          html += `<br/>Radius: ${formatDistance(radius)}`;
          html += `<br/>Area: ${formatArea(area)}`;
        }

        layer.bindPopup?.(html);
        layer.openPopup?.();
      };
      const drawCreatedEvent = (L as any).Draw?.Event?.CREATED ?? 'draw:created';
      map.on(drawCreatedEvent, onCreated);

      cleanups.push(() => {
        try {
          map.off(drawCreatedEvent, onCreated);
          map.removeControl(drawControl);
          map.removeLayer(drawnItems);
        } catch {}
      });
    } catch {}
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
