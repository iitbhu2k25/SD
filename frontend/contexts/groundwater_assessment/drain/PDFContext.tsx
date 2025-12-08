"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { useWell } from "@/contexts/groundwater_assessment/drain/WellContext";

// Simplified types for PDF generation
export interface PDFGenerationRequest {
  village_codes: number[];
  csv_filename: string | null;
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

  // Get prepared data 
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
  resetPDFState: () => { },
  validatePDFData: () => ({ valid: false, message: 'Context not initialized' }),
  getPreparedData: () => null,
});

export const PDFProvider: React.FC<PDFProviderProps> = ({ children }) => {
  const { selectedVillages } = useLocation();
  const { csvFilename } = useWell();

  // PDF generation state
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerationSuccess, setPdfGenerationSuccess] = useState(false);
  const [pdfGenerationError, setPdfGenerationError] = useState<string | null>(null);
  const [generatedPDFData, setGeneratedPDFData] = useState<PDFGenerationResponse['data'] | null>(null);

  // Validate PDF data before generation
  const validatePDFData = (): { valid: boolean; message: string } => {
    // Check if villages are selected
    if (selectedVillages.length === 0) {
      return { valid: false, message: 'No villages selected for PDF generation' };
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
        village_codes: selectedVillages,
        csv_filename: csvFilename,
      };
    } catch (error) {
      console.log('Error preparing PDF data:', error);
      return null;
    }
  };

  // Main PDF generation function
  const generatePDFReport = async (): Promise<PDFGenerationResponse | null> => {
    console.log(' Starting PDF generation process...');

    // Reset previous state
    setIsGeneratingPDF(true);
    setPdfGenerationSuccess(false);
    setPdfGenerationError(null);
    setGeneratedPDFData(null);

    try {
      // Step 1: Validate data
      console.log(' Validating PDF data...');
      const validation = validatePDFData();
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: Prepare simplified data
      console.log(' Preparing simplified PDF data...');
      const pdfRequest: PDFGenerationRequest = {
        village_codes: selectedVillages, // Match API parameter name
        csv_filename: csvFilename,
      };

      console.log(' PDF request prepared:', {
        village_codes: pdfRequest.village_codes,
        csv_filename: pdfRequest.csv_filename,
      });

      // Step 3: Send to PDF generation API (single call only)
      console.log(' Sending PDF generation request to /pdf API...');
      const response = await fetch('/fastm/gwa/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pdfRequest),
      });

      console.log(' API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ PDF API Error response:', errorText);
        throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
      }

      const result: PDFGenerationResponse = await response.json();
      console.log(' PDF generation result:', result);

      if (result.success) {
        setPdfGenerationSuccess(true);
        setGeneratedPDFData(result.data || null);
        console.log(' PDF generated successfully:', result.data);
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
    console.log(' Resetting PDF state...');
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
  }, [selectedVillages, csvFilename]);

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