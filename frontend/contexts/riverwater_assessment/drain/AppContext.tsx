"use client";

import React, { createContext, useContext, ReactNode, useRef } from "react";

interface StretchAppContextType {
  // Store references to child context functions
  mapActions: React.RefObject<{
    removeInterpolationLayer?: () => void;
  }>;
  stretchActions: React.RefObject<{
    resetSelections?: () => void;
  }>;
  // Combined actions
  handleGlobalReset: () => void;
}

const StretchAppContext = createContext<StretchAppContextType | undefined>(undefined);

export const StretchAppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mapActions = useRef<{ removeInterpolationLayer?: () => void }>({});
  const stretchActions = useRef<{ resetSelections?: () => void }>({});

  const handleGlobalReset = () => {
    // Call stretch reset first
    if (stretchActions.current.resetSelections) {
      stretchActions.current.resetSelections();
    }

    // Then remove interpolation layer
    if (mapActions.current.removeInterpolationLayer) {
      mapActions.current.removeInterpolationLayer();
    }
  };

  return (
    <StretchAppContext.Provider
      value={{
        mapActions,
        stretchActions,
        handleGlobalReset,
      }}
    >
      {children}
    </StretchAppContext.Provider>
  );
};

export const useStretchApp = (): StretchAppContextType => {
  const context = useContext(StretchAppContext);
  if (context === undefined) {
    throw new Error("useStretchApp must be used within a StretchAppProvider");
  }
  return context;
};
