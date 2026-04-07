import { memo, useRef, useEffect, useState, lazy, Suspense } from 'react';
import { BackBar } from './BackBar';
import { GlassBannerProfile } from './GlassBannerProfile';
import { CompactSidebar } from './CompactSidebar';
import { ChatWindow } from '../chat/ChatWindow';
import { CallView } from '../call/CallView';
import { GroupCallView } from '../call/GroupCallView';
import { GamesCorner } from '../corners/GamesCorner';
import { GameChatOverlay } from '../corners/GameChatOverlay';
import { ServerOverlay } from '../servers/ServerOverlay';
import { ServerView } from '../servers/ServerView';
import { CreateServerWizard } from '../servers/CreateServerWizard';
import { JoinServerModal } from '../servers/JoinServerModal';
import { useFlip } from '../../hooks/useFlip';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';
import type { TileId } from './TileGrid';

const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));
const CalendarCorner = lazy(() => import('../corners/CalendarCorner').then(m => ({ default: m.CalendarCorner })));
const AvatarCorner = lazy(() => import('../corners/AvatarCorner').then(m => ({ default: m.AvatarCorner })));

const TILE_LABELS: Record<TileId, string> = {
  home: 'Home',
  games: 'Games',
  writers: 'Writers',
  calendar: 'Calendar',
  avatar: 'Avatar',
  servers: 'Servers',
};

interface FullscreenViewProps {
  tileId: TileId;
  firstRect: DOMRect;
  onCollapse: () => void;
  targetTileRect: () => DOMRect | null;
}

export const FullscreenView = memo(function FullscreenView({
  tileId, firstRect, onCollapse, targetTileRect,
}: FullscreenViewProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const flip = useFlip();

  // FLIP expand on mount
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    flip.captureFirst({ getBoundingClientRect: () => firstRect } as HTMLElement);
    flip.playExpand(el);
  }, []); // intentionally once on mount

  const handleCollapse = () => {
    const el = elRef.current;
    const target = targetTileRect();
    if (!el || !target) {
      onCollapse();
      return;
    }
    flip.playCollapse(el, target, onCollapse);
  };

  return (
    <div
      ref={elRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: '#050505',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <BackBar title={TILE_LABELS[tileId]} onBack={handleCollapse} />

      <div className="master-compact" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {tileId === 'home' && <HomeFullscreen />}
        {tileId === 'games' && (
          <>
            <GamesCorner />
            <GameChatOverlay />
          </>
        )}
        {tileId === 'writers' && (
          <Suspense fallback={<LoadingFallback text="Loading Writers Corner..." />}>
            <WritersCorner />
          </Suspense>
        )}
        {tileId === 'calendar' && (
          <Suspense fallback={<LoadingFallback text="Loading Calendar..." />}>
            <CalendarCorner />
          </Suspense>
        )}
        {tileId === 'avatar' && (
          <Suspense fallback={<LoadingFallback text="Loading Avatar Corner..." />}>
            <AvatarCorner />
          </Suspense>
        )}
        {tileId === 'servers' && <ServersFullscreen />}
      </div>
    </div>
  );
});

/* ── Home fullscreen content ── */
function HomeFullscreen() {
  const { selectedContact, setSelectedContact } = useChatStore();
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';

  return (
    <>
      <GlassBannerProfile />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CompactSidebar
          selectedUserId={selectedContact?.id ?? null}
          onSelectUser={setSelectedContact}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {callActive ? (
            <CallView />
          ) : groupCallActive ? (
            <GroupCallView />
          ) : selectedContact ? (
            <ChatWindow contact={selectedContact} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(0,230,118,0.25)', fontSize: 12,
            }}>
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Servers fullscreen ── */
function ServersFullscreen() {
  const serverView = useCornerStore(s => s.serverView);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <>
      {serverView === 'server' || serverView === 'bubble' ? (
        <ServerView />
      ) : (
        <ServerOverlay
          onCreateClick={() => setShowCreateWizard(true)}
          onJoinClick={() => setShowJoinModal(true)}
        />
      )}
      {showCreateWizard && <CreateServerWizard onClose={() => setShowCreateWizard(false)} />}
      {showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} />}
    </>
  );
}

/* ── Loading fallback ── */
function LoadingFallback({ text }: { text: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,230,118,0.5)', fontSize: 13 }}>
      {text}
    </div>
  );
}
