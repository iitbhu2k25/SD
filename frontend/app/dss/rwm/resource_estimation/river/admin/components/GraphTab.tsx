"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type Plotly from "plotly.js-dist-min";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ProfilePoint {
  distance_m: number;
  value: number;
}

interface ProfileMeta {
  resolution_m: number;
  river_length_m: number;
  river_length_km: number;
  total_points: number;
  valid_points: number;
}

interface GraphTabProps {
  selectedAttributeLabel: string;
  interpolationLayerName: string | null;
  riverBufferData: any;
  isPreparingRaster?: boolean;
  rasterError?: string | null;
}

const LINE_COLOR = "#2563eb";

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace("#", "");
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const GraphTab: React.FC<GraphTabProps> = ({
  selectedAttributeLabel,
  interpolationLayerName,
  riverBufferData,
  isPreparingRaster = false,
  rasterError = null,
}) => {
  const [profileData, setProfileData] = useState<ProfilePoint[]>([]);
  const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!interpolationLayerName || !riverBufferData) {
      setProfileData([]);
      setProfileMeta(null);
      setProfileError(null);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/rwm/wqi-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layer_name: interpolationLayerName,
            river_buffer_data: riverBufferData,
            profile_step_m: 100,
          }),
        });

        const result = await response.json();
        if (cancelled) return;

        const normalizedProfileData = Array.isArray(result.profile_data)
          ? result.profile_data
              .map((point: any) => ({
                distance_m: Number(point?.distance_m),
                value: Number(point?.value ?? point?.wqi),
              }))
              .filter(
                (point: ProfilePoint) =>
                  Number.isFinite(point.distance_m) && Number.isFinite(point.value),
              )
          : [];

        if (result.success && normalizedProfileData.length > 0) {
          setProfileData(normalizedProfileData);
          setProfileMeta(result.profile_meta || null);
        } else {
          setProfileData([]);
          setProfileMeta(null);
          if (!result.success) {
            setProfileError(result.error || "Profile generation failed");
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setProfileError(error?.message || "Network error");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [interpolationLayerName, riverBufferData]);

  const profileTraces = useMemo(() => {
    if (profileData.length === 0) return [];

    return [
      {
        type: "scatter",
        mode: "lines",
        name: selectedAttributeLabel,
        x: profileData.map((point) => point.distance_m),
        y: profileData.map((point) => point.value),
        connectgaps: true,
        line: { color: LINE_COLOR, width: 2, shape: "linear" },
        fill: "tozeroy",
        fillcolor: hexToRgba(LINE_COLOR, 0.18),
        hovertemplate: `Length: %{x:.0f} m<br>${selectedAttributeLabel}: %{y:.2f}<extra></extra>`,
      } as Partial<Plotly.Data>,
    ];
  }, [profileData, selectedAttributeLabel]);

  const profileLayout = useMemo<Partial<Plotly.Layout>>(
    () => ({
      autosize: true,
      margin: { t: 12, r: 24, b: 56, l: 52 },
      plot_bgcolor: "#f8fafc",
      paper_bgcolor: "#ffffff",
      font: { family: "Cambria, Georgia, serif" },
      hovermode: "x unified",
      legend: { orientation: "h", y: -0.22, x: 0 },
      xaxis: {
        title: { text: "Length (m)" },
        showgrid: true,
        gridcolor: "#e5e7eb",
        zeroline: false,
      },
      yaxis: {
        title: { text: selectedAttributeLabel },
        showgrid: true,
        gridcolor: "#e5e7eb",
        zeroline: false,
      },
    }),
    [selectedAttributeLabel],
  );

  if (profileData.length === 0 && !profileLoading && !isPreparingRaster) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-violet-400">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📈</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-700 mb-2">
              No Graph Data Available
            </h4>
            <p className="text-gray-500 max-w-md">
              Select a parameter, confirm your area, and generate interpolation to
              see the selected parameter graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-violet-400">
        <div className="flex items-center justify-between p-5 border-b border-gray-100/80">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 shadow-sm" />
            <h3 className="text-lg font-bold text-gray-800">
              {selectedAttributeLabel} Longitudinal Profile
            </h3>
            <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-100 text-violet-700">
              Selected Parameter
            </span>
          </div>
          {profileMeta && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>River Length: {profileMeta.river_length_km} km</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-4">
          {(isPreparingRaster || profileLoading) && (
            <div className="flex items-center justify-center h-[340px]">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {isPreparingRaster
                    ? `Preparing ${selectedAttributeLabel} raster...`
                    : `Generating ${selectedAttributeLabel} profile...`}
                </p>
              </div>
            </div>
          )}

          {!profileLoading && !isPreparingRaster && profileData.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">
                Longitudinal profile along the river buffer centerline
              </p>
              <div
                id="admin-parameter-profile-chart"
                className="h-[340px] w-full"
              >
                <Plot
                  data={profileTraces}
                  layout={profileLayout}
                  config={{
                    responsive: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["lasso2d", "select2d"],
                  }}
                  style={{ width: "100%", height: "100%" }}
                  useResizeHandler
                />
              </div>
            </>
          )}

          {!profileLoading &&
            !isPreparingRaster &&
            profileData.length === 0 &&
            !profileError && (
              <div className="flex items-center justify-center h-[200px]">
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    {interpolationLayerName
                      ? `No profile data returned for ${selectedAttributeLabel}.`
                      : `Open the graph tab after ${selectedAttributeLabel} raster preparation completes.`}
                  </p>
                </div>
              </div>
            )}

          {!profileLoading && !isPreparingRaster && (profileError || rasterError) && (
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <p className="text-sm text-red-500 mb-1">
                  Warning: {profileError || rasterError}
                </p>
                <p className="text-xs text-gray-400">
                  Make sure interpolation can be prepared for the selected season
                  and parameter.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GraphTab;
