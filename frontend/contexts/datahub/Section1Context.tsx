'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Shapefile {
  fid: number;
  shapefile_name: string;
  shapefile_path: string;
}

interface ShapefileContextType {
  shapefiles: Shapefile[];
  selectedShapefiles: Shapefile[];
  toggleShapefile: (file: Shapefile) => void;
  isSelected: (file: Shapefile) => boolean;
  fetchShapefiles: () => Promise<void>;
  isLoading: boolean;
}

const ShapefileContext = createContext<ShapefileContextType | undefined>(undefined);

export const ShapefileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shapefiles, setShapefiles] = useState<Shapefile[]>([]);
  const [selectedShapefiles, setSelectedShapefiles] = useState<Shapefile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchShapefiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/django/datahub/shapefiles');
      if (!response.ok) throw new Error('Failed to fetch shapefiles');
      const data = await response.json();
      setShapefiles(data);
    } catch (error) {
      console.error('Error fetching shapefiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShapefile = (file: Shapefile) => {
    setSelectedShapefiles((prev) => {
      const isAlreadySelected = prev.some((f) => f.fid === file.fid);
      if (isAlreadySelected) {
        return prev.filter((f) => f.fid !== file.fid);
      } else {
        return [...prev, file];
      }
    });
  };

  const isSelected = (file: Shapefile) => {
    return selectedShapefiles.some((f) => f.fid === file.fid);
  };

  useEffect(() => {
    fetchShapefiles();
  }, []);

  return (
    <ShapefileContext.Provider 
      value={{ 
        shapefiles, 
        selectedShapefiles, 
        toggleShapefile, 
        isSelected, 
        fetchShapefiles,
        isLoading 
      }}
    >
      {children}
    </ShapefileContext.Provider>
  );
};

export const useShapefile = () => {
  const context = useContext(ShapefileContext);
  if (!context) throw new Error('useShapefile must be used within a ShapefileProvider');
  return context;
};