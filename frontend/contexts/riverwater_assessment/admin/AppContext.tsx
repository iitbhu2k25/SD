"use client";

import React, { createContext, useContext, ReactNode, useRef } from "react";

interface AppContextType {
  // Store references to child context functions
  mapActions: React.RefObject<{
    removeInterpolationLayer?: () => void;
  }>;
  locationActions: React.RefObject<{
    resetSelections?: () => void;
  }>;
  
  // Combined actions
  handleGlobalReset: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mapActions = useRef<{ removeInterpolationLayer?: () => void }>({});
  const locationActions = useRef<{ resetSelections?: () => void }>({});

  const handleGlobalReset = () => {
    // Call location reset first
    if (locationActions.current.resetSelections) {
      locationActions.current.resetSelections();
    }
    
    // Then remove interpolation layer
    if (mapActions.current.removeInterpolationLayer) {
      mapActions.current.removeInterpolationLayer();
    }
  };

  return (
    <AppContext.Provider 
      value={{ 
        mapActions, 
        locationActions, 
        handleGlobalReset 
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
