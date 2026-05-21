import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type SensitiveValuesContextValue = {
  valuesHidden: boolean;
  toggleValuesHidden: () => void;
};

const SensitiveValuesContext = createContext<SensitiveValuesContextValue | null>(null);

export function SensitiveValuesProvider({ children }: { children: React.ReactNode }) {
  const [valuesHidden, setValuesHidden] = useState(false);

  const toggleValuesHidden = useCallback(() => {
    setValuesHidden((hidden) => !hidden);
  }, []);

  const value = useMemo(
    () => ({ valuesHidden, toggleValuesHidden }),
    [toggleValuesHidden, valuesHidden],
  );

  return (
    <SensitiveValuesContext.Provider value={value}>
      {children}
    </SensitiveValuesContext.Provider>
  );
}

export function useSensitiveValues() {
  const context = useContext(SensitiveValuesContext);

  if (!context) {
    throw new Error('useSensitiveValues must be used inside SensitiveValuesProvider');
  }

  return context;
}
