import { memo, useRef, useCallback, forwardRef, type ReactNode } from 'react';
import { Gamepad2, PenTool, CalendarDays, User, Globe } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useParallax } from '../../hooks/useParallax';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { GlassBannerProfile } from './GlassBannerProfile';
import { CompactSidebar } from './CompactSidebar';
import { ChatWindow } from '../chat/ChatWindow';
import { CallView } from '../call/CallView';
import { GroupCallView } from '../call/GroupCallView';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';

export type TileId = 'home' | 'games' | 'writers' | 'calendar' | 'avatar' | 'servers';

/* ── Shared glass tile styles ── */
const GLASS_TILE: React.CSSProperties = {
  borderRadius: 18,
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(145deg, rgba(0,230,118,0.08), rgba(0,30,18,0.92))',
  border: '1px solid rgba(0,230,118,0.18)',
  backdropFilter: 'blur(16px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)',
};

/* ── Decorative parallax tile (info panels) ── */
const ParallaxTile = forwardRef<HTMLDivElement, {
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}>(function ParallaxTile({ children, onClick, style }, fwdRef) {
  const localRef = useRef<HTMLDivElement>(null);
  const { onMouseMove, onMouseEnter, onMouseLeave } = useParallax(localRef);

  const mergedRef = useCallback((el: HTMLDivElement | null) => {
    localRef.current = el;
    if (typeof fwdRef === 'function') fwdRef(el);
    else if (fwdRef) fwdRef.current = el;
  }, [fwdRef]);

  return (
    <div
      ref={mergedRef}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        ...GLASS_TILE,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.3s ease',
        ...style,
      }}
      onMouseOver={e => {
        e.currentTarget.style.boxShadow =
          '0 12px 40px rgba(0,230,118,0.10), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,230,118,0.12)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.boxShadow =
          '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)';
      }}
    >
      {/* Gloss highlight */}
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
        position: 'absolute', bottom: 10, left: 12, zIndex: 3,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#00e676' }}>{title}</div>
        {sub && <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(0,230,118,0.40)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, opacity: 0.20 }}>
        <Icon style={{ width: 14, height: 14, color: '#00e676' }} />
      </div>
    </>
  );
}

/* ── Home panel (interactive chat — no parallax) ── */
const HomePanel = memo(function HomePanel() {
  const { selectedContact, setSelectedContact } = useChatStore();
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';

  return (
    <div style={{ ...GLASS_TILE, gridRow: '1 / 3', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <GlassBannerProfile />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CompactSidebar
          selectedUserId={selectedContact?.id ?? null}
          onSelectUser={setSelectedContact}
        />
        <div className="master-compact" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {callActive ? (
            <CallView />
          ) : groupCallActive ? (
            <GroupCallView />
          ) : selectedContact ? (
            <ChatWindow contact={selectedContact} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(0,230,118,0.20)', fontSize: 11,
            }}>
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* ── Games tile ── */
const GamesTile = memo(function GamesTile() {
  const games = [
    { icon: '🎯', name: 'Bubble Pop' },
    { icon: '♟', name: 'Chess' },
    { icon: '🧩', name: '2048' },
  ];
  return (
    <div style={{ padding: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {games.map((g, i) => (
        <div key={i} style={{
          width: 30, height: 30, borderRadius: 8,
          background: `rgba(0,230,118,${0.10 - i * 0.02})`,
          border: `1px solid rgba(0,230,118,${0.15 - i * 0.03})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
        }}>
          {g.icon}
        </div>
      ))}
      <TileLabel title="Games" sub={`${games.length} available`} icon={Gamepad2} />
    </div>
  );
});

/* ── Writers tile ── */
const WritersTile = memo(function WritersTile() {
  return (
    <div style={{ padding: 12 }}>
      {[75, 90, 60, 82, 45].map((w, i) => (
        <div key={i} style={{
          height: 4, borderRadius: 2, marginBottom: 4,
          width: `${w}%`, background: 'rgba(0,230,118,0.10)',
        }} />
      ))}
      <TileLabel title="Writers" sub="2 drafts" icon={PenTool} />
    </div>
  );
});

/* ── Calendar tile ── */
const CalendarTile = memo(function CalendarTile() {
  const now = new Date();
  return (
    <div style={{ padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(0,230,118,0.40)', letterSpacing: 1 }}>TODAY</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'rgba(0,230,118,0.60)', lineHeight: 1.1 }}>
        {String(now.getDate()).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,230,118,0.35)' }}>
        {now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
      </div>
      <TileLabel title="Calendar" sub="2 events" icon={CalendarDays} />
    </div>
  );
});

/* ── Avatar tile ── */
const AvatarTile = memo(function AvatarTile() {
  const user = useAuthStore(s => s.user);
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(0,230,118,0.10)',
        border: '2px solid rgba(0,230,118,0.25)',
        boxShadow: '0 0 12px rgba(0,230,118,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,230,118,0.50)' }}>
            {(user?.username ?? '?')[0].toUpperCase()}
          </span>
        )}
      </div>
      <TileLabel title="Avatar" sub="Customize" icon={User} />
    </div>
  );
});

/* ── Servers tile ── */
const ServersTile = memo(function ServersTile() {
  const servers = useServerStore(useShallow(s => s.servers));
  const serverUnreads = useServerStore(s => s.serverUnreads);
  const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);
  const displayed = servers.slice(0, 4);

  return (
    <div style={{ padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center', height: '100%' }}>
      {displayed.map(s => (
        <div key={s.id} style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(0,230,118,0.08)',
          border: '1px solid rgba(0,230,118,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'rgba(0,230,118,0.45)',
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
interface TileGridProps {
  onServersClick: (el: HTMLElement) => void;
  serversRef: React.MutableRefObject<HTMLElement | null>;
  visible: boolean;
}

export const TileGrid = memo(function TileGrid({ onServersClick, serversRef, visible }: TileGridProps) {
  const setServersRef = useCallback((el: HTMLDivElement | null) => { serversRef.current = el; }, [serversRef]);

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
        <HomePanel />
        <ParallaxTile><GamesTile /></ParallaxTile>
        <ParallaxTile><WritersTile /></ParallaxTile>
        <ParallaxTile><CalendarTile /></ParallaxTile>
        <ParallaxTile><AvatarTile /></ParallaxTile>
      </div>

      {/* Servers wide bar — only clickable tile */}
      <ParallaxTile
        ref={setServersRef}
        onClick={() => serversRef.current && onServersClick(serversRef.current)}
        style={{ height: 62, flexShrink: 0 }}
      >
        <ServersTile />
      </ParallaxTile>
    </div>
  );
});
