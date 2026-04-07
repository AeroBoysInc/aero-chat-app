import { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, Palette, X, Check, Waves, Sunset, Sparkles, Cherry } from 'lucide-react';
import { useThemeStore, PREMIUM_THEMES, ULTRA_THEMES, type Theme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

/* ── Theme metadata ── */
interface ThemeMeta {
  id: Theme;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  accentSecondary: string;
  gradient: string;
  bodySnippet: string;
  sidebarBg: string;
  chatBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  panelBorder: string;
  badgeBg: string;
  inputBg: string;
  recvBg: string;
  hoverBg: string;
}

const THEME_META: ThemeMeta[] = [
  {
    id: 'day', label: 'Aero Day', description: 'Bright sky blues, white glass panels',
    icon: <Sun className="h-4 w-4" />,
    accent: '#ffa500', accentSecondary: '#1a6fd4', gradient: 'linear-gradient(135deg, #ffe066, #ffa500)',
    bodySnippet: 'linear-gradient(170deg, #72d8fa 0%, #3dbce8 40%, #1aa8de 100%)',
    sidebarBg: 'rgba(255,255,255,0.86)', chatBg: 'rgba(215,238,255,0.55)',
    textPrimary: '#112840', textSecondary: '#2d5878', textMuted: '#5a88a8',
    panelBorder: 'rgba(150,200,235,0.70)', badgeBg: '#1a6fd4',
    inputBg: 'rgba(255,255,255,0.88)', recvBg: 'rgba(255,255,255,0.92)',
    hoverBg: 'rgba(0,120,200,0.07)',
  },
  {
    id: 'night', label: 'Aero Night', description: 'Deep navy, electric blue accents',
    icon: <Moon className="h-4 w-4" />,
    accent: '#6680ff', accentSecondary: '#3d8cff', gradient: 'linear-gradient(135deg, #6680ff, #2030c8)',
    bodySnippet: 'linear-gradient(165deg, #0d1b3e 0%, #08142a 55%, #040e1e 100%)',
    sidebarBg: 'rgba(12,25,58,0.92)', chatBg: 'rgba(8,16,42,0.75)',
    textPrimary: '#dce8ff', textSecondary: '#8aabde', textMuted: '#4a6a9a',
    panelBorder: 'rgba(80,145,255,0.22)', badgeBg: '#3d8cff',
    inputBg: 'rgba(255,255,255,0.07)', recvBg: 'rgba(255,255,255,0.09)',
    hoverBg: 'rgba(100,160,255,0.08)',
  },
  {
    id: 'ocean', label: 'Ocean', description: 'Deep teal, luminous cyan glow',
    icon: <Waves className="h-4 w-4" />,
    accent: '#00dcc8', accentSecondary: '#00c8d4', gradient: 'linear-gradient(135deg, #00dcc8, #0088a0)',
    bodySnippet: 'linear-gradient(165deg, #062a3e 0%, #041e30 55%, #021520 100%)',
    sidebarBg: 'rgba(4,30,48,0.94)', chatBg: 'rgba(3,22,38,0.80)',
    textPrimary: '#c8f0f0', textSecondary: '#6ab8c0', textMuted: '#3a7888',
    panelBorder: 'rgba(0,180,200,0.20)', badgeBg: '#00c8d4',
    inputBg: 'rgba(0,200,220,0.06)', recvBg: 'rgba(0,200,220,0.08)',
    hoverBg: 'rgba(0,200,220,0.08)',
  },
  {
    id: 'sunset', label: 'Sunset', description: 'Warm amber, coral golden glow',
    icon: <Sunset className="h-4 w-4" />,
    accent: '#ff8c30', accentSecondary: '#c84020', gradient: 'linear-gradient(135deg, #ff8c30, #c84020)',
    bodySnippet: 'linear-gradient(165deg, #3a1a0e 0%, #2a1008 55%, #1e0a04 100%)',
    sidebarBg: 'rgba(42,16,8,0.94)', chatBg: 'rgba(30,10,4,0.80)',
    textPrimary: '#ffe0c8', textSecondary: '#c89070', textMuted: '#8a5c40',
    panelBorder: 'rgba(255,140,60,0.20)', badgeBg: '#ff8c30',
    inputBg: 'rgba(255,140,60,0.06)', recvBg: 'rgba(255,140,60,0.08)',
    hoverBg: 'rgba(255,140,60,0.08)',
  },
  {
    id: 'aurora', label: 'Aurora', description: 'Deep violet, emerald shimmer',
    icon: <Sparkles className="h-4 w-4" />,
    accent: '#8040ff', accentSecondary: '#00dc8c', gradient: 'linear-gradient(135deg, #a060ff, #6020d0)',
    bodySnippet: 'linear-gradient(165deg, #0e0a2a 0%, #080620 55%, #04031a 100%)',
    sidebarBg: 'rgba(8,6,32,0.94)', chatBg: 'rgba(4,3,26,0.80)',
    textPrimary: '#e0d8ff', textSecondary: '#9a88cc', textMuted: '#5a4888',
    panelBorder: 'rgba(120,60,255,0.22)', badgeBg: '#8040ff',
    inputBg: 'rgba(120,60,255,0.06)', recvBg: 'rgba(120,60,255,0.08)',
    hoverBg: 'rgba(120,60,255,0.08)',
  },
  {
    id: 'sakura', label: 'Sakura', description: 'Soft pink, cherry blossom rose',
    icon: <Cherry className="h-4 w-4" />,
    accent: '#ff70b0', accentSecondary: '#d04080', gradient: 'linear-gradient(135deg, #ff90c0, #d04080)',
    bodySnippet: 'linear-gradient(165deg, #2a0e22 0%, #1e081a 55%, #140512 100%)',
    sidebarBg: 'rgba(30,8,26,0.94)', chatBg: 'rgba(20,5,18,0.80)',
    textPrimary: '#ffe0ee', textSecondary: '#c888a8', textMuted: '#885870',
    panelBorder: 'rgba(255,120,180,0.20)', badgeBg: '#ff70b0',
    inputBg: 'rgba(255,120,180,0.06)', recvBg: 'rgba(255,120,180,0.08)',
    hoverBg: 'rgba(255,120,180,0.08)',
  },
  {
    id: 'john-frutiger', label: 'John Frutiger', description: 'Bright sky, white glass, glossy clouds',
    icon: <Sparkles className="h-4 w-4" />,
    accent: '#00d4ff', accentSecondary: '#0098e0', gradient: 'linear-gradient(135deg, #5ec8f5, #0098e0, #004a90)',
    bodySnippet: 'linear-gradient(170deg, #b8ecff 0%, #5ec8f5 20%, #0098e0 50%, #0068b8 80%, #004a90 100%)',
    sidebarBg: 'rgba(255,255,255,0.18)', chatBg: 'rgba(255,255,255,0.12)',
    textPrimary: 'rgba(0,40,80,0.90)', textSecondary: 'rgba(0,60,120,0.70)', textMuted: 'rgba(0,80,160,0.45)',
    panelBorder: 'rgba(255,255,255,0.30)', badgeBg: '#0098e0',
    inputBg: 'rgba(255,255,255,0.20)', recvBg: 'rgba(255,255,255,0.25)',
    hoverBg: 'rgba(0,160,255,0.08)',
  },
  {
    id: 'golden-hour', label: 'Golden Hour', description: 'Vista sunset, dark glass, amber glow',
    icon: <Sunset className="h-4 w-4" />,
    accent: '#f5a623', accentSecondary: '#c45e1a', gradient: 'linear-gradient(135deg, #ffe680, #f5a623, #c45e1a, #5c1a3a)',
    bodySnippet: 'linear-gradient(180deg, #1a0a2e 0%, #5c1a3a 25%, #c45e1a 55%, #f5a623 78%, #ffe680 100%)',
    sidebarBg: 'rgba(60,30,10,0.55)', chatBg: 'rgba(40,20,8,0.55)',
    textPrimary: '#ffe0c0', textSecondary: '#c89060', textMuted: '#8a5c38',
    panelBorder: 'rgba(255,180,80,0.22)', badgeBg: '#f5a623',
    inputBg: 'rgba(0,0,0,0.25)', recvBg: 'rgba(255,180,80,0.08)',
    hoverBg: 'rgba(255,180,80,0.08)',
  },
];

/* ── Full app viewport preview ── */
const ThemePreview = memo(function ThemePreview({ meta }: { meta: ThemeMeta }) {
  const isDark = meta.id !== 'day';
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden',
      background: meta.bodySnippet, display: 'flex', padding: 8, gap: 6,
      border: `1px solid ${meta.panelBorder}`,
    }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: '32%', borderRadius: 10, background: meta.sidebarBg,
        border: `1px solid ${meta.panelBorder}`, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 8px 6px', borderBottom: `1px solid ${meta.panelBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 4,
              background: `linear-gradient(135deg, ${meta.accent}88, ${meta.accentSecondary}88)`,
            }} />
            <span style={{ fontSize: 8, fontWeight: 800, color: meta.textPrimary, letterSpacing: '-0.3px' }}>
              AeroChat
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2].map(i => (
              <div key={i} style={{
                width: 12, height: 12, borderRadius: 4,
                background: meta.hoverBg, border: `1px solid ${meta.panelBorder}`,
              }} />
            ))}
          </div>
        </div>

        {/* Profile card */}
        <div style={{
          margin: '6px 6px 4px', padding: '6px 6px', borderRadius: 8,
          background: `linear-gradient(135deg, ${meta.accent}10, transparent)`,
          border: `1px solid ${meta.panelBorder}`,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: `linear-gradient(135deg, ${meta.accent}60, ${meta.accentSecondary}40)`,
            border: `2px solid ${meta.accent}50`,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 4, width: '70%', borderRadius: 2, background: meta.textPrimary, opacity: 0.55 }} />
            <div style={{ height: 3, width: '45%', borderRadius: 2, background: meta.accent, opacity: 0.4, marginTop: 3 }} />
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 6px', marginBottom: 4 }}>
          <div style={{
            height: 16, borderRadius: 8, background: meta.inputBg,
            border: `1px solid ${meta.panelBorder}`,
            display: 'flex', alignItems: 'center', paddingLeft: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${meta.textMuted}`, opacity: 0.4 }} />
          </div>
        </div>

        {/* Friend list */}
        <div style={{ flex: 1, padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            { active: true, badge: 0 },
            { active: false, badge: 3 },
            { active: false, badge: 0 },
            { active: false, badge: 1 },
            { active: false, badge: 0 },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px',
              borderRadius: 6,
              background: f.active ? meta.hoverBg : 'transparent',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: f.active ? `${meta.accent}50` : `${meta.textMuted}25`,
                border: f.active ? `1.5px solid ${meta.accent}60` : '1.5px solid transparent',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  height: 4, borderRadius: 2, width: f.active ? '80%' : `${55 + i * 8}%`,
                  background: meta.textPrimary, opacity: f.active ? 0.6 : 0.2,
                }} />
                <div style={{
                  height: 3, borderRadius: 2, width: '60%', marginTop: 2,
                  background: meta.textMuted, opacity: f.active ? 0.35 : 0.12,
                }} />
              </div>
              {f.badge > 0 && (
                <div style={{
                  minWidth: 14, height: 14, borderRadius: 7, fontSize: 7, fontWeight: 700,
                  background: meta.badgeBg, color: isDark ? '#fff' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{f.badge}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{
        flex: 1, borderRadius: 10, background: meta.chatBg,
        border: `1px solid ${meta.panelBorder}`, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Chat header */}
        <div style={{
          padding: '7px 10px', borderBottom: `1px solid ${meta.panelBorder}`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: `${meta.accent}40`, border: `1.5px solid ${meta.accent}50`,
          }} />
          <div>
            <div style={{ height: 4, width: 48, borderRadius: 2, background: meta.textPrimary, opacity: 0.55 }} />
            <div style={{ height: 3, width: 32, borderRadius: 2, background: meta.accent, opacity: 0.35, marginTop: 2 }} />
          </div>
          <div style={{ flex: 1 }} />
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: 4,
              background: meta.hoverBg, border: `1px solid ${meta.panelBorder}`,
            }} />
          ))}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column',
          gap: 6, justifyContent: 'flex-end',
        }}>
          {/* Date separator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: `${meta.panelBorder}` }} />
            <span style={{ fontSize: 6, color: meta.textMuted, opacity: 0.6, fontWeight: 500 }}>Today</span>
            <div style={{ flex: 1, height: 1, background: `${meta.panelBorder}` }} />
          </div>

          {/* Received message */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${meta.textMuted}30`, flexShrink: 0 }} />
            <div style={{
              padding: '5px 8px', borderRadius: '8px 8px 8px 3px', maxWidth: '62%',
              background: meta.recvBg, border: `1px solid ${meta.panelBorder}`,
            }}>
              <div style={{ height: 3, width: 64, borderRadius: 1, background: meta.textPrimary, opacity: 0.4 }} />
              <div style={{ height: 3, width: 44, borderRadius: 1, background: meta.textPrimary, opacity: 0.25, marginTop: 3 }} />
              <div style={{ height: 2, width: 20, borderRadius: 1, background: meta.textMuted, opacity: 0.3, marginTop: 3, marginLeft: 'auto' }} />
            </div>
          </div>

          {/* Sent message */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              padding: '5px 8px', borderRadius: '8px 8px 3px 8px', maxWidth: '55%',
              background: `linear-gradient(135deg, ${meta.accent}cc, ${meta.accent}88)`,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Gloss */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
                borderRadius: 'inherit',
              }} />
              <div style={{ height: 3, width: 52, borderRadius: 1, background: '#fff', opacity: 0.65, position: 'relative' }} />
              <div style={{ height: 3, width: 36, borderRadius: 1, background: '#fff', opacity: 0.4, marginTop: 3, position: 'relative' }} />
              <div style={{ height: 2, width: 20, borderRadius: 1, background: '#fff', opacity: 0.3, marginTop: 3, marginLeft: 'auto', position: 'relative' }} />
            </div>
          </div>

          {/* Another received */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${meta.textMuted}30`, flexShrink: 0 }} />
            <div style={{
              padding: '5px 8px', borderRadius: '8px 8px 8px 3px', maxWidth: '50%',
              background: meta.recvBg, border: `1px solid ${meta.panelBorder}`,
            }}>
              <div style={{ height: 3, width: 48, borderRadius: 1, background: meta.textPrimary, opacity: 0.4 }} />
              <div style={{ height: 2, width: 20, borderRadius: 1, background: meta.textMuted, opacity: 0.3, marginTop: 3, marginLeft: 'auto' }} />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div style={{
          padding: '6px 10px', borderTop: `1px solid ${meta.panelBorder}`,
          display: 'flex', gap: 5, alignItems: 'center',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            background: meta.hoverBg, border: `1px solid ${meta.panelBorder}`,
          }} />
          <div style={{
            flex: 1, height: 20, borderRadius: 10, background: meta.inputBg,
            border: `1px solid ${meta.panelBorder}`,
          }} />
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: `${meta.accent}40`,
          }} />
        </div>
      </div>

      {/* ── Server rail ── */}
      <div style={{
        width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 5, paddingTop: 6,
      }}>
        {[
          { active: true, round: false },
          { active: false, round: true },
          { active: false, round: true },
          { active: false, round: true },
        ].map((s, i) => (
          <div key={i} style={{
            width: 22, height: 22,
            borderRadius: s.active ? 7 : '50%',
            background: s.active ? `${meta.accent}55` : meta.sidebarBg,
            border: `1px solid ${s.active ? meta.accent + '50' : meta.panelBorder}`,
            transition: 'border-radius 0.2s',
          }} />
        ))}
        {/* Separator */}
        <div style={{ width: 14, height: 1, background: meta.panelBorder, margin: '1px 0' }} />
        {/* Add server */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `1.5px dashed ${meta.textMuted}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: meta.textMuted, opacity: 0.5,
        }}>+</div>
      </div>
    </div>
  );
});

/* ── Free user: simple day/night toggle (unchanged behavior) ── */
function FreeToggle() {
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
        Day
      </button>
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
        Night
      </button>
    </div>
  );
}

/* ── Premium user: Theme Picker button → full-screen modal ── */
function PremiumPicker() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Theme>(theme);

  const handleOpen = useCallback(() => {
    setSelected(theme);
    setOpen(true);
  }, [theme]);

  const handleApply = useCallback(() => {
    setTheme(selected);
    setOpen(false);
  }, [selected, setTheme]);

  const selectedMeta = THEME_META.find(t => t.id === selected)!;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="no-drag flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95"
        style={{
          background: 'var(--switcher-bg)',
          border: '1px solid var(--switcher-border)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.25)',
          color: 'var(--text-secondary)',
        }}
      >
        <Palette className="h-3.5 w-3.5" />
        Themes
      </button>

      {/* Modal overlay — portalled to body so it escapes parent stacking contexts */}
      {open && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center animate-fade-in"
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative"
            style={{
              width: '90vw', maxWidth: 720, height: '78vh', maxHeight: 520,
              borderRadius: 20,
              background: 'var(--popup-bg)',
              border: '1px solid var(--popup-border)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(28px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal header ── */}
            <div style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--popup-divider)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Palette className="h-4.5 w-4.5" style={{ color: 'var(--popup-icon)' }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--popup-text)', letterSpacing: '-0.2px' }}>
                  Theme Picker
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 transition-all hover:scale-110"
                style={{ color: 'var(--popup-text-muted)', background: 'rgba(255,255,255,0.06)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Body: list left + preview right ── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

              {/* Theme list (left) */}
              <div style={{
                width: 220, flexShrink: 0, overflowY: 'auto',
                borderRight: '1px solid var(--popup-divider)',
                padding: '8px 0',
              }}>
                {/* Section: Free */}
                <div style={{
                  padding: '4px 16px 6px', fontSize: 9, fontWeight: 700,
                  color: 'var(--popup-text-muted)', letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Free
                </div>
                {THEME_META.filter(t => !PREMIUM_THEMES.includes(t.id) && !ULTRA_THEMES.includes(t.id)).map(meta => (
                  <ThemeRow
                    key={meta.id}
                    meta={meta}
                    isActive={theme === meta.id}
                    isSelected={selected === meta.id}
                    onSelect={() => setSelected(meta.id)}
                  />
                ))}

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--popup-divider)', margin: '8px 16px' }} />

                {/* Section: Premium */}
                <div style={{
                  padding: '4px 16px 6px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Aero Chat+
                </div>
                {THEME_META.filter(t => PREMIUM_THEMES.includes(t.id)).map(meta => (
                  <ThemeRow
                    key={meta.id}
                    meta={meta}
                    isActive={theme === meta.id}
                    isSelected={selected === meta.id}
                    onSelect={() => setSelected(meta.id)}
                  />
                ))}

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--popup-divider)', margin: '8px 16px' }} />

                {/* Section: Ultra Themes */}
                <div style={{
                  padding: '4px 16px 6px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: 'linear-gradient(90deg, #00d4ff, #f5a623)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  ✦ Ultra Themes
                </div>
                {THEME_META.filter(t => ULTRA_THEMES.includes(t.id)).map(meta => {
                  const isOwned = meta.id === 'john-frutiger'
                    ? useThemeStore.getState().ownsJohnFrutiger
                    : useThemeStore.getState().ownsGoldenHour;
                  const isPrem = useAuthStore.getState().user?.is_premium === true;
                  return (
                    <UltraThemeRow
                      key={meta.id}
                      meta={meta}
                      isActive={theme === meta.id}
                      isSelected={selected === meta.id}
                      isOwned={isOwned}
                      isPremium={isPrem}
                      onSelect={() => {
                        if (isOwned && isPrem) setSelected(meta.id);
                      }}
                      onPurchase={async () => {
                        const userId = useAuthStore.getState().user?.id;
                        if (!userId || !isPrem) return;
                        const ok = await useThemeStore.getState().purchaseTheme(
                          meta.id as 'john-frutiger' | 'golden-hour', userId
                        );
                        if (ok) setSelected(meta.id);
                      }}
                    />
                  );
                })}
              </div>

              {/* Preview viewport (right) */}
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', padding: 16, minWidth: 0,
                background: 'rgba(0,0,0,0.03)',
              }}>
                {/* Preview header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: selectedMeta.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 2px 10px ${selectedMeta.accent}35`,
                    }}>
                      <span style={{ color: '#fff', display: 'flex' }}>{selectedMeta.icon}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--popup-text)' }}>
                        {selectedMeta.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--popup-text-muted)', marginTop: 1 }}>
                        {selectedMeta.description}
                      </div>
                    </div>
                  </div>

                  {selected !== theme ? (
                    <button
                      onClick={handleApply}
                      className="rounded-xl px-5 py-2 text-xs font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                      style={{
                        background: selectedMeta.gradient,
                        color: selectedMeta.id === 'day' ? '#7a4000' : '#fff',
                        border: `1px solid ${selectedMeta.accent}50`,
                        boxShadow: `0 3px 14px ${selectedMeta.accent}30`,
                      }}
                    >
                      Apply Theme
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: selectedMeta.accent, opacity: 0.6 }}>
                      Active
                    </span>
                  )}
                </div>

                {/* App mockup viewport */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ThemePreview meta={selectedMeta} />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Ultra theme row — extravagant presentation ── */
function UltraThemeRow({ meta, isActive, isSelected, isOwned, isPremium, onSelect, onPurchase }: {
  meta: ThemeMeta; isActive: boolean; isSelected: boolean;
  isOwned: boolean; isPremium: boolean;
  onSelect: () => void; onPurchase: () => void;
}) {
  const locked = !isOwned || !isPremium;
  return (
    <button
      onClick={locked ? undefined : onSelect}
      className="w-full text-left transition-all duration-150"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: isSelected ? `${meta.accent}12` : 'transparent',
        borderRight: isSelected ? `3px solid ${meta.accent}` : '3px solid transparent',
        opacity: locked ? 0.75 : 1,
        cursor: locked ? 'default' : 'pointer',
      }}
      onMouseEnter={e => {
        if (!isSelected && !locked) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)';
      }}
      onMouseLeave={e => {
        if (!isSelected && !locked) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Gradient swatch — larger for ultra */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: meta.gradient,
        boxShadow: `0 2px 12px ${meta.accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {isActive ? (
          <Check className="h-3.5 w-3.5" style={{ color: '#fff' }} />
        ) : locked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        ) : (
          <span style={{ color: '#fff', opacity: 0.7, display: 'flex' }}>{meta.icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isSelected ? meta.accent : 'var(--popup-text)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {meta.label}
          {isActive && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: `${meta.accent}18`, color: meta.accent,
            }}>
              IN USE
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--popup-text-muted)', marginTop: 1 }}>
          {meta.description}
        </div>
      </div>

      {/* Purchase button or status */}
      {locked && isPremium && (
        <button
          onClick={(e) => { e.stopPropagation(); onPurchase(); }}
          className="rounded-lg px-2.5 py-1 text-[9px] font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: meta.gradient,
            color: '#fff',
            border: `1px solid ${meta.accent}50`,
            boxShadow: `0 2px 8px ${meta.accent}25`,
            whiteSpace: 'nowrap',
          }}
        >
          Buy €2
        </button>
      )}
      {locked && !isPremium && (
        <span style={{ fontSize: 9, color: 'var(--popup-text-muted)', whiteSpace: 'nowrap' }}>
          Aero+ required
        </span>
      )}
    </button>
  );
}

/* ── Single theme row in the list ── */
function ThemeRow({ meta, isActive, isSelected, onSelect }: {
  meta: ThemeMeta; isActive: boolean; isSelected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left transition-all duration-150"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px',
        background: isSelected ? `${meta.accent}12` : 'transparent',
        borderRight: isSelected ? `3px solid ${meta.accent}` : '3px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Color swatch */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: meta.gradient,
        boxShadow: `0 2px 8px ${meta.accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isActive ? (
          <Check className="h-3.5 w-3.5" style={{ color: '#fff' }} />
        ) : (
          <span style={{ color: '#fff', opacity: 0.7, display: 'flex' }}>{meta.icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: isSelected ? meta.accent : 'var(--popup-text)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {meta.label}
          {isActive && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: `${meta.accent}18`, color: meta.accent,
            }}>
              IN USE
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--popup-text-muted)', marginTop: 1 }}>
          {meta.description}
        </div>
      </div>
    </button>
  );
}

/* ── Exported component ── */
export function ThemeSwitcher() {
  const isPremium = useAuthStore(s => s.user?.is_premium === true);
  if (isPremium) return <PremiumPicker />;
  return <FreeToggle />;
}
