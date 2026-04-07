import { memo, useRef, forwardRef, type ReactNode } from 'react';
import { Gamepad2, PenTool, CalendarDays, User, Globe, MessageSquare } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useParallax } from '../../hooks/useParallax';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage, type Status } from '../ui/AvatarImage';

export type TileId = 'home' | 'games' | 'writers' | 'calendar' | 'avatar' | 'servers';

interface TileGridProps {
  onTileClick: (id: TileId, el: HTMLElement) => void;
  tileRefs: React.MutableRefObject<Record<TileId, HTMLElement | null>>;
  visible: boolean;
}

/* ── Individual parallax tile wrapper ── */
const ParallaxTile = forwardRef<HTMLDivElement, {
  children: ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}>(function ParallaxTile({ children, onClick, style }, fwdRef) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = (fwdRef ?? localRef) as React.RefObject<HTMLDivElement>;
  const { onMouseMove, onMouseEnter, onMouseLeave } = useParallax(ref, 12);

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="tile-paused"
      style={{
        borderRadius: 18,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(145deg, rgba(0,230,118,0.08), rgba(0,30,18,0.92))',
        border: '1px solid rgba(0,230,118,0.18)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)',
        transition: 'box-shadow 0.3s ease',
        ...style,
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 12px 40px rgba(0,230,118,0.10), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,230,118,0.12)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)';
      }}
    >
      {/* Gloss highlight (convex bubble) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
        background: 'linear-gradient(180deg, rgba(0,230,118,0.06) 0%, transparent 100%)',
        borderRadius: '18px 18px 0 0',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Inner glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        boxShadow: 'inset 0 0 40px rgba(0,230,118,0.04)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {children}
      </div>
    </div>
  );
});

/* ── Tile label ── */
function TileLabel({ title, sub, icon: Icon }: { title: string; sub?: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }) {
  return (
    <>
      <div style={{
        position: 'absolute', bottom: 12, left: 14, zIndex: 3,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#00e676' }}>{title}</div>
        {sub && <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(0,230,118,0.40)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, opacity: 0.25 }}>
        <Icon style={{ width: 18, height: 18, color: '#00e676' }} />
      </div>
    </>
  );
}

/* ── Home tile preview ── */
const HomeTilePreview = memo(function HomeTilePreview() {
  const friends = useFriendStore(useShallow(s => s.friends));
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const unreads = useUnreadStore(s => s.unreads);
  const totalUnread = Object.values(unreads).reduce((a, b) => a + b, 0);

  const displayed = friends.slice(0, 7);

  return (
    <div style={{ paddingTop: 14, height: '100%', position: 'relative' }}>
      {displayed.map(f => {
        const isOnline = presenceReady ? onlineIds.has(f.id) : true;
        const effective: Status = isOnline ? ((f.status as Status) ?? 'online') : 'offline';
        const unread = unreads[f.id] ?? 0;
        return (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px' }}>
            <AvatarImage username={f.username} avatarUrl={f.avatar_url} size="sm" status={effective} />
            <div style={{
              flex: 1, fontSize: 10, fontWeight: 600,
              color: 'rgba(255,255,255,0.50)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {f.username}
            </div>
            {unread > 0 && (
              <span style={{
                fontSize: 7, fontWeight: 700,
                background: 'rgba(0,230,118,0.22)', color: '#00e676',
                padding: '1px 5px', borderRadius: 6,
              }}>
                {unread}
              </span>
            )}
          </div>
        );
      })}
      <TileLabel title="Home" sub={totalUnread > 0 ? `${totalUnread} unread` : `${friends.length} friends`} icon={MessageSquare} />
    </div>
  );
});

/* ── Games tile preview ── */
const GamesTilePreview = memo(function GamesTilePreview() {
  const games = [
    { icon: '🎯', name: 'Bubble Pop' },
    { icon: '♟', name: 'Chess' },
    { icon: '🧩', name: '2048' },
  ];
  return (
    <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {games.map((g, i) => (
        <div key={i} style={{
          width: 34, height: 34, borderRadius: 10,
          background: `rgba(0,230,118,${0.10 - i * 0.02})`,
          border: `1px solid rgba(0,230,118,${0.15 - i * 0.03})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>
          {g.icon}
        </div>
      ))}
      <TileLabel title="Games" sub={`${games.length} available`} icon={Gamepad2} />
    </div>
  );
});

/* ── Writers tile preview ── */
const WritersTilePreview = memo(function WritersTilePreview() {
  return (
    <div style={{ padding: 14 }}>
      {[75, 90, 60, 82, 45].map((w, i) => (
        <div key={i} style={{
          height: 5, borderRadius: 3, marginBottom: 5,
          width: `${w}%`, background: 'rgba(0,230,118,0.10)',
        }} />
      ))}
      <TileLabel title="Writers" sub="2 drafts" icon={PenTool} />
    </div>
  );
});

/* ── Calendar tile preview ── */
const CalendarTilePreview = memo(function CalendarTilePreview() {
  const now = new Date();
  return (
    <div style={{ padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,230,118,0.40)', letterSpacing: 1 }}>TODAY</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'rgba(0,230,118,0.60)', lineHeight: 1.1 }}>
        {String(now.getDate()).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,230,118,0.35)' }}>
        {now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
      </div>
      <TileLabel title="Calendar" sub="2 events" icon={CalendarDays} />
    </div>
  );
});

/* ── Avatar tile preview ── */
const AvatarTilePreview = memo(function AvatarTilePreview() {
  const user = useAuthStore(s => s.user);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(0,230,118,0.10)',
        border: '2px solid rgba(0,230,118,0.25)',
        boxShadow: '0 0 16px rgba(0,230,118,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(0,230,118,0.50)' }}>
            {(user?.username ?? '?')[0].toUpperCase()}
          </span>
        )}
      </div>
      <TileLabel title="Avatar" sub="Customize" icon={User} />
    </div>
  );
});

/* ── Servers tile preview ── */
const ServersTilePreview = memo(function ServersTilePreview() {
  const servers = useServerStore(useShallow(s => s.servers));
  const serverUnreads = useServerStore(s => s.serverUnreads);
  const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);
  const displayed = servers.slice(0, 4);

  return (
    <div style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', height: '100%' }}>
      {displayed.map(s => (
        <div key={s.id} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(0,230,118,0.08)',
          border: '1px solid rgba(0,230,118,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'rgba(0,230,118,0.45)',
        }}>
          {s.name.slice(0, 2).toUpperCase()}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {totalUnread > 0 && (
        <span style={{
          fontSize: 8, fontWeight: 700,
          background: 'rgba(0,230,118,0.22)', color: '#00e676',
          padding: '2px 6px', borderRadius: 8,
        }}>
          {totalUnread} new
        </span>
      )}
      <TileLabel title="Servers" sub={`${servers.length} servers`} icon={Globe} />
    </div>
  );
});

/* ── Main TileGrid ── */
export const TileGrid = memo(function TileGrid({ onTileClick, tileRefs, visible }: TileGridProps) {
  const setRef = (id: TileId) => (el: HTMLDivElement | null) => { tileRefs.current[id] = el; };

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '0 16px 16px',
      minHeight: 0,
    }}>
      {/* Main 3x2 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2.2fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 10,
        flex: 1,
        minHeight: 0,
      }}>
        <ParallaxTile ref={setRef('home')} onClick={() => onTileClick('home', tileRefs.current.home!)} style={{ gridRow: '1 / 3' }}>
          <HomeTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('games')} onClick={() => onTileClick('games', tileRefs.current.games!)}>
          <GamesTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('writers')} onClick={() => onTileClick('writers', tileRefs.current.writers!)}>
          <WritersTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('calendar')} onClick={() => onTileClick('calendar', tileRefs.current.calendar!)}>
          <CalendarTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('avatar')} onClick={() => onTileClick('avatar', tileRefs.current.avatar!)}>
          <AvatarTilePreview />
        </ParallaxTile>
      </div>

      {/* Servers wide bar */}
      <ParallaxTile ref={setRef('servers')} onClick={() => onTileClick('servers', tileRefs.current.servers!)} style={{ height: 62, flexShrink: 0 }}>
        <ServersTilePreview />
      </ParallaxTile>
    </div>
  );
});
