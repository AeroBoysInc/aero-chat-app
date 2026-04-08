import { memo, useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Bell, LogOut, Gamepad2, PenTool, CalendarDays, User } from 'lucide-react';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { useIsMobile } from '../../lib/useIsMobile';
import { FriendRequestModal } from '../chat/FriendRequestModal';
import { PremiumModal } from '../ui/PremiumModal';
import { SettingsPanel } from '../settings/SettingsPanel';
import { MiniCallWidget } from '../call/MiniCallWidget';
import { MasterPopup } from './MasterPopup';
import { TileGrid } from './TileGrid';
import { FullscreenView } from './FullscreenView';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useWriterStore } from '../../store/writerStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useXpStore } from '../../store/xpStore';

const GamesCorner = lazy(() => import('../corners/GamesCorner').then(m => ({ default: m.GamesCorner })));
const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));
const CalendarCorner = lazy(() => import('../corners/CalendarCorner').then(m => ({ default: m.CalendarCorner })));
const AvatarCorner = lazy(() => import('../corners/AvatarCorner').then(m => ({ default: m.AvatarCorner })));

type PopupView = 'games' | 'writers' | 'calendar' | 'avatar' | null;

function PopupLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(0,230,118,0.35)', fontSize: 12 }}>
      Loading…
    </div>
  );
}

export const MasterThemeDashboard = memo(function MasterThemeDashboard() {
  const { user, signOut } = useAuthStore();
  const isPremium = user?.is_premium === true;
  const { pendingIncoming } = useFriendStore();
  const callStatus = useCallStore(s => s.status);
  const groupCallStatus = useGroupCallStore(s => s.status);
  const anyCallActive = callStatus !== 'idle' || (groupCallStatus !== 'idle' && groupCallStatus !== 'ringing');
  const isMobile = useIsMobile();

  const [serversExpanded, setServersExpanded] = useState(false);
  const [flipRect, setFlipRect] = useState<DOMRect | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [popupView, setPopupView] = useState<PopupView>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileFullTile, setMobileFullTile] = useState<'games' | 'writers' | 'calendar' | 'avatar' | null>(null);

  const serversRef = useRef<HTMLElement | null>(null);
  const { openServerOverlay, closeServerOverlay, enterServer } = useCornerStore();
  const { selectServer, clearUnread, loadServerData } = useServerStore();

  // Pre-load data for tiles so content is visible on the dashboard
  useEffect(() => {
    if (!user) return;
    useWriterStore.getState().initRole(user.id, user.username);
    useWriterStore.getState().fetchPublicStories();
    useCalendarStore.getState().init(user.id);
    const unsubCal = useCalendarStore.getState().subscribeRealtime(user.id);
    if (!useXpStore.getState().loaded) useXpStore.getState().loadXp(user.id);
    useServerStore.getState().loadServers();
    return unsubCal;
  }, [user?.id]);

  const handleServersClick = useCallback((el: HTMLElement) => {
    setFlipRect(el.getBoundingClientRect());
    setServersExpanded(true);
    openServerOverlay();
  }, [openServerOverlay]);

  const handleCollapse = useCallback(() => {
    setServersExpanded(false);
    setFlipRect(null);
    closeServerOverlay();
  }, [closeServerOverlay]);

  const getTargetTileRect = useCallback(() => {
    return serversRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const handleTileClick = useCallback((tile: 'games' | 'writers' | 'calendar' | 'avatar') => {
    if (isMobile) {
      setMobileFullTile(tile);
    } else {
      setPopupView(tile);
    }
  }, [isMobile]);

  const closePopup = useCallback(() => setPopupView(null), []);
  const handleSettingsClick = useCallback(() => setSettingsOpen(true), []);
  const handleBellClick = useCallback(() => setRequestsOpen(true), []);

  const handleServerDirect = useCallback(async (serverId: string) => {
    selectServer(serverId);
    clearUnread(serverId);
    await loadServerData(serverId);
    enterServer();
    const el = serversRef.current;
    if (el) {
      setFlipRect(el.getBoundingClientRect());
      setServersExpanded(true);
    }
  }, [selectServer, clearUnread, loadServerData, enterServer]);

  const dashboardVisible = !serversExpanded && !mobileFullTile;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#050505',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Header bar ── */}
      <div style={{
        padding: isMobile ? '8px 10px' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 10,
        flexShrink: 0,
        opacity: dashboardVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: dashboardVisible ? 'auto' : 'none',
      }}>
        <AeroLogo size={isMobile ? 40 : 48} />
        <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 14, color: '#00e676', letterSpacing: -0.3 }}>
          AeroChat
        </span>
        <span style={{ fontSize: isMobile ? 7 : 9, fontWeight: 700, color: 'rgba(0,230,118,0.30)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Matrix
        </span>

        <div style={{ flex: 1 }} />

        {!isPremium && !isMobile && (
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
          style={{
            color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none',
            cursor: 'pointer', outline: 'none',
            minWidth: 36, minHeight: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
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
          style={{
            color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none',
            cursor: 'pointer', outline: 'none',
            minWidth: 36, minHeight: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LogOut style={{ width: 16, height: 16 }} />
        </button>

        {!isMobile && <ThemeSwitcher />}
      </div>

      {/* ── Tile Grid ── */}
      <TileGrid
        onServersClick={handleServersClick}
        onServerDirectClick={handleServerDirect}
        onTileClick={handleTileClick}
        onSettingsClick={handleSettingsClick}
        onBellClick={handleBellClick}
        serversRef={serversRef}
        visible={dashboardVisible}
      />

      {/* ── Fullscreen servers view ── */}
      {serversExpanded && flipRect && (
        <FullscreenView
          key="servers"
          tileId="servers"
          firstRect={flipRect}
          onCollapse={handleCollapse}
          targetTileRect={getTargetTileRect}
        />
      )}

      {/* ── Mobile fullscreen tile views ── */}
      {mobileFullTile && (
        <FullscreenView
          key={mobileFullTile}
          tileId={mobileFullTile}
          firstRect={new DOMRect(0, 0, window.innerWidth, window.innerHeight)}
          onCollapse={() => setMobileFullTile(null)}
          targetTileRect={() => new DOMRect(0, 0, window.innerWidth, window.innerHeight)}
        />
      )}

      {/* ── Mini call widget ── */}
      {anyCallActive && dashboardVisible && <MiniCallWidget />}

      {/* ── Tile popups (desktop only) ── */}
      {popupView === 'games' && (
        <MasterPopup title="Games Corner" icon={<Gamepad2 style={{ width: 16, height: 16, color: '#00e676' }} />} onClose={closePopup}>
          <Suspense fallback={<PopupLoading />}><GamesCorner /></Suspense>
        </MasterPopup>
      )}
      {popupView === 'writers' && (
        <MasterPopup title="Writers Corner" icon={<PenTool style={{ width: 16, height: 16, color: '#00e676' }} />} onClose={closePopup}>
          <Suspense fallback={<PopupLoading />}><WritersCorner /></Suspense>
        </MasterPopup>
      )}
      {popupView === 'calendar' && (
        <MasterPopup title="Calendar" icon={<CalendarDays style={{ width: 16, height: 16, color: '#00e676' }} />} onClose={closePopup}>
          <Suspense fallback={<PopupLoading />}><CalendarCorner /></Suspense>
        </MasterPopup>
      )}
      {popupView === 'avatar' && (
        <MasterPopup title="Avatar & Stats" icon={<User style={{ width: 16, height: 16, color: '#00e676' }} />} onClose={closePopup}>
          <Suspense fallback={<PopupLoading />}><AvatarCorner /></Suspense>
        </MasterPopup>
      )}

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div style={{
            position: 'absolute',
            ...(isMobile
              ? { inset: 0, borderRadius: 0 }
              : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 600, height: '80%', maxHeight: 560, borderRadius: 20 }
            ),
            overflow: 'hidden',
            background: 'linear-gradient(145deg, rgba(0,230,118,0.04), rgba(0,15,10,0.97))',
            border: isMobile ? 'none' : '1px solid rgba(0,230,118,0.15)',
            boxShadow: isMobile ? 'none' : '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
      <PremiumModal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
    </div>
  );
});
