'use client';

import { useEffect, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";

import { fetchGeoServerGeoJson } from "../services/location.service";
import { useGwaStore } from "../store/gwa.store";
import { attachLeafletCommonControls } from "../utils/leafletCommonControls";

export default function AdminMapLayer({ className }: { className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const controlsCleanupRef = useRef<null | (() => void)>(null);
  const baseLayerRef = useRef<any>(null);
  const selectionLayerRef = useRef<any>(null);

  const { adminSelection, confirmedLocation } = useGwaStore();
  const [loading, setLoading] = useState(true);
  const activeSelection =
    confirmedLocation?.mode === "admin" && confirmedLocation.admin ? confirmedLocation.admin : adminSelection;

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
      LRef.current = L;
      mapRef.current = map;

      try {
        const india = await fetchGeoServerGeoJson("B_State");
        baseLayerRef.current = L.geoJSON(india as any, {
          style: () => ({
            color: "#1d4ed8",
            weight: 1.5,
            opacity: 0.9,
            fillOpacity: 0,
          }),
        }).addTo(map);

        const bounds = baseLayerRef.current.getBounds?.();
        if (bounds?.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 6 });
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

    const loadSelectionLayer = async () => {
      if (selectionLayerRef.current) {
        mapRef.current.removeLayer(selectionLayerRef.current);
        selectionLayerRef.current = null;
      }

      let layerName = "";
      let cqlFilter = "";
      let style = {
        color: "#dc2626",
        weight: 3,
        opacity: 1,
        fillColor: "#fca5a5",
        fillOpacity: 0.18,
      };

      if (activeSelection.subDistricts.length > 0) {
        layerName = "B_subdistrict";
        cqlFilter = `SUBDIS_COD IN (${activeSelection.subDistricts.map((item) => `'${item.subdistrict_code}'`).join(",")})`;
        style = { color: "#7c3aed", weight: 3, opacity: 1, fillColor: "#c4b5fd", fillOpacity: 0.25 };
      } else if (activeSelection.districts.length > 0) {
        layerName = "B_district";
        cqlFilter = `DISTRICT_C IN (${activeSelection.districts.map((item) => `'${item.district_code}'`).join(",")})`;
        style = { color: "#15803d", weight: 3, opacity: 1, fillColor: "#86efac", fillOpacity: 0.2 };
      } else if (activeSelection.state) {
        layerName = "B_State";
        cqlFilter = `state_code = '${activeSelection.state.state_code.toString().padStart(2, "0")}'`;
      } else {
        return;
      }

      const geoJson = await fetchGeoServerGeoJson(layerName, cqlFilter);
      selectionLayerRef.current = L.geoJSON(geoJson as any, {
        style: () => style,
        onEachFeature: (feature: any, layer: any) => {
          const props = feature.properties ?? {};
          layer.bindPopup(props.name || props.NAME_2 || props.district || "Selected area");
        },
      }).addTo(mapRef.current);

      const bounds = selectionLayerRef.current.getBounds?.();
      if (bounds?.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: activeSelection.subDistricts.length ? 11 : 8 });
      }
    };

    loadSelectionLayer().catch(() => {});
  }, [activeSelection]);

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
