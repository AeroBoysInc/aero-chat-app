import { memo, useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { DndMap } from '../../../../lib/serverTypes';

export const MapSwitcher = memo(function MapSwitcher({
  maps,
  activeMapId,
  isDm,
  onSelectMap,
  onOpenManager,
}: {
  maps: DndMap[];
  activeMapId: string | null;
  isDm: boolean;
  onSelectMap: (id: string) => void;
  onOpenManager: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeMap = maps.find(m => m.id === activeMapId);

  return (
    <div ref={ref} style={{ position: 'absolute', top: 14, left: 14, zIndex: 15 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', color: '#ddd',
          }}
        >
          <span style={{ fontSize: 14 }}>🗺️</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{activeMap?.name ?? 'No maps'}</span>
          <span style={{ fontSize: 10, color: '#777', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>

        {isDm && (
          <button
            onClick={onOpenManager}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)', color: '#888',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Settings size={14} />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 220,
          background: 'rgba(18,18,32,0.97)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}>
          {maps.map(m => (
            <button
              key={m.id}
              onClick={() => { onSelectMap(m.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', fontSize: 11,
                color: m.id === activeMapId ? 'var(--tk-gold, #FFD700)' : '#ccc',
                background: m.id === activeMapId ? 'rgba(255,215,0,0.06)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>🗺️</span> {m.name}
            </button>
          ))}
          {maps.length === 0 && (
            <div style={{ padding: '14px', fontSize: 11, color: '#555', textAlign: 'center' }}>No maps uploaded yet</div>
          )}
        </div>
      )}
    </div>
  );
});
