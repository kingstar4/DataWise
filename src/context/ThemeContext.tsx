import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  mode: ThemeMode;
  toggle: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggle: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  const mode: ThemeMode = override ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const isDark = mode === 'dark';

  const toggle = useCallback(() => {
    setOverride((prev) => {
      const current = prev ?? (systemScheme === 'dark' ? 'dark' : 'light');
      return current === 'dark' ? 'light' : 'dark';
    });
  }, [systemScheme]);

  const value = useMemo(() => ({ mode, toggle, isDark }), [mode, toggle, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

/**
 * Build a stable React Navigation theme object that updates in-place
 * based on our custom ThemeContext, without causing full remount.
 */
export function useNavTheme() {
  const { isDark } = useThemeMode();

  return useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: isDark ? '#6366F1' : '#1C2765',
        background: isDark ? '#0B1020' : '#F8FAFC',
        card: isDark ? '#0D1433' : '#FFFFFF',
        text: isDark ? '#F8FAFC' : '#0F172A',
        border: isDark ? '#1A2250' : '#E2E8F0',
        notification: '#EF4444',
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' as const },
        medium: { fontFamily: 'System', fontWeight: '500' as const },
        bold: { fontFamily: 'System', fontWeight: '700' as const },
        heavy: { fontFamily: 'System', fontWeight: '800' as const },
      },
    }),
    [isDark]
  );
}
