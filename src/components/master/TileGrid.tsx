import { memo, useRef, useCallback, forwardRef, useMemo, useState, type ReactNode } from 'react';
import { Gamepad2, PenTool, CalendarDays, Globe, Heart, Eye, CheckCircle2, Circle, ArrowLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useParallax } from '../../hooks/useParallax';
import { useIsMobile } from '../../lib/useIsMobile';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { useWriterStore } from '../../store/writerStore';
import { useCalendarStore, toDateString } from '../../store/calendarStore';
import { useXpStore } from '../../store/xpStore';
import { deriveLevel, deriveOverallLevel, BAR_META, type XpBar } from '../../lib/xpConfig';
import { getInstalledGames } from '../../lib/gameInstalls';
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
  maxRotate?: number;
}>(function ParallaxTile({ children, onClick, style, maxRotate }, fwdRef) {
  const localRef = useRef<HTMLDivElement>(null);
  const { onMouseMove, onMouseEnter, onMouseLeave } = useParallax(localRef, maxRotate);

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


/* ── Home panel (interactive chat — no parallax) ── */
const HomePanel = memo(function HomePanel({ onSettingsClick, onBellClick, isMobile }: { onSettingsClick?: () => void; onBellClick?: () => void; isMobile?: boolean }) {
  const { selectedContact, setSelectedContact } = useChatStore();
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const handleSelectUser = useCallback((user: import('../../store/authStore').Profile) => {
    setSelectedContact(user);
    if (isMobile) setMobileShowChat(true);
  }, [setSelectedContact, isMobile]);

  const handleMobileBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  return (
    <div style={{
      ...GLASS_TILE,
      ...(!isMobile ? { gridRow: '1 / 3' } : {}),
      display: 'flex', flexDirection: 'column', overflow: 'visible',
      ...(isMobile ? { minHeight: 340 } : {}),
    }}>
      <GlassBannerProfile onSettingsClick={onSettingsClick} onBellClick={onBellClick} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', borderRadius: '0 0 18px 18px', position: 'relative' }}>
        {/* Desktop: side-by-side. Mobile: toggle between sidebar and chat */}
        {isMobile ? (
          mobileShowChat && selectedContact ? (
            <div className="master-compact" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Mobile back button */}
              <button
                onClick={handleMobileBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', flexShrink: 0,
                  background: 'rgba(0,230,118,0.04)',
                  borderBottom: '1px solid rgba(0,230,118,0.08)',
                  border: 'none', cursor: 'pointer', outline: 'none',
                  color: 'rgba(0,230,118,0.55)', fontSize: 10, fontWeight: 600,
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} />
                Back
              </button>
              {callActive ? (
                <CallView />
              ) : groupCallActive ? (
                <GroupCallView />
              ) : (
                <ChatWindow contact={selectedContact} />
              )}
            </div>
          ) : (
            <CompactSidebar
              selectedUserId={selectedContact?.id ?? null}
              onSelectUser={handleSelectUser}
              fullWidth
            />
          )
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
});

/* ── Game catalog for tile display ── */
const GAME_CATALOG = [
  { id: 'bubblepop', icon: '🫧', label: 'Bubble Pop', desc: 'Pop bubbles!' },
  { id: 'tropico', icon: '🌴', label: 'Tropico', desc: 'Tropical platformer' },
  { id: 'typingtest', icon: '⌨️', label: 'Type Rush', desc: 'WPM speed test' },
  { id: 'twentyfortyeight', icon: '🔢', label: '2048', desc: 'Slide & merge' },
  { id: 'wordle', icon: '🟩', label: 'Wordle', desc: 'Guess the word' },
  { id: 'chess', icon: '♟️', label: 'AeroChess', desc: 'Play friends or AI' },
];

/* ── Games tile ── */
const GamesTile = memo(function GamesTile() {
  const user = useAuthStore(s => s.user);
  const installed = useMemo(() => user ? getInstalledGames(user.id) : ['bubblepop'], [user?.id]);
  const installedSet = useMemo(() => new Set(installed), [installed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Gamepad2 style={{ width: 12, height: 12, color: '#00e676' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#00e676' }}>Games</span>
        <span style={{ fontSize: 8, color: 'rgba(0,230,118,0.35)', fontWeight: 600, marginLeft: 'auto' }}>
          {installed.length}/{GAME_CATALOG.length}
        </span>
      </div>
      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 6px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,230,118,0.15) transparent' }}>
        {GAME_CATALOG.map(g => {
          const isInstalled = installedSet.has(g.id);
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 6px', borderRadius: 8, marginBottom: 2,
              background: isInstalled ? 'rgba(0,230,118,0.04)' : 'transparent',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, width: 22, textAlign: 'center' }}>{g.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: isInstalled ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.30)' }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(0,230,118,0.25)', marginTop: 1 }}>{g.desc}</div>
              </div>
              {isInstalled ? (
                <span style={{ fontSize: 7, fontWeight: 700, color: '#00e676', background: 'rgba(0,230,118,0.12)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                  PLAY
                </span>
              ) : (
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(0,230,118,0.25)', flexShrink: 0 }}>
                  GET
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ── Writers tile ── */
const WritersTile = memo(function WritersTile() {
  const stories = useWriterStore(useShallow(s => s.stories));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <PenTool style={{ width: 12, height: 12, color: '#00e676' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#00e676' }}>Writers</span>
        <span style={{ fontSize: 8, color: 'rgba(0,230,118,0.35)', fontWeight: 600, marginLeft: 'auto' }}>
          {stories.length} stories
        </span>
      </div>
      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 6px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,230,118,0.15) transparent' }}>
        {stories.length > 0 ? stories.map(s => (
          <div key={s.id} style={{
            padding: '5px 6px', borderRadius: 8, marginBottom: 3,
            background: 'rgba(0,230,118,0.03)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {s.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 8, color: 'rgba(0,230,118,0.30)' }}>
                {s.author_username ?? 'Unknown'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Heart style={{ width: 7, height: 7, color: 'rgba(0,230,118,0.25)' }} />
                <span style={{ fontSize: 7, color: 'rgba(0,230,118,0.25)' }}>{s.likes_count}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Eye style={{ width: 7, height: 7, color: 'rgba(0,230,118,0.20)' }} />
                <span style={{ fontSize: 7, color: 'rgba(0,230,118,0.20)' }}>{s.views}</span>
              </div>
            </div>
          </div>
        )) : (
          <div style={{ padding: 8, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: 'rgba(0,230,118,0.25)', fontWeight: 500 }}>
              No stories yet — tap to browse & write
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Calendar tile ── */
const CalendarTile = memo(function CalendarTile() {
  const now = new Date();
  const todayStr = toDateString(now);
  const events = useCalendarStore(useShallow(s => s.events));
  const tasks = useCalendarStore(useShallow(s => s.tasks));
  const todayEvents = useMemo(
    () => events.filter(e => toDateString(new Date(e.start_at)) === todayStr),
    [events, todayStr],
  );
  const todayTasks = useMemo(
    () => tasks.filter(t => t.date === todayStr),
    [tasks, todayStr],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Date header */}
      <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <CalendarDays style={{ width: 12, height: 12, color: '#00e676' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'rgba(0,230,118,0.60)', lineHeight: 1 }}>
            {String(now.getDate()).padStart(2, '0')}
          </span>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(0,230,118,0.40)', letterSpacing: 0.5 }}>
              {now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(0,230,118,0.28)' }}>
              {now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
      {/* Scrollable events + tasks */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,230,118,0.15) transparent' }}>
        {/* Events */}
        {todayEvents.length > 0 && (
          <>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(0,230,118,0.30)', letterSpacing: 0.5, padding: '2px 4px', textTransform: 'uppercase' }}>Events</div>
            {todayEvents.map(ev => (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px', borderRadius: 6, marginBottom: 2,
                background: 'rgba(0,230,118,0.03)',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(0,230,118,0.25)' }}>
                    {new Date(ev.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {/* Tasks */}
        {todayTasks.length > 0 && (
          <>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(0,230,118,0.30)', letterSpacing: 0.5, padding: '4px 4px 2px', textTransform: 'uppercase' }}>Tasks</div>
            {todayTasks.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px', borderRadius: 6, marginBottom: 2,
              }}>
                {t.done
                  ? <CheckCircle2 style={{ width: 9, height: 9, color: '#00e676', flexShrink: 0 }} />
                  : <Circle style={{ width: 9, height: 9, color: 'rgba(0,230,118,0.20)', flexShrink: 0 }} />
                }
                <span style={{
                  fontSize: 9, color: t.done ? 'rgba(0,230,118,0.30)' : 'rgba(255,255,255,0.45)',
                  fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {t.title}
                </span>
              </div>
            ))}
          </>
        )}
        {todayEvents.length === 0 && todayTasks.length === 0 && (
          <div style={{ padding: 8, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: 'rgba(0,230,118,0.22)' }}>No events or tasks today</span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Mini XP bar for tile ── */
const MiniXpBar = memo(function MiniXpBar({ bar, xp }: { bar: XpBar; xp: number }) {
  const { level, currentXp, nextXp } = deriveLevel(xp);
  const meta = BAR_META[bar];
  const progress = level >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.3, opacity: 0.8 }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 8, fontWeight: 800, color: meta.color }}>Lv.{level}</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${Math.max(progress, 2)}%`,
          background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
          boxShadow: `0 0 6px ${meta.color}60`,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 1, textAlign: 'right' }}>
        {level >= 100 ? 'MAX' : `${currentXp}/${nextXp}`}
      </div>
    </div>
  );
});

/* ── Avatar tile ── */
const AvatarTile = memo(function AvatarTile() {
  const user = useAuthStore(s => s.user);
  const chatterXp = useXpStore(s => s.chatter_xp);
  const gamerXp = useXpStore(s => s.gamer_xp);
  const writerXp = useXpStore(s => s.writer_xp);
  const level = deriveOverallLevel(chatterXp, gamerXp, writerXp);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Profile header */}
      <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(0,230,118,0.10)',
            border: '2px solid rgba(0,230,118,0.25)',
            boxShadow: '0 0 10px rgba(0,230,118,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,230,118,0.50)' }}>
                {(user?.username ?? '?')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 15, height: 15, borderRadius: '50%',
            background: 'rgba(0,230,118,0.22)', border: '1.5px solid rgba(0,230,118,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 800, color: '#00e676',
          }}>
            {level}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.username}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(0,230,118,0.30)', fontWeight: 600 }}>
            Level {level} Agent
          </div>
        </div>
      </div>
      {/* XP bars */}
      <div style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <MiniXpBar bar="chatter" xp={chatterXp} />
        <MiniXpBar bar="gamer" xp={gamerXp} />
        <MiniXpBar bar="writer" xp={writerXp} />
      </div>
    </div>
  );
});

/* ── Servers tile ── */
const ServersTile = memo(function ServersTile({ onServerClick }: { onServerClick: (serverId: string) => void }) {
  const servers = useServerStore(useShallow(s => s.servers));
  const serverUnreads = useServerStore(s => s.serverUnreads);
  const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);
  const isMobile = useIsMobile();

  return (
    <div style={{
      padding: isMobile ? '6px 10px' : '8px 14px',
      display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center', height: '100%',
      overflow: 'hidden',
    }}>
      <Globe style={{ width: 13, height: 13, color: 'rgba(0,230,118,0.35)', flexShrink: 0 }} />
      <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#00e676', flexShrink: 0 }}>Servers</span>
      <span style={{ fontSize: 8, color: 'rgba(0,230,118,0.30)', fontWeight: 600, flexShrink: 0 }}>
        {servers.length}
      </span>

      <div style={{ width: 1, height: 20, background: 'rgba(0,230,118,0.10)', flexShrink: 0, margin: '0 2px' }} />

      <div style={{
        display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center',
        flex: 1, minWidth: 0,
        overflowX: 'auto', overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {servers.map(s => {
          const unread = serverUnreads[s.id] ?? 0;
          const size = isMobile ? 38 : 34;
          return (
            <div
              key={s.id}
              onClick={e => { e.stopPropagation(); onServerClick(s.id); }}
              style={{
                position: 'relative',
                width: size, height: size, borderRadius: 9, flexShrink: 0,
                background: 'rgba(0,230,118,0.08)',
                border: '1px solid rgba(0,230,118,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isMobile ? 11 : 10, fontWeight: 700, color: 'rgba(0,230,118,0.45)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.08)')}
            >
              {s.name.slice(0, 2).toUpperCase()}
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  minWidth: 13, height: 13, borderRadius: '50%',
                  background: '#00e676', fontSize: 7, fontWeight: 700, color: '#050505',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {totalUnread > 0 && (
        <span style={{
          fontSize: 8, fontWeight: 700,
          background: 'rgba(0,230,118,0.22)', color: '#00e676',
          padding: '2px 6px', borderRadius: 8, flexShrink: 0,
        }}>
          {totalUnread} new
        </span>
      )}
    </div>
  );
});

/* ── Main TileGrid ── */
interface TileGridProps {
  onServersClick: (el: HTMLElement) => void;
  onServerDirectClick: (serverId: string) => void;
  onTileClick: (tile: 'games' | 'writers' | 'calendar' | 'avatar') => void;
  onSettingsClick?: () => void;
  onBellClick?: () => void;
  serversRef: React.MutableRefObject<HTMLElement | null>;
  visible: boolean;
}

export const TileGrid = memo(function TileGrid({ onServersClick, onServerDirectClick, onTileClick, onSettingsClick, onBellClick, serversRef, visible }: TileGridProps) {
  const setServersRef = useCallback((el: HTMLDivElement | null) => { serversRef.current = el; }, [serversRef]);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '0 10px 10px',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Home tile — full width */}
        <HomePanel onSettingsClick={onSettingsClick} onBellClick={onBellClick} isMobile />

        {/* 2x2 small tiles */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          flexShrink: 0,
        }}>
          <ParallaxTile onClick={() => onTileClick('games')} style={{ minHeight: 140 }}><GamesTile /></ParallaxTile>
          <ParallaxTile onClick={() => onTileClick('writers')} style={{ minHeight: 140 }}><WritersTile /></ParallaxTile>
          <ParallaxTile onClick={() => onTileClick('calendar')} style={{ minHeight: 140 }}><CalendarTile /></ParallaxTile>
          <ParallaxTile onClick={() => onTileClick('avatar')} style={{ minHeight: 140 }}><AvatarTile /></ParallaxTile>
        </div>

        {/* Servers bar */}
        <ParallaxTile
          ref={setServersRef}
          onClick={() => serversRef.current && onServersClick(serversRef.current)}
          style={{ height: 56, flexShrink: 0 }}
          maxRotate={1}
        >
          <ServersTile onServerClick={onServerDirectClick} />
        </ParallaxTile>
      </div>
    );
  }

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
        <HomePanel onSettingsClick={onSettingsClick} onBellClick={onBellClick} />
        <ParallaxTile onClick={() => onTileClick('games')}><GamesTile /></ParallaxTile>
        <ParallaxTile onClick={() => onTileClick('writers')}><WritersTile /></ParallaxTile>
        <ParallaxTile onClick={() => onTileClick('calendar')}><CalendarTile /></ParallaxTile>
        <ParallaxTile onClick={() => onTileClick('avatar')}><AvatarTile /></ParallaxTile>
      </div>

      {/* Servers wide bar — tile click opens overlay, individual icons go direct */}
      <ParallaxTile
        ref={setServersRef}
        onClick={() => serversRef.current && onServersClick(serversRef.current)}
        style={{ height: 62, flexShrink: 0 }}
        maxRotate={1}
      >
        <ServersTile onServerClick={onServerDirectClick} />
      </ParallaxTile>
    </div>
  );
});
