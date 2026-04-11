// src/components/servers/toolkits/ToolkitInfoModal.tsx
import { memo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGES = [
  {
    title: 'Welcome to Dungeons & Servers',
    subtitle: 'Your complete DnD campaign management toolkit',
    icon: '⚔️',
    features: [
      { icon: '🃏', name: 'Character Cards', desc: 'D&D Beyond sync' },
      { icon: '🗺️', name: 'World Map', desc: 'Pin locations live' },
      { icon: '📜', name: 'Quest Log', desc: 'Track & cross off' },
      { icon: '🎲', name: 'Dice Roller', desc: '/roll in chat' },
      { icon: '📖', name: 'DM Notebook', desc: 'Medieval-styled notes' },
      { icon: '🎨', name: 'Themed UI', desc: 'Medieval accents' },
    ],
  },
  {
    title: 'Character Cards',
    subtitle: 'Link your D&D Beyond character or create a manual card',
    icon: '🃏',
    body: 'Each server member can link their D&D Beyond character by pasting their share URL. The toolkit pulls stats, HP, XP, class, race, portrait, and more. Characters appear as cards in the sidebar with live HP and XP bars.\n\nIf you use another platform (Foundry VTT, Roll20), you can create a manual tracking card with basic info: portrait, name, class, level, HP, XP, and gold.',
  },
  {
    title: 'World Map',
    subtitle: 'Upload maps and pin locations in real-time',
    icon: '🗺️',
    body: 'The DM uploads a map image (hand-drawn, generated, or found). Click anywhere to drop a pin with a name, description, and icon. All players see pins appear in real-time.\n\nSupports zoom and pan. Multiple maps per server — switch between continent maps, city maps, or dungeon layouts. Pins scale correctly at any zoom level.',
  },
  {
    title: 'Quest Log',
    subtitle: 'Track party objectives and secret side quests',
    icon: '📜',
    body: 'The DM creates quests that appear in a shared quest log. Public quests are visible to the whole party. Secret quests can be assigned to specific players — only they (and the DM) can see them.\n\nCompleted quests get crossed off with a satisfying animation and move to a "Completed" section. Reorder quests by dragging.',
  },
  {
    title: 'Dice & Chat',
    subtitle: 'Roll dice directly in chat with /roll',
    icon: '🎲',
    body: 'Type /roll 2d6+3 in any bubble chat to roll dice. Results appear as styled blocks with color-coded numbers — red for low rolls, green for high, with a smooth gradient between.\n\nNatural 1s glow red with a "NAT 1!" badge. Natural 20s glow green with a "NAT 20!" badge. The total is displayed large and bold.',
  },
  {
    title: 'DM Tools & Setup',
    subtitle: 'How to get started as the Dungeon Master',
    icon: '📖',
    body: 'The server owner automatically becomes the DM. You can grant the "Dungeon Master" permission to other roles via Server Settings → Roles.\n\nDM-only features: DM Notebook for private session notes, World Map pin placement, Quest creation and management, and the ability to update any character\'s HP during sessions.\n\nTo get started: activate the toolkit, ask your players to link their D&D Beyond characters, upload a world map, and create your first quest!',
  },
];

export const ToolkitInfoModal = memo(function ToolkitInfoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: '1px solid var(--tk-border, var(--panel-divider))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 18 }}>🐉</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>Dungeons & Servers</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Page dots */}
        <div className="flex justify-center gap-1.5 py-2.5">
          {PAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: i === page ? 'var(--tk-accent-light, #00d4ff)' : 'var(--tk-border, rgba(255,255,255,0.12))',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          <div className="text-center mb-5">
            <div style={{ fontSize: 44, marginBottom: 6 }}>{current.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: '0 0 4px' }}>{current.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', margin: 0 }}>{current.subtitle}</p>
          </div>

          {/* Page 0 — feature grid */}
          {'features' in current && current.features && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {current.features.map(f => (
                <div key={f.name} style={{
                  padding: 14, borderRadius: 12,
                  background: 'var(--tk-panel, rgba(0,180,255,0.06))',
                  border: '1px solid var(--tk-border, var(--panel-divider))',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tk-text, var(--text-primary))' }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pages 1–5 — text body */}
          {'body' in current && current.body && (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--tk-text-muted, var(--text-secondary))', whiteSpace: 'pre-line' }}>
              {current.body}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="flex items-center gap-1 text-xs font-medium transition-opacity disabled:opacity-30"
            style={{ color: 'var(--tk-text-muted, var(--text-muted))', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
            {page + 1} of {PAGES.length}
          </span>
          {page < PAGES.length - 1 ? (
            <button
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--tk-accent-glow, rgba(0,212,255,0.15))',
                color: 'var(--tk-accent-light, #00d4ff)',
                border: '1px solid var(--tk-border, rgba(0,212,255,0.2))',
                cursor: 'pointer',
              }}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--tk-accent-glow, rgba(0,212,255,0.15))',
                color: 'var(--tk-accent-light, #00d4ff)',
                border: '1px solid var(--tk-border, rgba(0,212,255,0.2))',
                cursor: 'pointer',
              }}
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
