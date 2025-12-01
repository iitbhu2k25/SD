// frontend/app/dss/gwm/MAR/SWA/drain/components/Export/page.tsx
'use client';

import React from 'react';
import { Document, Page, StyleSheet, Text } from '@react-pdf/renderer';
import HeaderSection from './components/Header';
import AreaSection from './components/area';
import FDCCurveSection from './components/stream';
import ConclusionSection from './components/Conclusion';
import ReferenceSection from './components/Reference';
import SurfaceWaterSection from './components/surfacewater';
import EFlowSection from './components/eflow';
import ClimateSection from './components/climate';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: 'grey',
  },
});

interface ExportPDFProps {
  series: any[];
  hasData: boolean;
  selectedSubbasins: { sub: number; area?: number }[];
  surfaceWaterResults: {
    mergedSeries: { day: number; flow: number; surplus: number }[];
    q25: number | null;
    subbasinResults?: Array<{
      subbasin: number;
      years: number[];
      Q25_cms?: number;
      image_base64?: string;
      timeseries: { day: number; flow: number }[];
    }>;
  } | null;
  eflowResults?: Record<number, {
    summary: Record<string, number>;
    curves: Record<string, {
      days: number[];
      flows: number[];
      threshold: number;
      image_base64?: string;
    }>;
  }>;
  climateResults?: Record<string, {
    subbasin_id: number;
    scenario: number;
    start_year: number;
    end_year: number;
    image_base64?: string;
    data?: {
      points: Array<{
        year: number;
        mon: number;
        flow_out: number;
      }>;
    };
  }>;
}

interface PDFPageProps {
  children: React.ReactNode;
}

const PDFPage: React.FC<PDFPageProps> = ({ children }) => (
  <Page size="A4" style={styles.page}>
    {children}
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  </Page>
);

const ExportPDF: React.FC<ExportPDFProps> = ({
  series,
  hasData,
  selectedSubbasins,
  surfaceWaterResults,
  eflowResults,
  climateResults
}) => {
  // Further optimize data if needed
  const optimizedSurfaceWaterResults = React.useMemo(() => {
    if (!surfaceWaterResults) return null;

    const { mergedSeries, q25, subbasinResults } = surfaceWaterResults;

    // If data is too large, sample it more aggressively
    let sampledSeries = mergedSeries;
    if (mergedSeries.length > 365) {
      // Keep every nth point to reduce to ~365 points max
      const step = Math.ceil(mergedSeries.length / 365);
      sampledSeries = mergedSeries.filter((_, index) => index % step === 0);
    }

    // Keep subbasin results as-is since they contain pre-rendered images
    return {
      mergedSeries: sampledSeries,
      q25,
      subbasinResults
    };
  }, [surfaceWaterResults]);

  const enrichedSelectedSubbasins = React.useMemo(() => {
    if (!surfaceWaterResults?.subbasinResults) return selectedSubbasins;

    // Map subbasin ID to its image_base64
    const imageMap = new Map(
      surfaceWaterResults.subbasinResults.map(sub => [sub.subbasin, sub.image_base64])
    );

    // Return selectedSubbasins enriched with image_base64 field
    return selectedSubbasins.map(sub => ({
      ...sub,
      image_base64: imageMap.get(sub.sub) || undefined,
    }));
  }, [selectedSubbasins, surfaceWaterResults]);

  return (
    <Document title="Surface Water Assessment Report" author="DSS Muskan">
      <PDFPage>
        <HeaderSection />
      </PDFPage>

      <PDFPage>
        <AreaSection selectedSubbasins={enrichedSelectedSubbasins} />
      </PDFPage>


      <PDFPage>
        <FDCCurveSection series={series} hasData={hasData} />
      </PDFPage>

      {/* Surface Water Section Page - Only if data exists */}
      {optimizedSurfaceWaterResults && (
        <PDFPage>
          <SurfaceWaterSection
            mergedSeries={optimizedSurfaceWaterResults.mergedSeries}
            q25={optimizedSurfaceWaterResults.q25}
            subbasinResults={optimizedSurfaceWaterResults.subbasinResults}
          />
        </PDFPage>
      )}

      {/* E-Flow Section Page - Only if data exists */}
      {eflowResults && Object.keys(eflowResults).length > 0 && (
        <PDFPage>
          <EFlowSection eflowResults={eflowResults} />
        </PDFPage>
      )}

      {/* Climate Section Page - Only if data exists*/}
      {climateResults && Object.keys(climateResults).length > 0 && (
        <PDFPage>
          <ClimateSection climateResults={climateResults} />
        </PDFPage>
      )}


      <PDFPage>
        <ConclusionSection />
      </PDFPage>

      <PDFPage>
        <ReferenceSection />
      </PDFPage>
    </Document>
  );
};

export default ExportPDF;