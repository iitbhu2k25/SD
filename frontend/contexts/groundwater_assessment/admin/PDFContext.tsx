// frontend/app/contexts/groundwater_assessment/admin/PDFContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useLocation } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { useWell } from "@/contexts/groundwater_assessment/admin/WellContext";

// Simplified types for PDF generation
export interface PDFGenerationRequest {
  selectedSubDistricts: number[];
  csv_filename: string | null; // Changed to snake_case to match API
}

export interface PDFGenerationResponse {
  success: boolean;
  message: string;
  data?: {
    imageBase64: string;
    pdfId: string;
    filename: string;
    generatedAt: string;
    statistics: {
      villages_count: number;
      wells_count: number;
      selected_villages?: number[];
      selected_subdistricts?: number[];
    };
  };
  error?: string;
}

interface PDFContextType {
  // PDF generation state
  isGeneratingPDF: boolean;
  pdfGenerationSuccess: boolean;
  pdfGenerationError: string | null;
  generatedPDFData: PDFGenerationResponse['data'] | null;
  
  // PDF functions
  generatePDFReport: () => Promise<PDFGenerationResponse | null>;
  resetPDFState: () => void;
  
  // Data validation
  validatePDFData: () => { valid: boolean; message: string };
  
  // Get prepared data (for debugging/preview)
  getPreparedData: () => PDFGenerationRequest | null;
}

interface PDFProviderProps {
  children: ReactNode;
}

const PDFContext = createContext<PDFContextType>({
  isGeneratingPDF: false,
  pdfGenerationSuccess: false,
  pdfGenerationError: null,
  generatedPDFData: null,
  generatePDFReport: async () => null,
  resetPDFState: () => {},
  validatePDFData: () => ({ valid: false, message: 'Context not initialized' }),
  getPreparedData: () => null,
});

export const PDFProvider: React.FC<PDFProviderProps> = ({ children }) => {
  const locationContext = useLocation();
  const wellContext = useWell();
  
  // PDF generation state
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerationSuccess, setPdfGenerationSuccess] = useState(false);
  const [pdfGenerationError, setPdfGenerationError] = useState<string | null>(null);
  const [generatedPDFData, setGeneratedPDFData] = useState<PDFGenerationResponse['data'] | null>(null);

  // Validate PDF data before generation
  const validatePDFData = (): { valid: boolean; message: string } => {
    const { selectedSubDistricts } = locationContext;

    // Check if sub-districts are selected
    if (selectedSubDistricts.length === 0) {
      return { valid: false, message: 'No sub-districts selected for PDF generation' };
    }

    return { valid: true, message: 'Data validation successful' };
  };

  // Get prepared data for debugging/preview
  const getPreparedData = (): PDFGenerationRequest | null => {
    try {
      const validation = validatePDFData();
      if (!validation.valid) {
        console.warn('PDF data validation failed:', validation.message);
        return null;
      }

      return {
        selectedSubDistricts: locationContext.selectedSubDistricts,
        csv_filename: wellContext.csvFilename // Use snake_case
      };
    } catch (error) {
      console.log('Error preparing PDF data:', error);
      return null;
    }
  };

  // Main PDF generation function
  const generatePDFReport = async (): Promise<PDFGenerationResponse | null> => {
    console.log('🚀 Starting PDF generation process...');
    
    // Reset previous state
    setIsGeneratingPDF(true);
    setPdfGenerationSuccess(false);
    setPdfGenerationError(null);
    setGeneratedPDFData(null);

    try {
      // Step 1: Validate data
      console.log('📋 Validating PDF data...');
      const validation = validatePDFData();
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: Prepare simplified data
      console.log('📦 Preparing simplified PDF data...');
      const pdfRequest: PDFGenerationRequest = {
        selectedSubDistricts: locationContext.selectedSubDistricts,
        csv_filename: wellContext.csvFilename // Use snake_case to match API
      };

      console.log('📊 PDF request prepared:', {
        selectedSubDistricts: pdfRequest.selectedSubDistricts,
        csv_filename: pdfRequest.csv_filename
      });

      // Step 3: Send to API
      console.log('📡 Sending PDF generation request to /pdf API...');
      const response = await fetch('/django/gwa/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pdfRequest),
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API Error response:', errorText);
        throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
      }

      const result: PDFGenerationResponse = await response.json();
      console.log('✅ PDF generation result:', result);

      if (result.success) {
        setPdfGenerationSuccess(true);
        setGeneratedPDFData(result.data || null);
        console.log('🎉 PDF generated successfully:', result.data);
        return result;
      } else {
        throw new Error(result.error || result.message || 'Unknown error occurred');
      }

    } catch (error: any) {
      console.log('❌ PDF generation error:', error);
      setPdfGenerationError(`PDF generation failed: ${error.message}`);
      return null;
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Reset PDF generation state
  const resetPDFState = (): void => {
    console.log('🔄 Resetting PDF state...');
    setIsGeneratingPDF(false);
    setPdfGenerationSuccess(false);
    setPdfGenerationError(null);
    setGeneratedPDFData(null);
  };

  // Auto-reset success state after some time
  useEffect(() => {
    if (pdfGenerationSuccess) {
      const timer = setTimeout(() => {
        setPdfGenerationSuccess(false);
      }, 10000); // Reset success state after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [pdfGenerationSuccess]);

  // Auto-reset error state when contexts change
  useEffect(() => {
    if (pdfGenerationError) {
      setPdfGenerationError(null);
    }
  }, [locationContext.selectedSubDistricts, wellContext.csvFilename]);

  const contextValue: PDFContextType = {
    // PDF generation state
    isGeneratingPDF,
    pdfGenerationSuccess,
    pdfGenerationError,
    generatedPDFData,
    
    // PDF functions
    generatePDFReport,
    resetPDFState,
    
    // Data validation
    validatePDFData,
    
    // Get prepared data
    getPreparedData,
  };

  return (
    <PDFContext.Provider value={contextValue}>
      {children}
    </PDFContext.Provider>
  );
};

export const usePDF = (): PDFContextType => {
  const context = useContext(PDFContext);
  if (context === undefined) {
    throw new Error("usePDF must be used within a PDFProvider");
  }
  return context;
};