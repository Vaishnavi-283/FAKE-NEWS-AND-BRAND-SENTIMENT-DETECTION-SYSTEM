import React, { createContext, useContext, useState } from 'react';

const AnalysisContext = createContext(null);

export const AnalysisProvider = ({ children }) => {
  const [currentResult, setCurrentResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const clearResult = () => {
    setCurrentResult(null);
    setAnalysisError(null);
  };

  return (
    <AnalysisContext.Provider value={{
      currentResult,
      setCurrentResult,
      isAnalyzing,
      setIsAnalyzing,
      analysisError,
      setAnalysisError,
      clearResult,
    }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be inside AnalysisProvider');
  return ctx;
};
