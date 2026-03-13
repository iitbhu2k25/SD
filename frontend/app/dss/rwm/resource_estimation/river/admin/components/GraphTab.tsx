"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type Plotly from "plotly.js-dist-min";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend as RechartsLegend,
    ResponsiveContainer,
} from "recharts";
import { ProcessedWaterQualityData } from "@/contexts/riverwater_assessment/admin/ChartContext";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ─────────────────────────────── types ─────────────────────────────── */

interface ProfilePoint {
    distance_m: number;
    wqi: number;
}

interface ProfileMeta {
    resolution_m: number;
    river_length_m: number;
    river_length_km: number;
    total_points: number;
    valid_points: number;
}

interface GraphTabProps {
    filteredData: ProcessedWaterQualityData[];
    selectedAttribute: string;
    selectedAttributeLabel: string;
    selectedAttributeUnit: string;
    borderColors: Record<string, string>;
    parseValue: (value: string | number | null | undefined) => number;
    /* new props for WQI profile */
    currentInterpolationLayerName: string | null;
    riverBufferData: any;
}

/* ──────────────────────────── helpers ──────────────────────────────── */

const LINE_COLOR = "#2563eb";
const hexToRgba = (hex: string, alpha: number) => {
    const cleaned = hex.replace("#", "");
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const LOCATION_TYPES = ["Upstream", "Downstream", "Drain"] as const;

/* ──────────────────────────── component ───────────────────────────── */

const GraphTab: React.FC<GraphTabProps> = ({
    filteredData,
    selectedAttribute,
    selectedAttributeLabel,
    selectedAttributeUnit,
    borderColors,
    parseValue,
    currentInterpolationLayerName,
    riverBufferData,
}) => {
    /* ━━━ WQI Longitudinal Profile state ━━━ */
    const [profileData, setProfileData] = useState<ProfilePoint[]>([]);
    const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    /* Fetch profile whenever the interpolation layer changes */
    useEffect(() => {
        if (!currentInterpolationLayerName || !riverBufferData) {
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
                const response = await fetch("/django/rwm/wqi-profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        layer_name: currentInterpolationLayerName,
                        river_buffer_data: riverBufferData,
                        profile_step_m: 100,
                    }),
                });

                const result = await response.json();

                if (cancelled) return;

                if (result.success && result.profile_data?.length > 0) {
                    setProfileData(result.profile_data);
                    setProfileMeta(result.profile_meta || null);
                } else {
                    setProfileData([]);
                    setProfileMeta(null);
                    if (!result.success) {
                        setProfileError(result.error || "Profile generation failed");
                    }
                }
            } catch (err: any) {
                if (!cancelled) {
                    setProfileError(err.message || "Network error");
                }
            } finally {
                if (!cancelled) setProfileLoading(false);
            }
        };

        fetchProfile();
        return () => { cancelled = true; };
    }, [currentInterpolationLayerName, riverBufferData]);

    /* ━━━ Bar‐chart data (existing logic) ━━━ */
    const chartData = useMemo(() => {
        return LOCATION_TYPES.map((locationType) => {
            const locationData = filteredData.filter(
                (row) => row.location === locationType
            );
            const values = locationData
                .map((row) =>
                    parseValue(
                        row[selectedAttribute as keyof typeof row] as number | string
                    )
                )
                .filter((v) => v !== 0);

            if (values.length === 0) {
                return { locationType, min: 0, avg: 0, max: 0, count: 0 };
            }
            const min = Math.min(...values);
            const max = Math.max(...values);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return {
                locationType,
                min: parseFloat(min.toFixed(2)),
                avg: parseFloat(avg.toFixed(2)),
                max: parseFloat(max.toFixed(2)),
                count: values.length,
            };
        });
    }, [filteredData, selectedAttribute, parseValue]);

    const hasBarData = chartData.some((d) => d.count > 0);

    /* ━━━ Plotly traces for profile ━━━ */
    const profileTraces = useMemo(() => {
        if (profileData.length === 0) return [];
        return [
            {
                type: "scatter",
                mode: "lines",
                name: "WQI",
                x: profileData.map((p) => p.distance_m),
                y: profileData.map((p) => p.wqi),
                connectgaps: true,
                line: { color: LINE_COLOR, width: 2, shape: "linear" },
                fill: "tozeroy",
                fillcolor: hexToRgba(LINE_COLOR, 0.18),
                hovertemplate:
                    "Length: %{x:.0f} m<br>Value: %{y:.2f}<extra></extra>",
            } as Partial<Plotly.Data>,
        ];
    }, [profileData]);

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
                title: { text: "WQI Value" },
                showgrid: true,
                gridcolor: "#e5e7eb",
                zeroline: false,
            },
        }),
        []
    );

    /* ━━━ Metric colors for bar chart ━━━ */
    const metricColors: Record<string, string> = {
        min: "#10b981",
        avg: "#3b82f6",
        max: "#ef4444",
    };

    /* ━━━ No data at all ━━━ */
    if (!hasBarData && profileData.length === 0 && !profileLoading) {
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
                            Select a parameter, confirm your area, and generate interpolation to see the longitudinal profile and comparison graph.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ──────────── WQI Longitudinal Profile ──────────── */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-violet-400">
                <div className="flex items-center justify-between p-5 border-b border-gray-100/80">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 shadow-sm" />
                        <h3 className="text-lg font-bold text-gray-800">
                            WQI Longitudinal Profile
                        </h3>
                        <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-100 text-violet-700">
                            Water Quality Index
                        </span>
                    </div>
                    {profileMeta && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                                🛤️ {profileMeta.river_length_km} km
                            </span>
                            <span>
                                📍 {profileMeta.valid_points} points
                            </span>
                        </div>
                    )}
                </div>

                <div className="px-5 pb-5 pt-4">
                    {profileLoading && (
                        <div className="flex items-center justify-center h-[340px]">
                            <div className="text-center">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-sm text-gray-500">
                                    Generating longitudinal profile…
                                </p>
                            </div>
                        </div>
                    )}

                    {!profileLoading && profileData.length > 0 && (
                        <>
                            <p className="text-xs text-gray-400 mb-2">
                                (Longitudinal profile along the river buffer centerline)
                            </p>
                            <div
                                id="admin-wqi-profile-chart"
                                className="h-[340px] w-full"
                            >
                                <Plot
                                    data={profileTraces}
                                    layout={profileLayout}
                                    config={{
                                        responsive: true,
                                        displaylogo: false,
                                        modeBarButtonsToRemove: [
                                            "lasso2d",
                                            "select2d",
                                        ],
                                    }}
                                    style={{ width: "100%", height: "100%" }}
                                    useResizeHandler
                                />
                            </div>
                        </>
                    )}

                    {!profileLoading &&
                        profileData.length === 0 &&
                        !profileError && (
                            <div className="flex items-center justify-center h-[200px]">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500">
                                        {currentInterpolationLayerName
                                            ? "No profile data returned for this layer."
                                            : "Generate interpolation on the map to see the longitudinal profile."}
                                    </p>
                                </div>
                            </div>
                        )}

                    {!profileLoading && profileError && (
                        <div className="flex items-center justify-center h-[200px]">
                            <div className="text-center">
                                <p className="text-sm text-red-500 mb-1">
                                    ⚠️ {profileError}
                                </p>
                                <p className="text-xs text-gray-400">
                                    Make sure interpolation has been generated first.
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
