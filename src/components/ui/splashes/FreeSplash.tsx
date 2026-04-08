import { AeroLogo } from '../AeroLogo';

interface Props {
  phase: 'loading' | 'revealing' | 'done';
}

export function FreeSplash({ phase }: Props) {
  return (
    <>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--card-bg-solid, #0a1a38)',
        opacity: phase === 'revealing' ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }} />

      {/* Ambient orbs */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        opacity: phase === 'revealing' ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
          opacity: 0.25, top: '15%', left: '10%',
          animation: 'splash-float 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 250, height: 250, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(80,100,255,0.12)) 0%, transparent 70%)',
          opacity: 0.2, bottom: '20%', right: '15%',
          animation: 'splash-float 7s ease-in-out infinite reverse',
        }} />
      </div>

      {/* Center content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        opacity: phase === 'revealing' ? 0 : 1,
        transition: 'opacity 0.25s ease',
      }}>
        <div className="splash-logo-pulse" style={{ filter: 'drop-shadow(0 0 24px var(--input-focus-border))' }}>
          <AeroLogo size={140} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'var(--text-primary, #fff)', margin: 0,
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
        <div style={{
          width: 120, height: 3, borderRadius: 2,
          background: 'var(--panel-divider, rgba(255,255,255,0.08))',
          overflow: 'hidden', marginTop: 8,
        }}>
          <div className="splash-progress" style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, var(--input-focus-border), var(--sent-bubble-bg, #5BC8F5))',
          }} />
        </div>
      </div>
    </>
  );
}
