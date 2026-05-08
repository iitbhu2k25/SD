





// PDFExportButton.tsx
"use client";

import React, { useState, useEffect } from "react";
import { generateWaterAnalysisPDF } from "./WaterAnalysisPDF";

const GEOSERVER_URL =
  process.env.NEXT_PUBLIC_GEOSERVER_URL ;
const FAST_RASTER_WORKSPACE =
  process.env.NEXT_PUBLIC_FAST_RASTER_WORKSPACE ;
const DEFAULT_BBOX: [number, number, number, number] = [
  81.76016558413825,
  25.25164263659975,
  83.05823116969096,
  25.790631807071463,
];

const parseBBox = (value: unknown): [number, number, number, number] | null => {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 4) {
    const parsed = value.slice(0, 4).map((item) => Number(item));
    if (parsed.every((item) => Number.isFinite(item))) {
      return parsed as [number, number, number, number];
    }
  }

  if (typeof value === "string") {
    const parsed = value
      .split(",")
      .map((item) => Number(item.trim()))
      .slice(0, 4);
    if (parsed.length === 4 && parsed.every((item) => Number.isFinite(item))) {
      return parsed as [number, number, number, number];
    }
  }

  if (typeof value === "object") {
    const bbox = value as Record<string, unknown>;
    const candidates: Array<[unknown, unknown, unknown, unknown]> = [
      [bbox.minx, bbox.miny, bbox.maxx, bbox.maxy],
      [bbox.left, bbox.bottom, bbox.right, bbox.top],
    ];

    for (const candidate of candidates) {
      const parsed = candidate.map((item) => Number(item));
      if (parsed.every((item) => Number.isFinite(item))) {
        return parsed as [number, number, number, number];
      }
    }
  }

  return null;
};

const formatBBox = ([minLon, minLat, maxLon, maxLat]: [number, number, number, number]) =>
  `${minLon},${minLat},${maxLon},${maxLat}`;

const getLayerBBoxFromCapabilities = (
  capXml: Document | null,
  layerName: string,
): [number, number, number, number] | null => {
  if (!capXml) return null;

  let matchedBBox: [number, number, number, number] | null = null;

  capXml.querySelectorAll("Layer").forEach((layerNode) => {
    const nameNode = layerNode.querySelector(":scope > Name");
    if (
      nameNode?.textContent === `${FAST_RASTER_WORKSPACE}:${layerName}` ||
      nameNode?.textContent === layerName
    ) {
      const llBbox = layerNode.querySelector("LatLonBoundingBox");
      const node = llBbox ?? layerNode.querySelector("BoundingBox[SRS='EPSG:4326']");
      if (!node) return;

      const parsed = [
        Number(node.getAttribute("minx") ?? ""),
        Number(node.getAttribute("miny") ?? ""),
        Number(node.getAttribute("maxx") ?? ""),
        Number(node.getAttribute("maxy") ?? ""),
      ];

      if (parsed.every((item) => Number.isFinite(item))) {
        matchedBBox = parsed as [number, number, number, number];
      }
    }
  });

  return matchedBBox;
};

interface LegendClass {
  class: number;
  color: string;
  min: number;
  max: number;
  label: string;
}

interface LegendData {
  region_min: number;
  region_max: number;
  region_mean: number;
  classes: LegendClass[];
}

interface ClassPixelCount {
  class: number;
  color: string;
  label: string;
  pixel_count: number;
}

interface IndexRasterLike {
  year?: number;
  legend_data?: LegendData;
  class_pixel_counts?: ClassPixelCount[];
}

const computeClassShares = (
  raster: IndexRasterLike
): { label: string; color: string; pct: number }[] => {
  const classCounts = (raster.class_pixel_counts ?? [])
    .filter(
      (item) =>
        item.class >= 1 &&
        item.class <= 10 &&
        Number.isFinite(item.pixel_count) &&
        (item.pixel_count ?? 0) > 0
    )
    .sort((a, b) => a.class - b.class);

  if (classCounts.length > 0) {
    const totalPixelCount =
      classCounts.reduce((sum, item) => sum + (item.pixel_count ?? 0), 0) || 1;

    return classCounts.map((item) => ({
      label: item.label,
      color: item.color,
      pct: ((item.pixel_count ?? 0) / totalPixelCount) * 100,
    }));
  }

  const legendData = raster.legend_data;
  if (!legendData) return [];

  const validClasses = legendData.classes.filter(
    (item) => item.min !== 9999 && item.max !== 9999
  );
  if (validClasses.length === 0) return [];

  const mean = legendData.region_mean;
  const totalRange = legendData.region_max - legendData.region_min || 1;
  const sigma = totalRange / 3;

  const weights = validClasses.map((item) => {
    const mid = (item.min + item.max) / 2;
    const rangeWidth = item.max - item.min;
    const gaussian = Math.exp(-0.5 * Math.pow((mid - mean) / sigma, 2));
    return rangeWidth * gaussian;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return validClasses.map((item, index) => ({
    label: item.label,
    color: item.color,
    pct: (weights[index] / totalWeight) * 100,
  }));
};

interface PDFExportButtonProps {
  exportData: any;
  rasterResponse: any;
  subdistrictCodes?: number[];
  plotRef?: React.RefObject<HTMLDivElement>;
  onExportStart?: () => void;
  onExportComplete?: () => void;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  exportData,
  rasterResponse,
  subdistrictCodes = [],
  plotRef,
  onExportStart,
  onExportComplete,
}) => {
  const [mapImageUrls, setMapImageUrls]       = useState<{ url: string; year: number }[]>([]);
  const [legendImageUrls, setLegendImageUrls] = useState<{ url: string; year: number }[]>([]);
  const [isLoadingMap, setIsLoadingMap]       = useState(false);
  const [isGenerating, setIsGenerating]       = useState(false);
  const [status, setStatus]                   = useState<"idle" | "loading" | "success" | "error">("idle");

  if (!exportData || !rasterResponse) return null;
  if (!rasterResponse.clipped_rasters?.length) return null;

  useEffect(() => {
    const fetchAllMaps = async () => {
      setIsLoadingMap(true);
      try {
        const rasters = rasterResponse.clipped_rasters;
        const W = 800;
        const H = 600;
        const responseBBox = parseBBox(rasterResponse?.bbox) ?? DEFAULT_BBOX;

        // ── Default BBOX ──────────────────────────────────────────────────
        let BBOX   = "81.76016558413825,25.25164263659975,83.05823116969096,25.790631807071463";
        let minLon = 81.76016558413825;
        let maxLon = 83.05823116969096;
        let minLat = 25.25164263659975;
        let maxLat = 25.790631807071463;

        // ── GetCapabilities with 5s timeout ──────────────────────────────
        try {
          const controller = new AbortController();
          const timeout    = setTimeout(() => controller.abort(), 5000);
          const capUrl     = `${GEOSERVER_URL}/${FAST_RASTER_WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
          const capRes     = await fetch(capUrl, { credentials: "include", signal: controller.signal });
          clearTimeout(timeout);

          const capText = await capRes.text();
          const parser  = new DOMParser();
          const capXml  = parser.parseFromString(capText, "text/xml");

          const firstRaster = rasters[0];
          capXml.querySelectorAll("Layer").forEach((layerNode) => {
            const nameNode = layerNode.querySelector(":scope > Name");
            if (
              nameNode?.textContent === `${FAST_RASTER_WORKSPACE}:${firstRaster.layer_name}` ||
              nameNode?.textContent === firstRaster.layer_name
            ) {
              const llBbox = layerNode.querySelector("LatLonBoundingBox");
              const node   = llBbox ?? layerNode.querySelector("BoundingBox[SRS='EPSG:4326']");
              if (node) {
                const x1 = parseFloat(node.getAttribute("minx") ?? "");
                const y1 = parseFloat(node.getAttribute("miny") ?? "");
                const x2 = parseFloat(node.getAttribute("maxx") ?? "");
                const y2 = parseFloat(node.getAttribute("maxy") ?? "");
                if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
                  minLon = x1; minLat = y1; maxLon = x2; maxLat = y2;
                  BBOX   = `${x1},${y1},${x2},${y2}`;
                }
              }
            }
          });
          console.log("Using BBOX:", BBOX);
        } catch (capErr) {
          console.warn("GetCapabilities failed/timeout, using default BBOX:", capErr);
        }

        const loadImage = (
          src: string,
          crossOriginMode: "anonymous" | "use-credentials" = "anonymous",
        ): Promise<HTMLImageElement> =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = crossOriginMode;
            img.onload  = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed: ${src}`));
            img.src = src;
          });

        // ── Draw satellite tiles once (shared background) ─────────────────
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width  = W;
        bgCanvas.height = H;
        const bgCtx = bgCanvas.getContext("2d")!;

        try {
          const zoom     = 11;
          const lon2tile = (lon: number, z: number) => Math.floor((lon + 180) / 360 * Math.pow(2, z));
          const lat2tile = (lat: number, z: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
          const tile2lon = (x: number, z: number) => x / Math.pow(2, z) * 360 - 180;
          const tile2lat = (y: number, z: number) => { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
          const lonToPx  = (lon: number) => (lon - minLon) / (maxLon - minLon) * W;
          const latToPx  = (lat: number) => (maxLat - lat) / (maxLat - minLat) * H;

          const xMin = lon2tile(minLon, zoom), xMax = lon2tile(maxLon, zoom);
          const yMin = lat2tile(maxLat, zoom), yMax = lat2tile(minLat, zoom);

          const tilePromises: Promise<void>[] = [];
          for (let tx = xMin; tx <= xMax; tx++) {
            for (let ty = yMin; ty <= yMax; ty++) {
              const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
              const px  = Math.round(lonToPx(tile2lon(tx,     zoom)));
              const py  = Math.round(latToPx(tile2lat(ty,     zoom)));
              const px2 = Math.round(lonToPx(tile2lon(tx + 1, zoom)));
              const py2 = Math.round(latToPx(tile2lat(ty + 1, zoom)));
              tilePromises.push(
                loadImage(tileUrl)
                  .then(img => { bgCtx.drawImage(img, px, py, px2 - px, py2 - py); })
                  .catch(() => {})
              );
            }
          }
          await Promise.all(tilePromises);
        } catch {
          bgCtx.fillStyle = "#c8d8c8";
          bgCtx.fillRect(0, 0, W, H);
        }

        // ── For each raster: composite bg + WMS layer ─────────────────────
        const backgroundCache = new Map<string, HTMLCanvasElement>([[BBOX, bgCanvas]]);
        const buildBackgroundCanvas = async (
          bbox: [number, number, number, number],
        ): Promise<HTMLCanvasElement> => {
          const bboxString = formatBBox(bbox);
          const cachedCanvas = backgroundCache.get(bboxString);
          if (cachedCanvas) {
            return cachedCanvas;
          }

          const [localMinLon, localMinLat, localMaxLon, localMaxLat] = bbox;
          const nextBgCanvas = document.createElement("canvas");
          nextBgCanvas.width = W;
          nextBgCanvas.height = H;
          const nextBgCtx = nextBgCanvas.getContext("2d")!;

          try {
            const zoom = 11;
            const lon2tile = (lon: number, z: number) => Math.floor((lon + 180) / 360 * Math.pow(2, z));
            const lat2tile = (lat: number, z: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
            const tile2lon = (x: number, z: number) => x / Math.pow(2, z) * 360 - 180;
            const tile2lat = (y: number, z: number) => { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
            const lonToPx = (lon: number) => (lon - localMinLon) / (localMaxLon - localMinLon) * W;
            const latToPx = (lat: number) => (localMaxLat - lat) / (localMaxLat - localMinLat) * H;

            const xMin = lon2tile(localMinLon, zoom), xMax = lon2tile(localMaxLon, zoom);
            const yMin = lat2tile(localMaxLat, zoom), yMax = lat2tile(localMinLat, zoom);

            const tilePromises: Promise<void>[] = [];
            for (let tx = xMin; tx <= xMax; tx++) {
              for (let ty = yMin; ty <= yMax; ty++) {
                const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
                const px = Math.round(lonToPx(tile2lon(tx, zoom)));
                const py = Math.round(latToPx(tile2lat(ty, zoom)));
                const px2 = Math.round(lonToPx(tile2lon(tx + 1, zoom)));
                const py2 = Math.round(latToPx(tile2lat(ty + 1, zoom)));
                tilePromises.push(
                  loadImage(tileUrl)
                    .then((img) => { nextBgCtx.drawImage(img, px, py, px2 - px, py2 - py); })
                    .catch(() => {})
                );
              }
            }
            await Promise.all(tilePromises);
          } catch {
            nextBgCtx.fillStyle = "#c8d8c8";
            nextBgCtx.fillRect(0, 0, W, H);
          }

          backgroundCache.set(bboxString, nextBgCanvas);
          return nextBgCanvas;
        };

        const mapResults: { url: string; year: number }[] = [];

        for (const raster of rasters) {
          const rasterBBox = parseBBox(raster?.bbox) ?? responseBBox;
          const rasterBBoxString = formatBBox(rasterBBox);
          const bgCanvasForRaster = await buildBackgroundCanvas(rasterBBox);

          const wmsUrl =
            `${GEOSERVER_URL}/${FAST_RASTER_WORKSPACE}/wms?` +
            new URLSearchParams({
              service:     "WMS",
              version:     "1.1.0",
              request:     "GetMap",
              layers:      `${FAST_RASTER_WORKSPACE}:${raster.layer_name}`,
              bbox:        rasterBBoxString,
              width:       String(W),
              height:      String(H),
              srs:         "EPSG:4326",
              format:      "image/png",
              TRANSPARENT: "TRUE",
              STYLES:      "",
            }).toString();

          const canvas = document.createElement("canvas");
          canvas.width  = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bgCanvasForRaster, 0, 0);

          try {
            const waterImg = await loadImage(wmsUrl, "anonymous");
            ctx.globalAlpha = 0.85;
            ctx.drawImage(waterImg, 0, 0, W, H);
            ctx.globalAlpha = 1.0;
          } catch {
            try {
              const waterImg = await loadImage(wmsUrl, "use-credentials");
              ctx.globalAlpha = 0.85;
              ctx.drawImage(waterImg, 0, 0, W, H);
              ctx.globalAlpha = 1.0;
            } catch {
              try {
                const res  = await fetch(wmsUrl, { credentials: "include" });
                const blob = await res.blob();
                const b64  = await new Promise<string>((res2) => {
                  const reader = new FileReader();
                  reader.onload = () => res2(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                const img2 = await loadImage(b64, "anonymous");
                ctx.globalAlpha = 0.85;
                ctx.drawImage(img2, 0, 0, W, H);
                ctx.globalAlpha = 1.0;
              } catch (e2) {
                console.warn(`WMS failed for ${raster.layer_name}:`, e2);
              }
            }
          }

          mapResults.push({ url: canvas.toDataURL("image/png"), year: raster.year });
        }

        setMapImageUrls(mapResults);

        // ── Legend: fetch separately for EACH raster ──────────────────────
        const legendResults: { url: string; year: number }[] = [];

        for (const raster of rasters) {
          try {
            const legendUrl =
              `${GEOSERVER_URL}/${FAST_RASTER_WORKSPACE}/wms?` +
              new URLSearchParams({
                service:        "WMS",
                version:        "1.1.0",
                request:        "GetLegendGraphic",
                layer:          `${FAST_RASTER_WORKSPACE}:${raster.layer_name}`,
                format:         "image/png",
                width:          "30",
                height:         "30",
                scale:          "500000",
                LEGEND_OPTIONS: [
                  "fontName:Arial", "fontSize:14", "fontAntiAliasing:true",
                  "bgColor:0xFFFFFF", "dpi:180", "forceLabels:on",
                  "labelMargin:4", "dx:4", "dy:4",
                ].join(";"),
              }).toString();

            let legRes = await fetch(legendUrl);
            if (!legRes.ok) {
              legRes = await fetch(legendUrl, { credentials: "include" });
            }

            if (!legRes.ok) {
              throw new Error(`Legend fetch failed with status ${legRes.status}`);
            }

            const legBlob = await legRes.blob();
            if (!legBlob.size) {
              throw new Error("Legend blob is empty");
            }

            const legB64  = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(legBlob);
            });
            legendResults.push({ url: legB64, year: raster.year });
          } catch (le) {
            console.warn(`Legend fetch failed for ${raster.layer_name}:`, le);
          }
        }

        setLegendImageUrls(legendResults);

      } catch (e) {
        console.error("Map fetch error:", e);
      } finally {
        setIsLoadingMap(false);
      }
    };

    fetchAllMaps();
  }, [rasterResponse]);

  // ── Capture Plotly chart ──────────────────────────────────
  const captureChart = async (): Promise<string | null> => {
    try {
      const targetDiv =
        plotRef?.current ??
        (document.querySelector(".js-plotly-plot") as HTMLElement | null);
      if (targetDiv) {
        const Plotly = (await import("plotly.js-dist-min")).default;
        return await (Plotly as any).toImage(targetDiv, {
          format: "png", width: 1000, height: 420, scale: 2,
        }) as string;
      }
    } catch (e) {
      console.warn("Chart capture failed:", e);
    }
    return null;
  };

  // ── Click handler ─────────────────────────────────────────
  const captureIndexCharts = async (): Promise<{ url: string; year: number }[]> => {
    try {
      const Plotly = (await import("plotly.js-dist-min")).default;
      const rasters = [...(rasterResponse?.clipped_rasters ?? [])].sort(
        (a, b) => (a.year ?? 0) - (b.year ?? 0)
      );
      const results: { url: string; year: number }[] = [];

      for (const raster of rasters) {
        const year = Number(raster?.year);
        if (!Number.isFinite(year)) continue;

        const visibleShares = computeClassShares(raster).filter(
          (share) => share.pct > 0.05
        );
        if (visibleShares.length === 0) continue;

        const tempDiv = document.createElement("div");
        tempDiv.style.position = "fixed";
        tempDiv.style.left = "-10000px";
        tempDiv.style.top = "0";
        tempDiv.style.width = "880px";
        tempDiv.style.height = "640px";
        document.body.appendChild(tempDiv);

        try {
          await Plotly.newPlot(
            tempDiv,
            [
              {
                type: "pie",
                hole: 0.56,
                values: visibleShares.map((item) => Number(item.pct.toFixed(2))),
                labels: visibleShares.map((item) => item.label),
                marker: {
                  colors: visibleShares.map((item) => item.color),
                  line: { color: "#f8fafc", width: 3 },
                },
                textinfo: "percent",
                textposition: "outside",
                textfont: { size: 18, color: "#334155" },
                automargin: true,
                hoverinfo: "skip",
                sort: false,
                direction: "clockwise",
              },
            ],
            {
              paper_bgcolor: "#ffffff",
              plot_bgcolor: "#ffffff",
              margin: { t: 28, r: 64, b: 28, l: 64 },
              showlegend: false,
              annotations: [
                {
                  text: `<b>${year}</b>`,
                  x: 0.5,
                  y: 0.5,
                  xanchor: "center",
                  yanchor: "middle",
                  showarrow: false,
                  font: { size: 24, color: "#0f172a" },
                },
              ],
            },
            {
              responsive: false,
              displayModeBar: false,
              staticPlot: true,
            }
          );

          const imageUrl = (await (Plotly as any).toImage(tempDiv, {
            format: "png",
            width: 1100,
            height: 800,
            scale: 2,
          })) as string;

          results.push({ url: imageUrl, year });
        } finally {
          Plotly.purge(tempDiv);
          tempDiv.remove();
        }
      }

      return results;
    } catch (error) {
      console.warn("Index donut chart capture failed:", error);
      return [];
    }
  };

  const handleDownload = () => {
    setIsGenerating(true);
    setStatus("loading");
    onExportStart?.();

    setTimeout(async () => {
      try {
        const isIndexProduct =
          String(exportData?.productType ?? "").toLowerCase() === "index";
        const capturedIndexCharts = isIndexProduct ? await captureIndexCharts() : [];
        const capturedChart = isIndexProduct ? null : await captureChart();

        const rawYear   = String(exportData.year);
        const yearArr   = rawYear.split(",").map((y) => parseInt(y.trim(), 10)).filter(Boolean);
        const startYear = yearArr.length > 0 ? Math.min(...yearArr) : Number(exportData.year);
        const endYear   = yearArr.length > 0 ? Math.max(...yearArr) : Number(exportData.year);

        await generateWaterAnalysisPDF({
          exportData:     { ...exportData, year: startYear, endYear },
          rasterResponse,
          subdistrictCodes,
          mapImageUrls:    mapImageUrls.length    > 0 ? mapImageUrls    : undefined,
          legendImageUrls: legendImageUrls.length > 0 ? legendImageUrls : undefined,
          chartImageUrls:  capturedIndexCharts.length > 0 ? capturedIndexCharts : undefined,
          chartImageUrl:   capturedChart ?? undefined,
        });

        setStatus("success");
        onExportComplete?.();
      } catch (err) {
        console.error("PDF generation error:", err);
        setStatus("error");
      } finally {
        setTimeout(() => { setIsGenerating(false); setStatus("idle"); }, 2000);
      }
    }, 50);
  };

  // ── Derived state ─────────────────────────────────────────
  const busy  = isLoadingMap || isGenerating;
  const label = isLoadingMap
    ? `Generating Maps… (${mapImageUrls.length}/${rasterResponse.clipped_rasters.length})`
    : isGenerating         ? "Generating PDF…"
    : status === "success" ? "✅ Downloaded!"
    : status === "error"   ? "❌ Error – Retry"
    : "📄 Download Water Availability Report";

  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className={`
        mx-auto px-6 py-3 rounded-lg font-semibold flex justify-center items-center gap-2
        backdrop-blur shadow-lg overflow-hidden transition-all duration-300
        hover:shadow-xl hover:scale-105 cursor-pointer
        ${busy
          ? "bg-gray-400 cursor-not-allowed"
          : status === "success" ? "bg-green-600 text-white"
          : status === "error"   ? "bg-red-600 text-white"
          : "bg-emerald-600 text-white hover:bg-emerald-700"
        }
      `}
    >
      {busy && (
        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {label}
    </button>
  );
};

export default PDFExportButton;
