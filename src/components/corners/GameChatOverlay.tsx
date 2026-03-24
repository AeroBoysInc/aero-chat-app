import { useCornerStore } from '../../store/cornerStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useFriendStore } from '../../store/friendStore';
import { ChatWindow } from '../chat/ChatWindow';
import { X, ArrowLeft } from 'lucide-react';
import type { Profile } from '../../store/authStore';

export function GameChatOverlay() {
  const { gameChatOverlay, openGameChat, openGameChatFor, closeGameChat } = useCornerStore();
  const { counts } = useUnreadStore();
  const { friends } = useFriendStore();

  const isOpen = gameChatOverlay !== null;

  // Build sender list from unread counts
  const senders = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const friend = friends.find(f => f.id === id);
      return { id, count: n, username: friend?.username ?? '?', avatar_url: friend?.avatar_url ?? null, status: friend?.status ?? 'offline' };
    });

  // Resolve the contact for conversation mode
  const contact: Profile | null =
    gameChatOverlay?.mode === 'conversation'
      ? (friends.find(f => f.id === gameChatOverlay.senderId) as Profile) ?? null
      : null;

  const handleBack = () => {
    // If there were multiple senders, go back to picker; otherwise close
    if (senders.length > 1) {
      openGameChat();
    } else {
      closeGameChat();
    }
  };

  return (
    <>
      {/* Pause dim layer — covers entire game area */}
      <div
        onClick={closeGameChat}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      >
        <p
          style={{
            fontSize: 32,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 6,
            color: 'rgba(255,255,255,0.55)',
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            userSelect: 'none',
          }}
        >
          Paused
        </p>
      </div>

      {/* Chat overlay panel — slides in from right */}
      <div
        onKeyDown={e => e.stopPropagation()}
        onKeyUp={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '38%',
          minWidth: 320,
          zIndex: 20,
          transform: isOpen ? 'translateX(0)' : 'translateX(102%)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sidebar-bg)',
          borderLeft: '1px solid var(--sidebar-border)',
          boxShadow: '-4px 0 24px rgba(0,180,255,0.12), var(--sidebar-shadow)',
          borderRadius: '16px 0 0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--panel-divider)' }}
        >
          {gameChatOverlay?.mode === 'conversation' && (
            <button
              onClick={handleBack}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {gameChatOverlay?.mode === 'conversation' && contact
                ? contact.username
                : 'Messages'}
            </p>
          </div>

          <button
            onClick={closeGameChat}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {gameChatOverlay?.mode === 'picker' && (
            <div className="flex flex-col h-full">
              {senders.length === 0 ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <p className="text-sm">No new messages</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-aero">
                  {senders.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openGameChatFor(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{ borderBottom: '1px solid var(--panel-divider)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `hsl(${(s.username.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
                          border: '1.5px solid rgba(255,255,255,0.35)',
                          fontSize: 14, fontWeight: 700, color: '#fff',
                        }}
                      >
                        {s.username[0].toUpperCase()}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {s.username}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {s.count} new {s.count === 1 ? 'message' : 'messages'}
                        </p>
                      </div>

                      {/* Badge */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{
                          minWidth: 22, height: 22, padding: '0 6px',
                          background: '#ff4757', fontSize: 11, fontWeight: 800, color: '#fff',
                        }}
                      >
                        {s.count > 99 ? '99+' : s.count}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {gameChatOverlay?.mode === 'conversation' && contact && (
            <ChatWindow contact={contact} onBack={handleBack} />
          )}
        </div>
      </div>
    </>
  );
}
