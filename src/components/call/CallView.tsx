import { useState, useRef, useCallback, useEffect } from 'react';
import { useCallStore } from '../../store/callStore';
import { CameraFeed } from './CameraFeed';
import { CallControls } from './CallControls';
import { IncomingCallModal } from './IncomingCallModal';
import { ChatWindow } from '../chat/ChatWindow';
import { Phone, Video, Monitor } from 'lucide-react';

/** Formats elapsed seconds as M:SS */
function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CallView() {
  const {
    status,
    contact,
    callType,
    localStream,
    remoteStream,
    contactIsSharing,
    isScreenSharing,
    contactIsRinging,
    isCaller,
    callStartedAt,
    hangUp,
  } = useCallStore();

  const [chatOpen, setChatOpen] = useState(false);
  const [duration, setDuration] = useState('0:00');

  // Hidden audio output for audio-only calls — video calls are handled by
  // the CameraFeed <video> element which plays both video and audio.
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    el.play().catch(() => {});
  }, [remoteStream]);

  // Duration timer
  useEffect(() => {
    if (status !== 'connected' || !callStartedAt) { setDuration('0:00'); return; }
    setDuration(formatDuration(callStartedAt));
    const id = setInterval(() => setDuration(formatDuration(callStartedAt!)), 1000);
    return () => clearInterval(id);
  }, [status, callStartedAt]);

  // Close chat panel when call ends
  useEffect(() => {
    if (status === 'idle') setChatOpen(false);
  }, [status]);

  // ── PiP drag state ───────────────────────────────────────────────────
  const pipRef = useRef<HTMLDivElement>(null);
  const pipPos = useRef({ x: 16, y: 16 }); // offsets from bottom-right
  const draggingPip = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onPipMouseDown = useCallback((e: React.MouseEvent) => {
    draggingPip.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pipPos.current.x, py: pipPos.current.y };
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingPip.current || !pipRef.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      pipPos.current = {
        x: Math.max(8, dragStart.current.px - dx),
        y: Math.max(8, dragStart.current.py - dy),
      };
      pipRef.current.style.right = `${pipPos.current.x}px`;
      pipRef.current.style.bottom = `${pipPos.current.y}px`;
    };
    const onUp = () => {
      draggingPip.current = false;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (status === 'idle') return null;

  const isConnected = status === 'connected';
  const isIncomingRinging = status === 'ringing';
  const isOutgoingCalling = status === 'calling';

  // What fills the main view area (left of chat panel)
  const showRemoteScreen = isConnected && contactIsSharing;
  const showOwnScreen = isConnected && isScreenSharing;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      background: 'rgba(2, 6, 22, 0.97)',
      borderRadius: 16,
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.3s ease',
    }}>

      {/* Hidden audio output — plays remote audio for audio-only calls.
          Video calls use the CameraFeed <video> element for both video + audio. */}
      {callType === 'audio' && <audio ref={audioRef} autoPlay style={{ display: 'none' }} />}

      {/* ── Main call area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Incoming call overlay */}
        {isIncomingRinging && <IncomingCallModal />}

        {/* Outgoing call — "Calling..." / "Ringing..." */}
        {isOutgoingCalling && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
          }}>
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
              border: '2.5px solid rgba(0,200,255,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse-ring 2s ease infinite',
            }}>
              {callType === 'video' ? <Video className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} /> : <Phone className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {contact?.username}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                {isCaller && contactIsRinging ? 'Ringing…' : 'Calling…'}
              </p>
            </div>
            {/* Hang up while calling */}
            <button
              onClick={hangUp}
              style={{
                marginTop: 16,
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(220,50,50,0.85)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone className="h-5 w-5" style={{ transform: 'rotate(135deg)' }} />
            </button>
          </div>
        )}

        {/* Connected — main video area */}
        {isConnected && (
          <>
            {/* Remote video or screen fill */}
            {showRemoteScreen || showOwnScreen || callType === 'video' ? (
              <CameraFeed
                stream={remoteStream}
                style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }}
              />
            ) : (
              // Audio-only — avatar in center
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
              }}>
                <div style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
                  border: '2.5px solid rgba(0,200,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 700,
                  color: 'rgba(0,200,255,0.8)',
                }}>
                  {contact?.username?.[0]?.toUpperCase()}
                </div>
              </div>
            )}

            {/* Screen sharing pill */}
            {(showRemoteScreen || showOwnScreen) && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'rgba(220,50,50,0.75)',
                border: '1px solid rgba(220,50,50,0.9)',
                borderRadius: 20,
                backdropFilter: 'blur(8px)',
                fontSize: 12,
                color: 'white',
                fontWeight: 600,
                zIndex: 10,
              }}>
                <Monitor className="h-3 w-3" />
                {showOwnScreen ? 'You are sharing' : `${contact?.username} is sharing`}
              </div>
            )}

            {/* Duration timer — top right */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              fontFamily: 'monospace',
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(0,0,0,0.4)',
              padding: '2px 8px',
              borderRadius: 8,
              zIndex: 10,
            }}>
              {duration}
            </div>

            {/* Self-camera PiP — draggable, bottom-right */}
            <div
              ref={pipRef}
              onMouseDown={onPipMouseDown}
              style={{
                position: 'absolute',
                bottom: `${pipPos.current.y}px`,
                right: `${pipPos.current.x}px`,
                width: 120,
                height: 90,
                cursor: 'grab',
                zIndex: 15,
              }}
            >
              <CameraFeed
                stream={localStream}
                muted
                style={{ width: '100%', height: '100%' }}
                label="Camera off"
              />
            </div>

            {/* Controls bar */}
            <CallControls onToggleChat={() => setChatOpen(o => !o)} chatOpen={chatOpen} />
          </>
        )}
      </div>

      {/* ── Chat side panel ── */}
      <div style={{
        width: chatOpen ? 572 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: chatOpen ? '1px solid rgba(0,200,255,0.18)' : 'none',
        background: 'rgba(4, 10, 28, 0.95)',
      }}>
        {contact && chatOpen && (
          <ChatWindow contact={contact} />
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0   rgba(0,200,255,0.4); }
          70%  { box-shadow: 0 0 0 20px rgba(0,200,255,0); }
          100% { box-shadow: 0 0 0 0   rgba(0,200,255,0); }
        }
      `}</style>
    </div>
  );
}
