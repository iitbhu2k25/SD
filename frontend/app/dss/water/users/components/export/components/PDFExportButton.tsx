// "use client";

// import React, { useState, useEffect } from "react";
// import { PDFDownloadLink } from "@react-pdf/renderer";
// import { WaterAnalysisPDF } from "./WaterAnalysisPDF";

// interface PDFExportButtonProps {
//   exportData: any;
//   rasterResponse: any;
//   subdistrictCodes?: number[];
//   onExportStart?: () => void;
//   onExportComplete?: () => void;
// }

// export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
//   exportData,
//   rasterResponse,
//   subdistrictCodes = [],
//   onExportStart,
//   onExportComplete,
// }) => {
//   const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
//   const [isLoadingMap, setIsLoadingMap] = useState(false);
//   const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

//   if (!exportData || !rasterResponse) return null;
//   if (!rasterResponse.clipped_rasters?.length) return null;

//   const fileName = `water-availability-report-${exportData.year}-${exportData.season}.pdf`;

//   useEffect(() => {
//     const fetchMapImage = async () => {
//       setIsLoadingMap(true);
//       try {
//         const raster = rasterResponse.clipped_rasters[0];

//         const wmsUrl =
//           `/geoserver/api/water_Availability/wms?` +
//           new URLSearchParams({
//             service: "WMS",
//             version: "1.1.0",
//             request: "GetMap",
//             layers: `water_Availability:${raster.layer_name}`,
//             bbox: "81.76016558413825,25.25164263659975,83.05823116969096,25.790631807071463",
//             width: "800",
//             height: "600",
//             srs: "EPSG:4326",
//             format: "image/png",
//           }).toString();

//         const res = await fetch(wmsUrl, { credentials: "include" });
//         const blob = await res.blob();

//         const reader = new FileReader();
//         reader.onload = () => setMapImageUrl(reader.result as string);
//         reader.readAsDataURL(blob);
//       } catch (e) {
//         console.error("Map fetch error:", e);
//       } finally {
//         setIsLoadingMap(false);
//       }
//     };

//     fetchMapImage();
//   }, [rasterResponse]);

//   return (
//     <PDFDownloadLink
//       document={
//         <WaterAnalysisPDF
//           exportData={exportData}
//           rasterResponse={rasterResponse}
//           subdistrictCodes={subdistrictCodes}
//           mapImageUrl={mapImageUrl || undefined}
//         />
//       }
//       fileName={fileName}
//       onClick={() => {
//         setIsDownloadingPdf(true);
//         onExportStart?.();
//       }}
//     >
//       {({ loading }) => {
//         useEffect(() => {
//           if (!loading && isDownloadingPdf) {
//             const t = setTimeout(() => {
//               setIsDownloadingPdf(false);
//               onExportComplete?.();
//             }, 700);
//             return () => clearTimeout(t);
//           }
//         }, [loading]);

//         return (
//           <button
//             disabled={loading || isLoadingMap || !mapImageUrl}
//             className={`mx-auto px-6 py-3 rounded-lg font-semibold flex justify-center items-center gap-2 cursor-pointer backdrop-blur shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${
//               loading || isLoadingMap || isDownloadingPdf
//                 ? "bg-gray-400 cursor-not-allowed"
//                 : "bg-emerald-600 text-white hover:bg-emerald-700"
//             }`}
//           >
//             {loading || isLoadingMap || isDownloadingPdf ? (
//               <>
//                 <span className="animate-spin">⏳</span>
//                 {isLoadingMap ? "Generating Map..." : "Generating PDF..."}
//               </>
//             ) : (
//               <>
//                 <span>📄</span>
//                 Download Water Availability Report
//               </>
//             )}
//           </button>
//         );
//       }}
//     </PDFDownloadLink>
//   );
// };

// export default PDFExportButton;







// PDFExportButton.tsx
"use client";

import React, { useState, useEffect } from "react";
import { generateWaterAnalysisPDF } from "./WaterAnalysisPDF";

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
          const capUrl     = `/geoserver/api/water_Availability/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
          const capRes     = await fetch(capUrl, { credentials: "include", signal: controller.signal });
          clearTimeout(timeout);

          const capText = await capRes.text();
          const parser  = new DOMParser();
          const capXml  = parser.parseFromString(capText, "text/xml");

          const firstRaster = rasters[0];
          capXml.querySelectorAll("Layer").forEach((layerNode) => {
            const nameNode = layerNode.querySelector(":scope > Name");
            if (
              nameNode?.textContent === `water_Availability:${firstRaster.layer_name}` ||
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

        const loadImage = (src: string, useCredentials = false): Promise<HTMLImageElement> =>
          new Promise((resolve, reject) => {
            const img = new Image();
            if (useCredentials) img.crossOrigin = "use-credentials";
            else img.crossOrigin = "anonymous";
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
        const mapResults: { url: string; year: number }[] = [];

        for (const raster of rasters) {
          const wmsUrl =
            `/geoserver/api/water_Availability/wms?` +
            new URLSearchParams({
              service:     "WMS",
              version:     "1.1.0",
              request:     "GetMap",
              layers:      `water_Availability:${raster.layer_name}`,
              bbox:        BBOX,
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
          ctx.drawImage(bgCanvas, 0, 0);

          try {
            const waterImg = await loadImage(wmsUrl, true);
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
              const img2 = await loadImage(b64);
              ctx.globalAlpha = 0.85;
              ctx.drawImage(img2, 0, 0, W, H);
              ctx.globalAlpha = 1.0;
            } catch (e2) {
              console.warn(`WMS failed for ${raster.layer_name}:`, e2);
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
              `/geoserver/api/water_Availability/wms?` +
              new URLSearchParams({
                service:        "WMS",
                version:        "1.1.0",
                request:        "GetLegendGraphic",
                layer:          `water_Availability:${raster.layer_name}`,
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

            const legRes  = await fetch(legendUrl, { credentials: "include" });
            const legBlob = await legRes.blob();
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
  const handleDownload = () => {
    setIsGenerating(true);
    setStatus("loading");
    onExportStart?.();

    setTimeout(async () => {
      try {
        const capturedChart = await captureChart();

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