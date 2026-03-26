"use client";

import { useState, useRef } from "react";
import { BarChart3, Info, FileSpreadsheet, PlusCircle, CheckCircle2, AlertTriangle, FilePlus2, Search, Loader2 } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "generating_raster" | "success" | "error";

interface WqiRasterInfo {
    layerName: string;
    workspace: string;
    styleName: string;
    statistics: {
        min: number;
        max: number;
        mean: number;
        points_used: number;
    };
    mapImage?: string;
    legendImage?: string;
    profileData?: Array<{
        distance_m: number;
        wqi: number | null;
    }>;
    profileMeta?: {
        length_m: number;
        step_m: number;
    } | null;
    rowProfileData?: Array<{
        distance_m: number;
        wqi: number | null;
    }>;
    rowProfileMeta?: {
        rows: number;
        pixel_size_m: number;
        direction: string;
    } | null;
    parameterLayers?: Record<string, string>;
    parameterStatistics?: Record<string, {
        min: number;
        max: number;
        mean: number;
        points_used: number;
    }>;
}

export interface CsvUploadResult {
    datasetLabel: string;
    sourceFileName: string;
    uploadId: string;
    totalPoints: number;
    validPoints: number;
    rejectedPoints: number;
    geojson: any;
    wqiSummary: {
        min: number;
        max: number;
        mean: number;
        countByClass: Record<string, number>;
    } | null;
    wqiRaster: WqiRasterInfo | null;
    givenParameters: string[];
    missingParameters: string[];
}

interface CsvUploadPanelProps {
    layerName: string;
    onUploadSuccess: (data: CsvUploadResult[]) => void;
    onReset?: () => void;
}

// Internal interface for tracking each file's state
interface CsvEntry {
    id: string;
    file: File | null;
    label: string;
    status: UploadStatus;
    result: CsvUploadResult | null;
    error?: string;
}

const API_BASE_URL = `${process.env.NEXT_PUBLIC_DJANGO_URL}`;
const RASTER_PARALLEL_LIMIT = 3;

const arrowCueAnimation = `
@keyframes csvArrowNudge {
    0%, 100% {
        transform: translateX(-5px) scale(0.95);
        opacity: 0.6;
    }
    50% {
        transform: translateX(0) scale(1);
        opacity: 1;
    }
}

.csv-arrow-indicator {
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-left: 13px solid #B47CFF;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
    animation: csvArrowNudge 1.2s ease-in-out infinite;
}
`;

const CsvUploadPanel: React.FC<CsvUploadPanelProps> = ({
    layerName,
    onUploadSuccess,
    onReset,
}) => {
    // Start with one empty entry
    const [entries, setEntries] = useState<CsvEntry[]>([
        { id: crypto.randomUUID(), file: null, label: "", status: "idle", result: null }
    ]);
    const [globalStatus, setGlobalStatus] = useState<UploadStatus>("idle");
    const [globalMessage, setGlobalMessage] = useState<string>("");
    const [showInfo, setShowInfo] = useState(false);

    // Refs for file inputs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeEntryIdRef = useRef<string | null>(null);

    const handleRemoveEntry = (id: string) => {
        if (globalStatus === "uploading" || globalStatus === "generating_raster") return;
        setEntries(prev => {
            const newEntries = prev.filter(e => e.id !== id);
            return newEntries.length > 0
                ? newEntries
                : [{ id: crypto.randomUUID(), file: null, label: "", status: "idle", result: null }];
        });
    };

    const handleBatchSelect = () => {
        if (globalStatus === "uploading" || globalStatus === "generating_raster") return;
        activeEntryIdRef.current = null; // Ensure we are in batch mode
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleFilesSelected = (files: FileList | null, targetEntryId: string | null) => {
        if (!files || files.length === 0) return;

        // CASE 1: Specific Entry (TargetEntryId is set)
        if (targetEntryId) {
            const firstFile = files[0];
            const otherFiles = Array.from(files).slice(1);

            const createEntry = (file: File) => ({
                id: crypto.randomUUID(),
                file: file,
                label: file.name.replace(".csv", ""),
                status: "idle" as UploadStatus,
                result: null,
                error: (file.size > 5 * 1024 * 1024) ? "File exceeds 5MB limit." : undefined
            });

            setEntries(prev => {
                let updatedEntries = prev.map(entry => {
                    if (entry.id === targetEntryId) {
                        let error: string | undefined;
                        if (!firstFile.name.endsWith(".csv")) error = "Only CSV files are allowed.";
                        else if (firstFile.size > 5 * 1024 * 1024) error = "File exceeds 5MB limit.";

                        return {
                            ...entry,
                            file: firstFile,
                            label: entry.label || firstFile.name.replace(".csv", ""),
                            status: "idle" as UploadStatus,
                            error: error,
                            result: null
                        };
                    }
                    return entry;
                });

                const newEntries: CsvEntry[] = [];
                otherFiles.forEach(file => {
                    if (file.name.endsWith(".csv")) {
                        newEntries.push(createEntry(file));
                    }
                });

                return [...updatedEntries, ...newEntries];
            });
            return;
        }

        // CASE 2: Batch Add (TargetEntryId is null)
        const newEntries: CsvEntry[] = [];
        Array.from(files).forEach(file => {
            if (!file.name.endsWith(".csv")) return;

            const defaultLabel = file.name.replace(".csv", "");
            newEntries.push({
                id: crypto.randomUUID(),
                file: file,
                label: defaultLabel,
                status: "idle",
                result: null,
                error: (file.size > 5 * 1024 * 1024) ? "File exceeds 5MB limit." : undefined
            });
        });

        if (newEntries.length > 0) {
            setEntries(prev => {
                const validPrev = prev.filter(e => e.file !== null);
                return [...validPrev, ...newEntries];
            });
        }
    };

    const updateEntry = (id: string, updates: Partial<CsvEntry>) => {
        setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const triggerFileSelect = (entryId: string) => {
        if (globalStatus === "uploading" || globalStatus === "generating_raster") return;
        activeEntryIdRef.current = entryId;
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const processUploadStep = async (entry: CsvEntry): Promise<CsvEntry> => {
        if (!entry.file) return entry;
        updateEntry(entry.id, { status: "uploading", error: undefined });

        try {
            const formData = new FormData();
            formData.append("file", entry.file);
            formData.append("layer_name", layerName);

            const response = await fetch(`${API_BASE_URL}/rwm/general/upload-csv`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                const errorMsg = data.missing_columns
                    ? `Missing required columns: ${data.missing_columns.join(", ")}`
                    : data.error || "Upload failed.";

                const updatedEntry: CsvEntry = { ...entry, status: "error", error: errorMsg };
                updateEntry(entry.id, updatedEntry);
                return updatedEntry;
            }

            if (data.valid_points === 0) {
                const updatedEntry: CsvEntry = {
                    ...entry,
                    status: "error",
                    error: "No points fall within the river buffer region."
                };
                updateEntry(entry.id, updatedEntry);
                return updatedEntry;
            }

            const geojsonData = data.geojson;
            // Add label to properties
            geojsonData.features = geojsonData.features.map((f: any) => ({
                ...f,
                properties: {
                    ...f.properties,
                    dataset_label: entry.label || entry.file?.name
                }
            }));

            const ALL_PARAMETERS = ['pH', 'DO', 'BOD', 'FC', 'Temperature', 'Turbidity', 'TDS', 'EC', 'TSS', 'COD', 'Nitrate'];
            const givenSet = [...(data.columns_found?.required || []), ...(data.columns_found?.optional || [])]
                .filter(col => !['lat', 'lon', 'latitude', 'longitude'].includes(col.toLowerCase()));
            const missingSet = ALL_PARAMETERS.filter(p => !givenSet.includes(p));

            const result: CsvUploadResult = {
                datasetLabel: entry.label || entry.file.name,
                sourceFileName: entry.file.name,
                uploadId: crypto.randomUUID(),
                totalPoints: data.total_points,
                validPoints: data.valid_points,
                rejectedPoints: data.rejected_points,
                geojson: geojsonData,
                wqiSummary: data.wqi_summary ? {
                    min: data.wqi_summary.min,
                    max: data.wqi_summary.max,
                    mean: data.wqi_summary.mean,
                    countByClass: data.wqi_summary.count_by_class,
                } : null,
                wqiRaster: null, // will be populated in next step
                givenParameters: givenSet,
                missingParameters: missingSet
            };

            const updatedEntry: CsvEntry = { ...entry, status: "success", result, error: undefined };
            updateEntry(entry.id, updatedEntry);
            return updatedEntry;

        } catch (error) {
            const updatedEntry: CsvEntry = { ...entry, status: "error", error: "Network error during upload" };
            updateEntry(entry.id, updatedEntry);
            return updatedEntry;
        }
    };

    const processInterpolationStep = async (entry: CsvEntry, minValue: number, maxValue: number): Promise<CsvEntry> => {
        if (!entry.result || entry.status === "error" || entry.result.validPoints === 0) {
            if (entry.result && entry.result.validPoints === 0 && entry.status !== "error") {
                const updatedEntry: CsvEntry = { ...entry, status: "success", error: "No valid points inside buffer for raster generation" };
                updateEntry(entry.id, updatedEntry);
                return updatedEntry;
            }
            return entry;
        }

        try {
            updateEntry(entry.id, { status: "generating_raster", error: undefined });
            const response = await fetch(`${API_BASE_URL}/rwm/general/interpolate-wqi`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    layer_name: layerName,
                    wqi_geojson: entry.result.geojson,
                    source_file_name: entry.result.sourceFileName,
                    upload_id: entry.result.uploadId,
                    min_value: minValue,
                    max_value: maxValue
                }),
            });

            const data = await response.json();
            console.log("[WQI-DEBUG] Interpolation response:", JSON.stringify(data).substring(0, 500));
            console.log("[WQI-DEBUG] Response success:", data.success, "layer_name:", data.layer_name, "parameter_layers:", data.parameter_layers);

            if (data.success) {
                const isStyleError = !!data.style_error;
                const finalStatus = isStyleError ? "error" : "success";
                const finalError = isStyleError ? `Raster created but styling failed: ${data.style_error}` : undefined;

                const updatedResult = {
                    ...entry.result,
                    wqiRaster: {
                        layerName: data.layer_name,
                        workspace: data.workspace,
                        styleName: data.style_name || "",
                        statistics: data.statistics,
                        mapImage: data.map_image,
                        legendImage: data.legend_image,
                        profileData: data.profile_data || [],
                        profileMeta: data.profile_meta || null,
                        rowProfileData: data.row_profile_data || [],
                        rowProfileMeta: data.row_profile_meta || null,
                        parameterLayers: data.parameter_layers || {},
                        parameterStatistics: data.parameter_statistics || {},
                    }
                };
                const updatedEntry: CsvEntry = { ...entry, status: finalStatus, result: updatedResult, error: finalError };
                updateEntry(entry.id, updatedEntry);
                return updatedEntry;
            } else {
                const updatedEntry: CsvEntry = { ...entry, status: "error", error: data.error || "Raster generation failed" };
                updateEntry(entry.id, updatedEntry);
                return updatedEntry;
            }
        } catch (error) {
            const updatedEntry: CsvEntry = { ...entry, status: "error", error: "Network error during raster generation" };
            updateEntry(entry.id, updatedEntry);
            return updatedEntry;
        }
    };

    const handleCalculateAll = async () => {
        const validEntries = entries.filter(e => e.file !== null);

        if (validEntries.length === 0) {
            setGlobalStatus("error");
            setGlobalMessage("Please select at least one CSV file.");
            return;
        }

        // Validate labels (must be non-empty and unique)
        const labels = validEntries.map(e => e.label.trim());
        if (labels.some(l => l === "")) {
            setGlobalStatus("error");
            setGlobalMessage("All datasets must have a valid label.");
            return;
        }

        const uniqueLabels = new Set(labels);
        if (uniqueLabels.size !== labels.length) {
            setGlobalStatus("error");
            setGlobalMessage("Dataset labels must be unique. Please resolve duplicates before analyzing.");
            return;
        }

        setGlobalStatus("uploading");
        setGlobalMessage("Uploading and validating points...");

        // Phase 1: Upload and extract points
        const uploadedEntries = await Promise.all(validEntries.map(entry => processUploadStep(entry)));

        const uploadedSuccessEntries = uploadedEntries.filter((e) => !!e.result);
        if (uploadedSuccessEntries.length === 0) {
            setGlobalStatus("error");
            setGlobalMessage("No files were uploaded successfully. Please check errors.");
            return;
        }

        // Push uploaded results immediately so user can inspect summary while rasters are generated.
        onUploadSuccess(
            uploadedEntries
                .map(e => e.result)
                .filter((r): r is CsvUploadResult => r !== null)
        );

        const failedUploads = uploadedEntries.filter(e => e.status === "error");
        const interpolationTargets = uploadedEntries.filter((e) => !!e.result && e.status !== "error");

        // Phase 2: Auto-generate rasters for all valid files (bounded parallelism).
        setGlobalStatus("generating_raster");
        setGlobalMessage(`Generating rasters (0/${interpolationTargets.length})...`);

        const entryMap = new Map(uploadedEntries.map((entry) => [entry.id, entry]));
        interpolationTargets.forEach((entry) => {
            updateEntry(entry.id, { status: "generating_raster", error: undefined });
        });

        const getCurrentResults = () =>
            uploadedEntries
                .map((entry) => entryMap.get(entry.id) || entry)
                .map((entry) => entry.result)
                .filter((r): r is CsvUploadResult => r !== null);

        let queueIndex = 0;
        let completed = 0;
        let failedInterpolations = 0;

        const worker = async () => {
            while (true) {
                const currentIndex = queueIndex++;
                if (currentIndex >= interpolationTargets.length) break;

                const target = interpolationTargets[currentIndex];
                const sourceMin = target.result?.wqiSummary?.min ?? 0;
                const sourceMax = target.result?.wqiSummary?.max ?? 100;
                const updatedEntry = await processInterpolationStep(target, sourceMin, sourceMax);
                entryMap.set(updatedEntry.id, updatedEntry);

                completed += 1;
                if (updatedEntry.status === "error") {
                    failedInterpolations += 1;
                }

                setGlobalMessage(`Generating rasters (${completed}/${interpolationTargets.length})...`);
                onUploadSuccess(getCurrentResults());
            }
        };

        const workerCount = Math.max(1, Math.min(RASTER_PARALLEL_LIMIT, interpolationTargets.length));
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        const validResults = uploadedEntries
            .map((entry) => entryMap.get(entry.id) || entry)
            .map(e => e.result)
            .filter((r): r is CsvUploadResult => r !== null);
        const successfulRasters = validResults.filter((r) => !!r.wqiRaster).length;

        onUploadSuccess(validResults);

        if (failedInterpolations > 0 || failedUploads.length > 0) {
            setGlobalStatus("error");
            setGlobalMessage(
                `Completed with issues: ${successfulRasters}/${validResults.length} rasters generated. ` +
                `${failedUploads.length} upload error(s), ${failedInterpolations} raster error(s).`
            );
            return;
        }

        setGlobalStatus("success");
        setGlobalMessage(`All ${validResults.length} file(s) processed and rasters generated successfully.`);
    };

    const resetAll = () => {
        setEntries([{ id: crypto.randomUUID(), file: null, label: "", status: "idle", result: null }]);
        setGlobalStatus("idle");
        setGlobalMessage("");
        if (onReset) onReset();
    };

    const isBusy = globalStatus === "uploading" || globalStatus === "generating_raster";

    return (
        <div className="w-full p-5 flex flex-col">
            <style>{arrowCueAnimation}</style>
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={(e) => {
                    handleFilesSelected(e.target.files, activeEntryIdRef.current);
                    activeEntryIdRef.current = null;
                }}
            />

            {/* Main Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">

                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-gray-800 mb-2 flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-purple-600" /> Water Quality Data (CSV)
                        </h3>
                        <p className="text-gray-600 text-sm">
                            Upload multiple CSV files for comparison and analysis. Rasters will be generated automatically.
                        </p>
                    </div>
                    <div className="relative flex items-center">
                        <div className="mr-2 csv-arrow-indicator" />
                        <button
                            onClick={() => setShowInfo(true)}
                            className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-colors cursor-pointer whitespace-nowrap shadow-sm hover:shadow"
                        >
                            <Info className="w-4 h-4" />
                            CSV Format
                        </button>
                    </div>
                </div>

                {/* File List */}
                <div className="space-y-3 mb-6">
                    {entries.map((entry) => (
                        <div key={entry.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
                            <div
                                onClick={() => triggerFileSelect(entry.id)}
                                className={`flex-1 flex items-center gap-3 p-2 rounded-md border border-dashed transition-colors ${isBusy ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${entry.file ? "bg-white border-green-300" : "bg-white border-gray-300 hover:border-purple-400"
                                    }`}
                            >
                                <div className="p-2 bg-gray-100 rounded-full flex items-center justify-center">
                                    {entry.file ? <FileSpreadsheet className="w-5 h-5 text-green-600" /> : <PlusCircle className="w-5 h-5 text-gray-400" />}
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-sm font-medium ${entry.file ? "text-gray-800" : "text-gray-400"}`}>
                                        {entry.file ? entry.file.name : "Click to select CSV"}
                                    </p>
                                    {entry.file && <p className="text-xs text-gray-500">{(entry.file.size / 1024).toFixed(1)} KB</p>}
                                </div>
                            </div>

                            {/* Label Input */}
                            <div className="w-full md:w-1/3">
                                <input
                                    type="text"
                                    placeholder="Label (e.g. Year 2023)"
                                    value={entry.label}
                                    disabled={isBusy}
                                    onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* Status and Remove */}
                            <div className="flex items-center gap-2">
                                {entry.status === 'uploading' && <span className="flex items-center gap-1 text-xs text-blue-600 font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                                {entry.status === 'generating_raster' && <span className="flex items-center gap-1 text-xs text-purple-600 font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Rasterizing...</span>}
                                {entry.status === 'success' && <span title="Processing complete"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>}
                                {entry.status === 'error' && <span title={entry.error}><AlertTriangle className="w-4 h-4 text-red-500 cursor-help" /></span>}

                                <button
                                    onClick={() => handleRemoveEntry(entry.id)}
                                    disabled={isBusy}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Remove file"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {entries.some(e => e.status === 'error') && (
                    <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Some files have errors. Hover over the error icons for details.
                    </div>
                )}

                {/* Add Button */}
                <button
                    onClick={handleBatchSelect}
                    disabled={isBusy}
                    className="mb-6 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FilePlus2 className="w-5 h-5" />
                    Add CSV Files
                </button>

                {/* Footer Actions */}
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleCalculateAll}
                            disabled={globalStatus === 'uploading' || globalStatus === 'generating_raster'}
                            className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center gap-2
                                ${(globalStatus === 'uploading' || globalStatus === 'generating_raster')
                                    ? "bg-gray-400 cursor-wait"
                                    : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-purple-200"
                                }
                            `}
                        >
                            {(globalStatus === 'uploading' || globalStatus === 'generating_raster') ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>{globalMessage}</span>
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" /> Upload & Generate
                                </>
                            )}
                        </button>

                        <button
                            onClick={resetAll}
                            disabled={globalStatus === 'uploading' || globalStatus === 'generating_raster'}
                            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-gray-600 border-2 border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Reset All
                        </button>
                    </div>

                    {globalMessage && globalStatus !== 'uploading' && globalStatus !== 'generating_raster' && (
                        <p className={`text-center text-sm mt-1 font-medium ${globalStatus === 'success' ? 'text-green-600' :
                            globalStatus === 'error' ? 'text-red-600' : 'text-blue-600'
                            }`}>
                            {globalMessage}
                        </p>
                    )}
                </div>

                {/* CSV Format Modal (Reused) */}
                {showInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowInfo(false)}>
                        <div
                            className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-4xl w-full mx-4 relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowInfo(false)}
                                className="absolute top-1 right-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full p-1.5 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>

                            <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 mt-1 pr-2 gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">CSV Column Format</h3>
                                    <p className="text-sm text-gray-500">Your CSV file should contain the following column headers</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-8 px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded-sm"></div>
                                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Required Parameters</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded-sm"></div>
                                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Optional Parameters</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            {['lat', 'lon', 'pH', 'DO', 'BOD', 'FC'].map(col => (
                                                <th key={col} className="border border-purple-300 bg-purple-100 text-purple-800 px-3 py-2.5 text-center font-bold font-mono">
                                                    {col}
                                                </th>
                                            ))}
                                            {['Temp', 'Turbidity', 'TDS', 'EC', 'TSS', 'COD', 'Nitrate'].map(col => (
                                                <th key={col} className="border border-blue-300 bg-blue-100 text-blue-700 px-3 py-2.5 text-center font-bold font-mono">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {['lat', 'lon', 'pH', 'DO', 'BOD', 'FC', 'Temp', 'Turbidity', 'TDS', 'EC', 'TSS', 'COD', 'Nitrate'].map(col => (
                                                <td key={col} className="border border-gray-200 bg-gray-50 px-3 py-2 text-center text-gray-400 italic text-xs">...</td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CsvUploadPanel;
