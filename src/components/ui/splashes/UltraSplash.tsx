import { AeroLogo } from '../AeroLogo';
import { useThemeStore } from '../../../store/themeStore';

interface Props {
  phase: 'loading' | 'revealing' | 'done';
}

export function UltraSplash({ phase }: Props) {
  const theme = useThemeStore(s => s.theme);
  const isExiting = phase === 'revealing';

  return (
    <>
      {/* Full-screen ambient background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--body-bg)',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        {theme === 'golden-hour' ? <GoldenHourSplashBg /> : <FrutigerSplashBg />}
      </div>

      {/* Center content — fades out on exit */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        <div className="splash-logo-pulse" style={{
          filter: 'drop-shadow(0 0 32px var(--input-focus-border))',
        }}>
          <AeroLogo size={140} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'var(--text-primary, #fff)', margin: 0,
            textShadow: '0 0 24px var(--input-focus-border)',
          }}>
            AeroChat
          </h1>
          <p style={{
            fontSize: 12, fontWeight: 500,
            color: 'var(--text-muted, rgba(180,210,255,0.5))',
            marginTop: 4, letterSpacing: '0.05em',
          }}>
            End-to-end encrypted
          </p>
        </div>

        {/* Glass tube progress bar */}
        <div style={{
          width: 140, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden', marginTop: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          position: 'relative',
        }}>
          <div className="splash-progress" style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, var(--input-focus-border), var(--sent-bubble-bg, #5BC8F5))',
          }} />
          {/* Gloss highlight */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
            borderRadius: '3px 3px 0 0', pointerEvents: 'none',
          }} />
        </div>
      </div>
    </>
  );
}

/* Simplified ambient scenes for splash (fewer elements for fast load) */
function FrutigerSplashBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div style={{
        position: 'absolute', width: 600, height: 200, top: -40, left: -80,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 150, bottom: 20, left: '30%',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 10s ease-in-out 6s infinite', opacity: 0.5,
      }} />
      <div style={{
        position: 'absolute', width: 200, height: '100%', top: 0, left: '15%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(-8deg)',
        animation: 'ray-pulse 6s ease-in-out infinite',
      }} />
      {[
        { size: 35, left: '12%', top: '30%', delay: 0 },
        { size: 25, right: '18%', top: '20%', delay: 2 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: s.size, height: s.size,
          left: s.left, right: (s as any).right, top: s.top,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.08) 60%, transparent 80%)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 0 20px rgba(0,180,255,0.12)',
          animation: `orb-drift ${7 + i}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function GoldenHourSplashBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div style={{
        position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,230,150,0.80) 0%, rgba(255,180,50,0.40) 40%, transparent 70%)',
        boxShadow: '0 0 80px rgba(255,180,50,0.35), 0 0 160px rgba(255,140,0,0.18)',
      }} />
      <div style={{
        position: 'absolute', top: '5%', left: '-25%', width: '150%', height: '40%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,80,120,0.25) 20%, rgba(255,140,60,0.20) 50%, rgba(255,200,80,0.15) 80%, transparent 100%)',
        filter: 'blur(50px)', opacity: 0.35,
        animation: 'aurora-drift 15s ease-in-out infinite',
      }} />
      {[
        { width: 120, height: '70vh', left: '35%', skew: -6, delay: 0, dur: 7 },
        { width: 80, height: '55vh', left: '52%', skew: 4, delay: 2, dur: 9, opacity: 0.6 },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 0, width: r.width, height: r.height, left: r.left,
          background: 'linear-gradient(0deg, rgba(255,200,80,0.12) 0%, transparent 100%)',
          transformOrigin: 'bottom center', transform: `skewX(${r.skew}deg)`,
          animation: `ray-pulse ${r.dur}s ease-in-out ${r.delay}s infinite`,
          opacity: (r as any).opacity ?? 1,
        }} />
      ))}
    </div>
  );
}
