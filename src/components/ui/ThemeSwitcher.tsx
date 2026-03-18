import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const isNight = theme === 'night';

  return (
    <div
      className="no-drag flex items-center rounded-full p-1 gap-0.5"
      style={{
        background: 'var(--switcher-bg)',
        border: '1px solid var(--switcher-border)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      {/* Aero Day */}
      <button
        onClick={() => setTheme('day')}
        title="Aero Day"
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95"
        style={!isNight ? {
          background: 'linear-gradient(180deg, #ffe066 0%, #ffa500 100%)',
          color: '#7a4000',
          boxShadow: '0 1px 8px rgba(200,120,0,0.35), inset 0 1px 0 rgba(255,255,255,0.60)',
          border: '1px solid rgba(255,180,0,0.50)',
        } : {
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid transparent',
        }}
      >
        <Sun className="h-3 w-3" strokeWidth={2.5} />
        Aero Day
      </button>

      {/* Aero Night */}
      <button
        onClick={() => setTheme('night')}
        title="Aero Night"
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95"
        style={isNight ? {
          background: 'linear-gradient(180deg, #6680ff 0%, #2030c8 100%)',
          color: '#dce8ff',
          boxShadow: '0 1px 10px rgba(60,80,255,0.45), inset 0 1px 0 rgba(255,255,255,0.22)',
          border: '1px solid rgba(100,140,255,0.50)',
        } : {
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid transparent',
        }}
      >
        <Moon className="h-3 w-3" strokeWidth={2.5} />
        Aero Night
      </button>
    </div>
  );
}
