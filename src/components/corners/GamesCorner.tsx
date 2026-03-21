import { Gamepad2, Sword, Puzzle, Dices, Trophy } from 'lucide-react';

const COMING_SOON = [
  { icon: Puzzle,   label: 'Word Puzzle',   desc: 'Guess the word in 6 tries'     },
  { icon: Dices,    label: '2048',          desc: 'Slide tiles to reach 2048'     },
  { icon: Sword,    label: 'Rock Paper Scissors', desc: 'Play against your friends' },
  { icon: Trophy,   label: 'Trivia',        desc: 'Test your knowledge'           },
];

export function GamesCorner() {
  return (
    <div
      className="flex h-full flex-col"
      style={{
        width: 300,
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.30)' }}
        >
          <Gamepad2 className="h-4 w-4" style={{ color: '#00d4ff' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Games Corner</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Mini-games while you chat</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-6 gap-4">

        {/* Hero */}
        <div className="text-center mb-2">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(0,212,255,0.05))',
              border: '1px solid rgba(0,212,255,0.25)',
              boxShadow: '0 0 24px rgba(0,212,255,0.15)',
            }}
          >
            <Gamepad2 className="h-8 w-8" style={{ color: '#00d4ff' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Coming Soon</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Quick mini-games to play while you chat — no leaving the app.
          </p>
        </div>

        {/* Game list preview */}
        <div className="w-full flex flex-col gap-2">
          {COMING_SOON.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-aero px-3 py-2.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.18)' }}
              >
                <Icon className="h-4 w-4" style={{ color: 'rgba(0,212,255,0.70)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
              <span
                className="ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
              >
                Soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
