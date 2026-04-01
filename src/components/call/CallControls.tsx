import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff, UserPlus } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

interface CallControlsProps {
  onToggleChat: () => void;
  chatOpen: boolean;
  onAddPerson?: () => void;
}

export function CallControls({ onToggleChat, chatOpen, onAddPerson }: CallControlsProps) {
  const { isMuted, isCameraOn, isScreenSharing, callType, toggleMute, toggleCamera, startScreenShare, stopScreenShare, hangUp } = useCallStore();
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    window.addEventListener('mousemove', resetHideTimer);
    return () => {
      window.removeEventListener('mousemove', resetHideTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  const btnBase: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: `translateX(-50%)`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 20,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'rgba(4, 12, 35, 0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 40,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>

        {/* Mute */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            ...btnBase,
            background: isMuted ? 'rgba(255,160,0,0.3)' : 'rgba(255,255,255,0.1)',
            border: isMuted ? '1px solid rgba(255,160,0,0.6)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {/* Camera — only shown for video calls */}
        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            style={{ ...btnBase }}
          >
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
        )}

        {/* Screen share */}
        <button
          onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          style={{
            ...btnBase,
            background: isScreenSharing ? 'rgba(220,50,50,0.4)' : 'rgba(255,255,255,0.1)',
            border: isScreenSharing ? '1px solid rgba(220,50,50,0.7)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <Monitor className="h-4 w-4" />
        </button>

        {/* Add person (escalate to group) */}
        {onAddPerson && (
          <button
            onClick={onAddPerson}
            title="Add person to call"
            style={btnBase}
          >
            <UserPlus className="h-4 w-4" />
          </button>
        )}

        {/* Chat */}
        <button
          onClick={onToggleChat}
          title="Chat"
          style={{
            ...btnBase,
            background: chatOpen ? 'rgba(0,180,255,0.25)' : 'rgba(255,255,255,0.1)',
            border: chatOpen ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Hang up */}
        <button
          onClick={hangUp}
          title="End call"
          style={{
            ...btnBase,
            width: 48,
            borderRadius: 20,
            background: 'rgba(220,50,50,0.85)',
            border: '1px solid rgba(220,50,50,0.9)',
          }}
        >
          <PhoneOff className="h-4 w-4" />
        </button>

      </div>
    </div>
  );
}
