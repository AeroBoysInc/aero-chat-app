import { AeroLogo } from '../AeroLogo';

interface Props {
  phase: 'loading' | 'revealing' | 'done';
}

const BOOT_LINES = [
  { text: '> INITIALIZING SYSTEM...', delay: 0.3 },
  { text: '> LOADING ENCRYPTION MODULES...', delay: 1.0 },
  { text: '> ESTABLISHING SECURE LINK...', delay: 1.5 },
  { text: '> AERO.CHAT READY', delay: 2.0, bright: true },
];

export function MasterSplash({ phase }: Props) {
  const isExiting = phase === 'revealing';

  return (
    <>
      {/* Black background */}
      <div style={{
        position: 'absolute', inset: 0, background: '#050a0f',
        opacity: isExiting ? 0 : 1,
        animation: isExiting ? 'glitch-cut 0.15s steps(1) forwards' : undefined,
      }} />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: `
          repeating-linear-gradient(90deg, rgba(0,230,118,0.03) 0px, transparent 1px, transparent 30px),
          repeating-linear-gradient(0deg, rgba(0,230,118,0.03) 0px, transparent 1px, transparent 30px)
        `,
        opacity: isExiting ? 0 : 1,
        animation: isExiting ? 'glitch-cut 0.15s steps(1) forwards' : undefined,
      }} />

      {/* Scan line */}
      <div
        className="scan-line-anim pointer-events-none absolute left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.3), transparent)',
          boxShadow: '0 0 12px rgba(0,230,118,0.2)',
          animation: isExiting ? undefined : 'scan-line-sweep 6s linear infinite',
          top: 0,
          opacity: isExiting ? 0 : 1,
        }}
      />

      {/* Center content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0, maxWidth: 400, width: '100%', padding: '0 24px',
        opacity: isExiting ? 0 : 1,
        animation: isExiting ? 'glitch-cut 0.15s steps(1) forwards' : undefined,
      }}>
        {/* Typewriter boot lines */}
        <div style={{ alignSelf: 'stretch', marginBottom: 24 }}>
          {BOOT_LINES.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 13,
                color: line.bright ? 'rgba(0,230,118,0.9)' : 'rgba(0,230,118,0.6)',
                opacity: 0,
                animation: `opacity-in 0.1s ease ${line.delay}s forwards`,
                marginBottom: 6,
                textShadow: line.bright ? '0 0 8px rgba(0,230,118,0.4)' : undefined,
              }}
            >
              {line.text}
              {i === BOOT_LINES.length - 1 && (
                <span style={{ animation: 'typewriter-cursor 0.8s step-end infinite', marginLeft: 2 }}>_</span>
              )}
            </div>
          ))}
        </div>

        {/* Logo — fades in at 2.2s */}
        <div style={{
          opacity: 0,
          animation: 'opacity-in 0.4s ease 2.2s forwards',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: '2px solid rgba(0,230,118,0.3)',
            boxShadow: '0 0 16px rgba(0,230,118,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AeroLogo size={40} />
          </div>
        </div>

        {/* Terminal progress bar */}
        <div style={{
          marginTop: 20, alignSelf: 'stretch',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12, color: 'rgba(0,230,118,0.6)',
          opacity: 0,
          animation: 'opacity-in 0.1s ease 0.3s forwards',
        }}>
          <TerminalProgressBar />
        </div>
      </div>
    </>
  );
}

function TerminalProgressBar() {
  const totalBlocks = 12;
  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
      <span>[</span>
      {Array.from({ length: totalBlocks }, (_, i) => {
        const fillDelay = 0.3 + (i / totalBlocks) * 1.9;
        return (
          <span
            key={i}
            style={{
              opacity: 0,
              animation: `opacity-in 0.05s ease ${fillDelay}s forwards`,
              color: 'rgba(0,230,118,0.6)',
            }}
          >
            █
          </span>
        );
      })}
      <span>]</span>
    </div>
  );
}
