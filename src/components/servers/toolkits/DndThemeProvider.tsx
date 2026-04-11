// src/components/servers/toolkits/DndThemeProvider.tsx
import { memo, type ReactNode } from 'react';
import { useThemeStore } from '../../../store/themeStore';
import { useServerStore } from '../../../store/serverStore';

const DAY_VARS: Record<string, string> = {
  '--tk-accent': '#8B4513',
  '--tk-accent-light': '#D2691E',
  '--tk-accent-glow': 'rgba(210,105,30,0.15)',
  '--tk-gold': '#B8860B',
  '--tk-text': '#4a3520',
  '--tk-text-muted': 'rgba(74,53,32,0.45)',
  '--tk-border': 'rgba(139,69,19,0.15)',
  '--tk-panel': 'rgba(139,69,19,0.06)',
};

const NIGHT_VARS: Record<string, string> = {
  '--tk-accent': '#D2691E',
  '--tk-accent-light': '#E8944C',
  '--tk-accent-glow': 'rgba(210,105,30,0.20)',
  '--tk-gold': '#FFD700',
  '--tk-text': '#e8d5b0',
  '--tk-text-muted': 'rgba(232,213,176,0.40)',
  '--tk-border': 'rgba(139,69,19,0.20)',
  '--tk-panel': 'rgba(139,69,19,0.06)',
};

// Ultra/premium themes — derive from night base with per-theme tweaks
const GOLDEN_HOUR_VARS: Record<string, string> = {
  ...NIGHT_VARS,
  '--tk-accent': '#C4751B',
  '--tk-accent-light': '#E8944C',
  '--tk-gold': '#FFBF00',
};

const JOHN_FRUTIGER_VARS: Record<string, string> = {
  ...NIGHT_VARS,
  '--tk-accent': '#B87333',
  '--tk-accent-light': '#CD853F',
  '--tk-gold': '#DAA520',
};

function getVarsForTheme(theme: string): Record<string, string> {
  if (theme === 'day') return DAY_VARS;
  if (theme === 'golden-hour') return GOLDEN_HOUR_VARS;
  if (theme === 'john-frutiger') return JOHN_FRUTIGER_VARS;
  // night, ocean, sunset, aurora, sakura, master — all use the night palette
  return NIGHT_VARS;
}

export const DndThemeProvider = memo(function DndThemeProvider({ children }: { children: ReactNode }) {
  const toolkit = useServerStore(s => s.activeToolkit);
  const theme = useThemeStore(s => s.theme);

  if (!toolkit) return <>{children}</>;

  const vars = getVarsForTheme(theme);

  return (
    <div style={vars as React.CSSProperties} className="contents">
      {children}
    </div>
  );
});
