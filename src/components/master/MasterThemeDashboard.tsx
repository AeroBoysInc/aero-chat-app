import { memo, useState, useCallback, useRef } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { FriendRequestModal } from '../chat/FriendRequestModal';
import { PremiumModal } from '../ui/PremiumModal';
import { MiniCallWidget } from '../call/MiniCallWidget';
import { TileGrid, type TileId } from './TileGrid';
import { FullscreenView } from './FullscreenView';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';

export const MasterThemeDashboard = memo(function MasterThemeDashboard() {
  const { user, signOut } = useAuthStore();
  const isPremium = user?.is_premium === true;
  const { pendingIncoming } = useFriendStore();
  const callStatus = useCallStore(s => s.status);
  const groupCallStatus = useGroupCallStore(s => s.status);
  const anyCallActive = callStatus !== 'idle' || (groupCallStatus !== 'idle' && groupCallStatus !== 'ringing');

  const [expandedTile, setExpandedTile] = useState<TileId | null>(null);
  const [flipRect, setFlipRect] = useState<DOMRect | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  const tileRefs = useRef<Record<TileId, HTMLElement | null>>({
    home: null, games: null, writers: null, calendar: null, avatar: null, servers: null,
  });

  // Open corner store state when expanding tiles that map to corners
  const { openGameHub, openWriterHub, openCalendarView, openAvatarView, openServerOverlay } = useCornerStore();

  const handleTileClick = useCallback((id: TileId, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setFlipRect(rect);
    setExpandedTile(id);

    // Sync corner store so existing components work
    if (id === 'games') openGameHub();
    else if (id === 'writers') openWriterHub();
    else if (id === 'calendar') openCalendarView();
    else if (id === 'avatar') openAvatarView();
    else if (id === 'servers') openServerOverlay();
  }, [openGameHub, openWriterHub, openCalendarView, openAvatarView, openServerOverlay]);

  const { closeGameView, closeWriterView, closeCalendarView, closeAvatarView, closeServerOverlay } = useCornerStore();

  const handleCollapse = useCallback(() => {
    const tile = expandedTile;
    setExpandedTile(null);
    setFlipRect(null);

    // Reset corner store
    if (tile === 'games') closeGameView();
    else if (tile === 'writers') closeWriterView();
    else if (tile === 'calendar') closeCalendarView();
    else if (tile === 'avatar') closeAvatarView();
    else if (tile === 'servers') closeServerOverlay();
  }, [expandedTile, closeGameView, closeWriterView, closeCalendarView, closeAvatarView, closeServerOverlay]);

  const getTargetTileRect = useCallback(() => {
    if (!expandedTile) return null;
    return tileRefs.current[expandedTile]?.getBoundingClientRect() ?? null;
  }, [expandedTile]);

  const dashboardVisible = expandedTile === null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#050505',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Header bar — only on dashboard ── */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        opacity: dashboardVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: dashboardVisible ? 'auto' : 'none',
      }}>
        <AeroLogo size={22} />
        <span style={{ fontWeight: 800, fontSize: 14, color: '#00e676', letterSpacing: -0.3 }}>
          AeroChat
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,230,118,0.30)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Master
        </span>

        <div style={{ flex: 1 }} />

        {!isPremium && (
          <button
            onClick={() => setPremiumModalOpen(true)}
            className="rounded-full transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700,
              background: 'rgba(0,230,118,0.08)',
              border: '1px solid rgba(0,230,118,0.18)',
              color: '#00e676', cursor: 'pointer', outline: 'none',
            }}
          >
            Unlock Aero+
          </button>
        )}

        <button
          onClick={() => setRequestsOpen(true)}
          className="relative rounded-lg p-2 transition-all"
          style={{ color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell style={{ width: 16, height: 16 }} />
          {pendingIncoming.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#00e676', fontSize: 8, fontWeight: 700, color: '#050505',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          onClick={signOut}
          className="rounded-lg p-2 transition-all"
          style={{ color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut style={{ width: 16, height: 16 }} />
        </button>

        <ThemeSwitcher />
      </div>

      {/* ── Tile Grid ── */}
      <TileGrid
        onTileClick={handleTileClick}
        tileRefs={tileRefs}
        visible={dashboardVisible}
      />

      {/* ── Fullscreen expanded tile ── */}
      {expandedTile && flipRect && (
        <FullscreenView
          key={expandedTile}
          tileId={expandedTile}
          firstRect={flipRect}
          onCollapse={handleCollapse}
          targetTileRect={getTargetTileRect}
        />
      )}

      {/* ── Mini call widget — always visible ── */}
      {anyCallActive && !expandedTile && <MiniCallWidget />}

      {/* ── Modals ── */}
      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
      <PremiumModal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
    </div>
  );
});
