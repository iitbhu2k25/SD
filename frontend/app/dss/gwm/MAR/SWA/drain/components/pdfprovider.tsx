// components/pdfprovider.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { buildMergedSeries } from '@/app/dss/gwm/MAR/SWA/drain/components/surfacewater'; // adjust path if needed
import { useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';
import { useStreamFlowContext } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { useSurfaceWater } from '@/contexts/surfacewater_assessment/drain/SurfaceWater';
import { useEflow } from '@/contexts/surfacewater_assessment/drain/EFlowContext';
import { useClimate } from '@/contexts/surfacewater_assessment/drain/ClimateContext';

interface PdfContextType {
  isPdfReady: boolean;
  isPreparingPdf: boolean;
  pdfError: string | null;
  pdfData: any;
  handlePreparePDF: () => Promise<void>;
  resetPdf: () => void;
}

const PdfContext = createContext<PdfContextType | undefined>(undefined);

export const PdfProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectionConfirmed, selectedSubbasins } = useLocationContext();
  const { series, hasData } = useStreamFlowContext();
  const { results } = useSurfaceWater();
  const { results: eflowResults } = useEflow();
  const { results: climateResults } = useClimate();

  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<any>(null);

  // Helper to reduce data points to maxPoints preserving shape
  const reduceDataPoints = (data: any[], maxPoints: number) => {
    if (!data || data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0);
  };

  // Fetch subbasin map image from API
  const fetchSubbasinMapImage = async (subbasinIds: number[]): Promise<string | null> => {
    try {
      const response = await fetch('/django/swa/generate-subbasin-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subbasin_ids: subbasinIds }),
      });
      if (!response.ok) throw new Error('Failed to fetch subbasin map image');
      const data = await response.json();
      return data.image_base64 || null;
    } catch (error) {
      console.error('Error fetching subbasin map image:', error);
      return null;
    }
  };

  const handlePreparePDF = async () => {
    if (!selectionConfirmed) return;

    setIsPreparingPdf(true);
    setPdfError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const { merged, q25 } = buildMergedSeries(results);

      const subbasinIds = selectedSubbasins.map((s) => s.sub);

      // Fetch map image for selected subbasins
      const mapImageBase64 = await fetchSubbasinMapImage(subbasinIds);

      // Attach the map image to subbasin results for matching subbasins
      const subbasinResultsArray = results
        ? Object.entries(results)
            .filter(([subId, val]) => val && typeof val === 'object' && !('error' in val))
            .map(([subId, val]: [string, any]) => ({
              subbasin: Number(subId),
              years: val.years || [],
              Q25_cms: val.Q25_cms,
              image_base64: subbasinIds.includes(Number(subId)) ? mapImageBase64 : val.image_base64,
              timeseries: val.timeseries || [],
            }))
        : [];

      const eflowData = eflowResults
        ? Object.entries(eflowResults)
            .filter(([_, val]) => val && typeof val === 'object' && !('error' in val))
            .reduce((acc, [subId, val]: [string, any]) => {
              acc[Number(subId)] = {
                summary: val.summary || {},
                curves: val.curves || {},
              };
              return acc;
            }, {} as Record<number, any>)
        : {};

      const climateData = climateResults || {};

      const reducedMergedSeries = reduceDataPoints(merged, 100);
      const reducedSeries = series.map((s) => ({
        ...s,
        data: reduceDataPoints(s.data || [], 100),
      }));

      setPdfData({
        series: reducedSeries,
        hasData,
        selectedSubbasins,
        surfaceWaterResults: {
          mergedSeries: reducedMergedSeries,
          q25,
          subbasinResults: subbasinResultsArray,
        },
        eflowResults: eflowData,
        climateResults: climateData,
      });

      setIsPdfReady(true);
    } catch (error) {
      console.error('Error preparing PDF:', error);
      setPdfError('Failed to prepare PDF data. Please try again.');
    } finally {
      setIsPreparingPdf(false);
    }
  };

  const resetPdf = () => {
    setIsPdfReady(false);
    setPdfData(null);
    setPdfError(null);
  };

  React.useEffect(() => {
    resetPdf();
  }, [selectedSubbasins, results]);

  return (
    <PdfContext.Provider
      value={{ isPdfReady, isPreparingPdf, pdfError, pdfData, handlePreparePDF, resetPdf }}
    >
      {children}
    </PdfContext.Provider>
  );
};

export const usePdf = (): PdfContextType => {
  const context = useContext(PdfContext);
  if (!context) {
    throw new Error('usePdf must be used within a PdfProvider');
  }
  return context;
};
