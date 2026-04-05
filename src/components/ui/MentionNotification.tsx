// src/components/ui/MentionNotification.tsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useServerStore } from '../../store/serverStore';
import { useCornerStore } from '../../store/cornerStore';

interface MentionEvent {
  senderUsername: string;
  bubbleName: string;
  serverName: string;
  content: string;
  serverId?: string;
  bubbleId?: string;
}

export function MentionNotification() {
  const [mention, setMention] = useState<MentionEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const servers = useServerStore(s => s.servers);
  const selectServer = useServerStore(s => s.selectServer);
  const selectBubble = useServerStore(s => s.selectBubble);
  const loadServerData = useServerStore(s => s.loadServerData);
  const enterBubble = useCornerStore(s => s.enterBubble);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<MentionEvent>).detail;
      const serverName = detail.serverName ||
        servers.find(s => s.id === detail.serverId)?.name || 'a server';
      setMention({ ...detail, serverName });
      setVisible(true);
    }
    window.addEventListener('aero:mention', handler);
    return () => window.removeEventListener('aero:mention', handler);
  }, [servers]);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [visible]);

  const handleClick = useCallback(() => {
    setVisible(false);
    if (mention?.serverId) {
      selectServer(mention.serverId);
      loadServerData(mention.serverId).then(() => {
        if (mention.bubbleId) {
          selectBubble(mention.bubbleId);
          enterBubble();
        }
      });
    }
  }, [mention, selectServer, selectBubble, loadServerData, enterBubble]);

  if (!visible || !mention) return null;

  return createPortal(
    <button
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 99998,
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
        maxWidth: 340,
        textAlign: 'left',
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

      {/* @ icon */}
      <div style={{
        position: 'relative',
        flexShrink: 0,
        width: 32, height: 32,
        borderRadius: '50%',
        background: 'rgba(0,212,255,0.25)',
        border: '1.5px solid rgba(255,255,255,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 800, color: '#00d4ff',
      }}>
        @
      </div>

      {/* Text */}
      <div style={{ lineHeight: 1.3, position: 'relative', minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {mention.senderUsername} mentioned you
        </p>
        <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {mention.serverName} · #{mention.bubbleName}
        </p>
      </div>

      {/* Badge */}
      <div style={{
        position: 'absolute', top: -5, right: -5,
        width: 19, height: 19,
        borderRadius: 10,
        background: '#00d4ff',
        border: '2px solid #020d1e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, color: '#fff',
      }}>
        @
      </div>
    </button>,
    document.body
  );
}
