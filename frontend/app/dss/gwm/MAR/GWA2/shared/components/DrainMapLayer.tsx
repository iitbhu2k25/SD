'use client';

import { useEffect, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";

import { API_BASE_URL } from "../utils/constants";
import { attachLeafletCommonControls } from "../utils/leafletCommonControls";
import { useGwaStore } from "../store/gwa.store";

export default function DrainMapLayer({ className }: { className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const controlsCleanupRef = useRef<null | (() => void)>(null);
  const basinRef = useRef<any>(null);
  const riverRef = useRef<any>(null);
  const stretchRef = useRef<any>(null);
  const drainRef = useRef<any>(null);
  const villageRef = useRef<any>(null);

  const { drainSelection, confirmedLocation, setDrainSelectedVillageIds } = useGwaStore();
  const [loading, setLoading] = useState(true);

  const activeSelection =
    confirmedLocation?.mode === "drain" && confirmedLocation.drain ? confirmedLocation.drain : drainSelection;
  const locked = confirmedLocation?.mode === "drain";

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !mapContainerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current, {
        center: [23.5937, 80.9629],
        zoom: 5,
        preferCanvas: true,
      });

      const baseMaps = {
        Street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
        }),
        Satellite: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { attribution: "© Esri" },
        ),
        Light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: "© CARTO",
        }),
      };

      baseMaps.Street.addTo(map);
      L.control.layers(baseMaps, {}, { position: "topright", collapsed: true }).addTo(map);
      controlsCleanupRef.current = await attachLeafletCommonControls(L, map);
      mapRef.current = map;
      LRef.current = L;

      try {
        const basin = await (await fetch(`${API_BASE_URL}/basic/basin/`)).json();
        if (basin?.features?.length) {
          basinRef.current = L.geoJSON(basin, {
            style: () => ({
              color: "rgb(121,0,151)",
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0,
              dashArray: "5 5",
            }),
          }).addTo(map);
          const bounds = basinRef.current.getBounds?.();
          if (bounds?.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
        }

        const rivers = await (await fetch(`${API_BASE_URL}/basic/rivers/`)).json();
        if (rivers?.features?.length) {
          riverRef.current = L.geoJSON(rivers, {
            style: () => ({ color: "#f97316", weight: 3, opacity: 0.75 }),
          }).addTo(map);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      controlsCleanupRef.current?.();
      controlsCleanupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      LRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;

    const clearLayer = (ref: { current: any }) => {
      if (ref.current) {
        mapRef.current.removeLayer(ref.current);
        ref.current = null;
      }
    };

    const load = async () => {
      clearLayer(stretchRef);
      clearLayer(drainRef);
      clearLayer(villageRef);

      if (activeSelection.river) {
        const response = await fetch(`${API_BASE_URL}/basic/river-stretched/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ River_Code: activeSelection.river.code }),
        });
        const stretches = await response.json();
        if (stretches?.features?.length) {
          stretchRef.current = L.geoJSON(stretches, {
            style: (feature: any) => ({
              color:
                feature?.properties?.Stretch_ID?.toString() === activeSelection.stretch?.id
                  ? "#e11d48"
                  : "#16a34a",
              weight:
                feature?.properties?.Stretch_ID?.toString() === activeSelection.stretch?.id ? 5 : 2,
              opacity: 0.85,
            }),
          }).addTo(mapRef.current);
        }
      }

      if (activeSelection.stretch) {
        const response = await fetch(`${API_BASE_URL}/basic/drain/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Stretch_ID: activeSelection.stretch.stretchId }),
        });
        const drains = await response.json();
        if (drains?.features?.length) {
          drainRef.current = L.geoJSON(drains, {
            style: (feature: any) => ({
              color: activeSelection.drains.some(
                (item) => item.id === feature?.properties?.Drain_No?.toString(),
              )
                ? "#111827"
                : "#2563eb",
              weight: activeSelection.drains.some(
                (item) => item.id === feature?.properties?.Drain_No?.toString(),
              )
                ? 3
                : 1.5,
              opacity: 0.85,
            }),
            pointToLayer: (_feature: any, latlng: any) =>
              L.circleMarker(latlng, {
                radius: 4,
                color: "#2563eb",
                weight: 1,
                fillColor: "#60a5fa",
                fillOpacity: 0.85,
              }),
          }).addTo(mapRef.current);
        }
      }

      if (activeSelection.drains.length > 0) {
        const response = await fetch(`${API_BASE_URL}/basic/catchment_village/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Drain_No: activeSelection.drains.map((item) => item.drainNo) }),
        });
        const data = await response.json();

        if (data?.village_geojson?.features?.length) {
          villageRef.current = L.geoJSON(data.village_geojson, {
            style: (feature: any) => {
              const id = feature?.properties?.shapeID?.toString() ?? "";
              const selected = activeSelection.selectedVillageIds.includes(id);
              return {
                color: selected ? "#c2410c" : "#94a3b8",
                weight: selected ? 2.5 : 1.2,
                opacity: 0.95,
                fillColor: selected ? "#fbbf24" : "#ffffff",
                fillOpacity: selected ? 0.55 : 0.15,
              };
            },
            onEachFeature: (feature: any, layer: any) => {
              const id = feature?.properties?.shapeID?.toString() ?? "";
              const name = feature?.properties?.shapeName ?? "Village";
              layer.bindPopup(`${name}<br/><small>${id}</small>`);

              if (!locked && id) {
                layer.on("click", () => {
                  const current = new Set(activeSelection.selectedVillageIds);
                  if (current.has(id)) current.delete(id);
                  else current.add(id);
                  setDrainSelectedVillageIds([...current]);
                });
              }
            },
          }).addTo(mapRef.current);

          const bounds = villageRef.current.getBounds?.();
          if (bounds?.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
          }
        } else {
          const candidateLayer = drainRef.current || stretchRef.current || riverRef.current;
          const bounds = candidateLayer?.getBounds?.();
          if (bounds?.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
          }
        }
      } else {
        const candidateLayer = stretchRef.current || riverRef.current || basinRef.current;
        const bounds = candidateLayer?.getBounds?.();
        if (bounds?.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: activeSelection.river ? 10 : 8 });
        }
      }
    };

    load().catch(() => {});
  }, [activeSelection, locked, setDrainSelectedVillageIds]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div ref={mapContainerRef} className="h-full w-full" />



      {loading && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Loading map...
          </div>
        </div>
      )}
    </div>
  );
}
