'use client';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/groundwater_assessment/drain/LocationContext';
import { useMap } from '@/contexts/groundwater_assessment/drain/MapContext';
import { useWell } from '@/contexts/groundwater_assessment/drain/WellContext';

interface VisualizationData {
  png_path: string;
  png_filename: string;
  png_base64: string;
  download_url: string;
}

interface GroundwaterContourContextType {
  geoJsonData: any;
  rasterData: any;
  visualizationData: VisualizationData | null;
  interpolationMethod: string;
  parameter: string;
  dataType: string;
  selectedYear: string;
  contourInterval: string;
  isLoading: boolean;
  error: string | null;
  setInterpolationMethod: (value: string) => void;
  setParameter: (value: string) => void;
  setDataType: (value: string) => void;
  setSelectedYear: (value: string) => void;
  setContourInterval: (value: string) => void;
  handleGenerate: () => Promise<void>;
}

interface GroundwaterContourProviderProps {
  children: ReactNode;
  activeTab: string;
  onGeoJsonData?: (data: { type: 'contour' | 'raster'; payload: any }) => void;
}

export const GroundwaterContourContext = createContext<GroundwaterContourContextType>({
  geoJsonData: null,
  rasterData: null,
  visualizationData: null,
  interpolationMethod: '',
  parameter: '',
  dataType: '',
  selectedYear: '',
  contourInterval: '',
  isLoading: false,
  error: null,
  setInterpolationMethod: () => { },
  setParameter: () => { },
  setDataType: () => { },
  setSelectedYear: () => { },
  setContourInterval: () => { },
  handleGenerate: async () => { },
});

export const GroundwaterContourProvider = ({
  children,
  activeTab,
  onGeoJsonData = () => { },
}: GroundwaterContourProviderProps) => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [rasterData, setRasterData] = useState<any>(null);
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [interpolationMethod, setInterpolationMethod] = useState<string>('');
  const [parameter, setParameter] = useState<string>('');
  const [dataType, setDataType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [contourInterval, setContourInterval] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get map context to add contour layers
  const { addContourLayer, addRasterLayer } = useMap();

  // Get location context for selected villages
  const { selectedVillages } = useLocation();

  // Get well context for csvFilename
  const { csvFilename, wellCount } = useWell(); // ADD wellCount

  useEffect(() => {
    if (activeTab !== 'groundwater-contour') {
      setGeoJsonData(null);
      setRasterData(null);
      setVisualizationData(null);
      setError(null);
    }
  }, [activeTab]);

  const handleGenerate = async () => {
    // Validate required fields
    if (!interpolationMethod || !parameter || !contourInterval) {
      alert('Please fill all required fields: Interpolation Method, Parameter, and Contour Interval.');
      return;
    }

    if (selectedVillages.length === 0) {
      alert('Please select villages first.');
      return;
    }
// ADD THIS CHECK
if (wellCount < 3) {
  alert(`You need at least 3 well points for interpolation. Currently you have ${wellCount} well(s).`);
  return;
}
    // Validate contour interval
    const intervalValue = parseFloat(contourInterval);
    if (isNaN(intervalValue) || intervalValue <= 0) {
      alert('Please enter a valid contour interval (greater than 0).');
      return;
    }

    // Prepare payload for interpolation API
    const payload: any = {
      method: interpolationMethod,
      parameter: parameter,
      village_ids: selectedVillages,
      place: 'village',
      csv_file: csvFilename || undefined,
      create_colored: true,
      generate_contours: true,
      contour_interval: intervalValue,
    };

    try {
      setIsLoading(true);
      setError(null);
      setGeoJsonData(null);
      setRasterData(null);
      setVisualizationData(null);

      console.log('Sending interpolation API request:', payload);

      const response = await fetch('/fastm/gwa/interpolation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to generate interpolation and contours: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.log('API error response:', errorData);
          if (errorData && errorData.error) {
            errorMessage = `Server error: ${errorData.error}`;
          }
        } catch (parseError) {
          console.log('Could not parse error response as JSON:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Interpolation and Contour data received successfully:', data);

      // Set both raster and contour data
      setRasterData(data);

      // Extract and store PNG visualization data if available
      if (data.visualization) {
        console.log('PNG Visualization data received:', data.visualization);
        const vis = data.visualization;
        const visualizationObj = {
          png_path: vis.png_path || '',
          png_filename: vis.png_filename || '',
          png_base64: vis.png_base64 || vis.pngbase64 || '',
          download_url: vis.download_url || '',
        };
        console.log('Setting visualizationData:', visualizationObj);
        setVisualizationData(visualizationObj);
      }

      // Add raster layer to map first
      if (data.layer_name && data.geoserver_url) {
        console.log('Adding raster layer to map');
        addRasterLayer(data.layer_name, data.geoserver_url, data.color_scheme);
        onGeoJsonData({ type: 'raster', payload: data });
      }

      // Add contour layer to map if contours were generated
      if (data.contours && data.contour_generation?.success) {
        console.log('Adding contour layer to map');
        setGeoJsonData(data.contours);

        addContourLayer(data.contours, {
          name: `${data.layer_name}_contours`,
          parameter: parameter,
          interval: contourInterval,
          statistics: data.contour_generation.statistics,
        });

        onGeoJsonData({ type: 'contour', payload: data.contours });
      } else {
        console.warn('Contours were not generated successfully');
        if (data.contour_generation && !data.contour_generation.success) {
          console.warn('Contour generation failed:', data.contour_generation);
        }
      }
    } catch (error) {
      console.log('Error generating interpolation and contours:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred during generation');
      setGeoJsonData(null);
      setRasterData(null);
      setVisualizationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GroundwaterContourContext.Provider
      value={{
        geoJsonData,
        rasterData,
        visualizationData,
        interpolationMethod,
        parameter,
        dataType,
        selectedYear,
        contourInterval,
        isLoading,
        error,
        setInterpolationMethod,
        setParameter,
        setDataType,
        setSelectedYear,
        setContourInterval,
        handleGenerate,
      }}
    >
      {children}
    </GroundwaterContourContext.Provider>
  );
};
