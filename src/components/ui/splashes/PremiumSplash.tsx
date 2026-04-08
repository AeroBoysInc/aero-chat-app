import { AeroLogo } from '../AeroLogo';

interface Props {
  phase: 'loading' | 'revealing' | 'done';
}

export function PremiumSplash({ phase }: Props) {
  const isExiting = phase === 'revealing';

  return (
    <>
      {/* Left panel */}
      <div
        className="curtain-anim absolute top-0 bottom-0 left-0 w-1/2 flex items-center justify-center overflow-hidden"
        style={{
          background: 'var(--card-bg-solid, #0a1a38)',
          animation: isExiting ? 'curtain-left 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards' : undefined,
        }}
      >
        {/* Orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="orb" style={{
            position: 'absolute', width: 200, height: 200, top: '10%', left: '10%',
            background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
            opacity: 0.3, animation: 'orb-drift 8s ease-in-out infinite',
          }} />
          <div className="orb" style={{
            position: 'absolute', width: 160, height: 160, bottom: '15%', left: '30%',
            background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(120,80,255,0.15)) 0%, transparent 70%)',
            opacity: 0.2, animation: 'orb-drift 9s ease-in-out 2s infinite',
          }} />
          <div className="orb" style={{
            position: 'absolute', width: 140, height: 140, top: '45%', right: '5%',
            background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
            opacity: 0.15, animation: 'orb-drift 7s ease-in-out 4s infinite',
          }} />
        </div>

        {/* Logo + title */}
        <div style={{
          position: 'relative', zIndex: 1, textAlign: 'center',
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}>
          <div className="splash-logo-pulse" style={{
            filter: 'drop-shadow(0 0 28px var(--input-focus-border))',
          }}>
            <AeroLogo size={72} />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'var(--text-primary, #fff)', margin: '12px 0 0',
          }}>
            AeroChat
          </h1>
        </div>
      </div>

      {/* Right panel */}
      <div
        className="curtain-anim absolute top-0 bottom-0 right-0 w-1/2 flex items-center justify-center"
        style={{
          background: 'var(--card-bg-solid, #0a1a38)',
          animation: isExiting ? 'curtain-right 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards' : undefined,
        }}
      >
        {/* Faint single orb */}
        <div className="orb" style={{
          position: 'absolute', width: 120, height: 120, top: '30%', right: '20%',
          background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
          opacity: 0.1, animation: 'orb-drift 10s ease-in-out infinite',
        }} />

        <p style={{
          position: 'relative', zIndex: 1,
          fontSize: 13, fontWeight: 500,
          color: 'var(--text-muted, rgba(180,210,255,0.5))',
          letterSpacing: '0.05em',
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}>
          End-to-end encrypted
        </p>
      </div>

      {/* Full-width progress bar at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3, zIndex: 2,
        background: 'var(--panel-divider, rgba(255,255,255,0.08))',
        overflow: 'hidden',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.2s ease',
      }}>
        <div className="splash-progress" style={{
          height: '100%',
          background: 'linear-gradient(90deg, var(--input-focus-border), var(--sent-bubble-bg, #5BC8F5))',
        }} />
      </div>
    </>
  );
}
