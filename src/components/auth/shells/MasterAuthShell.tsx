import { ReactNode } from 'react';
import { AeroLogo } from '../../ui/AeroLogo';

interface Props {
  children: ReactNode;
}

export function MasterAuthShell({ children }: Props) {
  return (
    <div className="master-auth relative flex min-h-screen" style={{ background: '#050a0f' }}>
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            repeating-linear-gradient(90deg, rgba(0,230,118,0.03) 0px, transparent 1px, transparent 30px),
            repeating-linear-gradient(0deg, rgba(0,230,118,0.03) 0px, transparent 1px, transparent 30px)
          `,
        }}
      />

      {/* Scan line */}
      <div
        className="scan-line-anim pointer-events-none absolute left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.3), transparent)',
          boxShadow: '0 0 12px rgba(0,230,118,0.2)',
          animation: 'scan-line-sweep 6s linear infinite',
          top: 0,
        }}
      />

      {/* Data columns */}
      {[
        { left: '10%', top: 0, height: '100%', opacity: 0.2 },
        { left: '25%', top: '10%', height: '80%', opacity: 0.15 },
        { right: '15%', top: '5%', height: '90%', opacity: 0.18 },
        { right: '35%', top: '15%', height: '70%', opacity: 0.12 },
      ].map((col, i) => (
        <div key={i} className="pointer-events-none absolute" style={{
          left: (col as any).left, right: (col as any).right,
          top: col.top, height: col.height, width: 1,
          background: `linear-gradient(180deg, rgba(0,230,118,${col.opacity}), transparent 60%)`,
        }} />
      ))}

      {/* ── Left Panel: System Identity (50%) ── */}
      <div className="relative hidden md:flex w-1/2 items-center justify-center">
        <div className="text-center">
          <div style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 11, color: 'rgba(0,230,118,0.6)',
            letterSpacing: 2, textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            SYSTEM LINK
          </div>

          {/* Logo in glowing ring */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: '2px solid rgba(0,230,118,0.3)',
            boxShadow: '0 0 16px rgba(0,230,118,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <AeroLogo size={40} />
          </div>

          <div style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 10, color: 'rgba(0,230,118,0.35)',
          }}>
            AERO.CHAT.V2
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 10, color: 'rgba(0,230,118,0.25)',
            marginTop: 4,
          }}>
            E2E ENCRYPTED
          </div>
        </div>
      </div>

      {/* ── Right Panel: Terminal Form (48%) ── */}
      <div className="relative flex flex-1 md:w-[48%] items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          <div style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12, color: 'rgba(0,230,118,0.4)',
            marginBottom: 16,
          }}>
            AUTHENTICATE &gt;
          </div>

          <div style={{
            background: 'rgba(0,230,118,0.03)',
            border: '1px solid rgba(0,230,118,0.12)',
            borderRadius: 8,
            padding: 24,
          }}>
            {/* Mobile: show logo inside form on narrow screens */}
            <div className="md:hidden mb-6 text-center">
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '2px solid rgba(0,230,118,0.3)',
                boxShadow: '0 0 16px rgba(0,230,118,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
              }}>
                <AeroLogo size={32} />
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 10, color: 'rgba(0,230,118,0.35)',
              }}>
                AERO.CHAT.V2
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
