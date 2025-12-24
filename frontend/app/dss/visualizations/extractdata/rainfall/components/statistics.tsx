"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import JSZip from "jszip";

interface StatisticsOption {
  id: string;
  label: string;
  apiEndpoint: string;
  isZip?: boolean;
}

const statisticsOptions: StatisticsOption[] = [
  {
    id: "state-distribution",
    label: "Statewise Distribution of Districts",
    apiEndpoint: "/django/extract/rainfall_stats/statewise",
  },
  {
    id: "district-cumulative-departures",
    label: "District - Week by Week Departures (Cumulative)",
    apiEndpoint: "/django/extract/rainfall_stats/district/weekcumm",
    isZip: true,
  },
  {
    id: "district-departures",
    label: "District - Week by Week Departures",
    apiEndpoint: "/django/extract/rainfall_stats/district/weekly",
    isZip: true,
  },
  {
    id: "district-distribution",
    label: "District-wise Rainfall Distribution (Daily and Cumulative)",
    apiEndpoint: "/django/extract/rainfall_stats/district/D&C",
    isZip: true,
  },
  {
    id: "state-distribution-rainfall",
    label: "State-wise Rainfall Distribution (Daily and Cumulative)",
    apiEndpoint: "/django/extract/rainfall_stats/statewiseDC",
  },
];

export const RainfallStatistics = () => {
  const [selectedStat, setSelectedStat] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractImagesFromZip = async (blob: Blob): Promise<string[]> => {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(blob);
    const imageUrls: string[] = [];

    for (const [filename, file] of Object.entries(zipContent.files)) {
      if (!file.dir && /\.(png|jpg|jpeg|gif|svg)$/i.test(filename)) {
        const imageBlob = await file.async("blob");
        const url = URL.createObjectURL(imageBlob);
        imageUrls.push(url);
      }
    }

    return imageUrls;
  };

  const handleStatSelection = async (option: StatisticsOption) => {
    setSelectedStat(option.id);
    setLoading(true);
    setError(null);
    setImageUrls([]);
    setCurrentImageIndex(0);

    try {
      const response = await fetch(option.apiEndpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      const blob = await response.blob();

      if (option.isZip || contentType?.includes("zip") || contentType?.includes("application/x-zip-compressed")) {
        // Handle ZIP file
        const extractedImages = await extractImagesFromZip(blob);
        if (extractedImages.length === 0) {
          throw new Error("No images found in ZIP file");
        }
        setImageUrls(extractedImages);
      } else if (contentType?.includes("image")) {
        // Handle single image
        const url = URL.createObjectURL(blob);
        setImageUrls([url]);
      } else {
        throw new Error("Response is not an image or ZIP file");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (imageUrls.length > 0) {
      const link = document.createElement("a");
      link.href = imageUrls[currentImageIndex];
      link.download = `rainfall-statistics-${selectedStat}-${currentImageIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAll = () => {
    imageUrls.forEach((url, index) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = `rainfall-statistics-${selectedStat}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-white via-slate-50 to-gray-100">
      {/* Left Panel - Statistics Options */}
      <div className="w-96 flex flex-col bg-white border-r border-gray-200 shadow-lg">
        {/* Header */}
        <motion.div
          className="p-6 border-b border-gray-200"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BarChart3 className="text-blue-500" size={28} />
            Rainfall Statistics
          </h2>
          <p className="text-gray-600 mt-2 text-sm">
            Select a statistical analysis to view
          </p>
        </motion.div>

        {/* Statistics Options */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Available Statistics
          </h3>
          
          {statisticsOptions.map((option, index) => (
            <motion.button
              key={option.id}
              onClick={() => handleStatSelection(option)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                selectedStat === option.id
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-medium text-gray-800 text-sm block">
                    {option.label}
                  </span>
                  {option.isZip && (
                    <span className="text-xs text-gray-500 mt-1 block">
                      Multiple images
                    </span>
                  )}
                </div>
                {selectedStat === option.id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-2" />
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right Panel - Image Display */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">
                {selectedStat
                  ? statisticsOptions.find((opt) => opt.id === selectedStat)?.label
                  : "Preview"}
              </h3>
              {imageUrls.length > 1 && (
                <p className="text-sm text-gray-600 mt-1">
                  Image {currentImageIndex + 1} of {imageUrls.length}
                </p>
              )}
            </div>
            {imageUrls.length > 0 && !loading && (
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  <Download size={16} />
                  Download Current
                </button>
                {imageUrls.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download All
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          {loading && (
            <motion.div
              className="flex flex-col items-center justify-center h-full space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <p className="text-gray-600 font-medium">Loading statistics...</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <AlertTriangle size={20} />
              <span>{error}</span>
            </motion.div>
          )}

          {imageUrls.length > 0 && !loading && (
            <motion.div
              className="h-full flex flex-col"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border border-gray-200 flex items-center justify-center relative">
                <img
                  src={imageUrls[currentImageIndex]}
                  alt={`Rainfall Statistics ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />

                {/* Navigation Arrows */}
                {imageUrls.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevImage}
                      className="absolute left-8 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all hover:scale-110"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={24} className="text-gray-700" />
                    </button>
                    <button
                      onClick={goToNextImage}
                      className="absolute right-8 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all hover:scale-110"
                      aria-label="Next image"
                    >
                      <ChevronRight size={24} className="text-gray-700" />
                    </button>
                  </>
                )}
              </div>

              {/* Image Thumbnails */}
              {imageUrls.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {imageUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index
                          ? "border-blue-500 shadow-md"
                          : "border-gray-300 hover:border-blue-300"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!selectedStat && !loading && !error && (
            <motion.div
              className="flex flex-col items-center justify-center h-full text-gray-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <BarChart3 size={64} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a statistic to view</p>
              <p className="text-sm mt-2">Choose from the options on the left to display rainfall data</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};