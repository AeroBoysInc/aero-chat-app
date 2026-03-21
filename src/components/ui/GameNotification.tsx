import { createPortal } from 'react-dom';
import { useCornerStore } from '../../store/cornerStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useFriendStore } from '../../store/friendStore';

export function GameNotification() {
  const { gameViewActive, closeGameView } = useCornerStore();
  const { counts } = useUnreadStore();
  const { friends } = useFriendStore();

  const totalUnread = Object.values(counts).reduce((s, n) => s + n, 0);

  if (!gameViewActive || totalUnread === 0) return null;

  // Build sender list for display
  const senders = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const friend = friends.find(f => f.id === id);
      return { id, count: n, username: friend?.username ?? '?' };
    });

  const label = senders.length === 1
    ? senders[0].username
    : `${senders.length} chats`;

  return createPortal(
    <button
      key={totalUnread} // re-triggers entry animation on new messages
      onClick={closeGameView}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px 10px 12px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.55)',
        background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.25) 0%, rgba(0,180,255,0.20) 35%, rgba(0,100,220,0.14) 70%, rgba(0,60,180,0.08) 100%)',
        boxShadow: '0 0 24px rgba(0,180,255,0.45), inset 0 0 14px rgba(255,255,255,0.20)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        animation: 'bubble-notify-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, bubble-notify-pulse 2.2s 0.5s ease-in-out infinite',
        outline: 'none',
      }}
    >
      {/* Glass highlight spot */}
      <div style={{
        position: 'absolute', top: '12%', left: '8%',
        width: '26%', height: '36%',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.55)',
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />

      {/* Avatar initials */}
      <div style={{ position: 'relative', flexShrink: 0, width: 32, height: 32 }}>
        {senders.slice(0, 2).map((s, i) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              top: i * 5, left: i * 5,
              width: 26 - i * 4, height: 26 - i * 4,
              borderRadius: '50%',
              background: `hsl(${(s.username.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
              border: '1.5px solid rgba(255,255,255,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11 - i, fontWeight: 700, color: '#fff',
              zIndex: 2 - i,
            }}
          >
            {s.username[0].toUpperCase()}
          </div>
        ))}
      </div>

      {/* Text */}
      <div style={{ lineHeight: 1.3, position: 'relative' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
          {totalUnread} new {totalUnread === 1 ? 'message' : 'messages'} · click to view
        </p>
      </div>

      {/* Red badge */}
      <div style={{
        position: 'absolute', top: -5, right: -5,
        minWidth: 19, height: 19,
        borderRadius: 10,
        background: '#ff4757',
        border: '2px solid #020d1e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, color: '#fff',
        padding: '0 4px',
      }}>
        {totalUnread > 99 ? '99+' : totalUnread}
      </div>
    </button>,
    document.body
  );
}
