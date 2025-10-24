"use client";

import React, { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";

const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapRef.current) {
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([78.9629, 20.5937]), // Center of India
          zoom: 5,
        }),
      });

      return () => {
        map.setTarget(undefined);
      };
    }
  }, []);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg shadow-md border-2 border-gray-200 group-hover:border-blue-500 transition-colors duration-200"
    />
  );
};

export default MapComponent;