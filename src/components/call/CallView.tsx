import { useState, useRef, useCallback, useEffect } from 'react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { CameraFeed } from './CameraFeed';
import { CallControls } from './CallControls';
import { IncomingCallModal } from './IncomingCallModal';
import { AddToCallModal } from './AddToCallModal';
import { ChatWindow } from '../chat/ChatWindow';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { Phone, Video, Monitor, MicOff } from 'lucide-react';
import type { Profile } from '../../store/authStore';

/** Formats elapsed seconds as M:SS */
function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Builds a CSS background for a participant panel from their Profile card settings */
function panelBackground(profile: Profile | null): React.CSSProperties {
  if (!profile) return { background: 'linear-gradient(180deg, #1a8fff40 0%, #1a8fff18 40%, rgba(6,14,31,0.95) 100%)' };
  if (profile.card_image_url) {
    return {
      backgroundImage: `url(${profile.card_image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: `${profile.card_image_params?.x ?? 50}% ${profile.card_image_params?.y ?? 50}%`,
    };
  }
  const preset = CARD_GRADIENTS.find(g => g.id === (profile.card_gradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
  return {
    background: `linear-gradient(180deg, ${preset.preview}40 0%, ${preset.preview}18 40%, rgba(6,14,31,0.95) 100%)`,
  };
}

export function CallView() {
  const {
    status,
    contact,
    callType,
    localStream,
    remoteStream,
    screenStream,
    contactIsSharing,
    isScreenSharing,
    contactIsRinging,
    isCaller,
    isMuted,
    callStartedAt,
    hangUp,
  } = useCallStore();

  const user = useAuthStore(s => s.user);

  const [chatOpen, setChatOpen] = useState(false);
  const [showAddToCall, setShowAddToCall] = useState(false);
  const [duration, setDuration] = useState('0:00');

  // Hidden audio output for audio-only calls
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

  // ── Audio level visualizer ───────────────────────────────────────────
  const [localLevel, setLocalLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0) { setLocalLevel(0); return; }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(localStream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setLocalLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 255);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(rafId); ctx.close().catch(() => {}); setLocalLevel(0); };
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) { setRemoteLevel(0); return; }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(remoteStream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setRemoteLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 255);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(rafId); ctx.close().catch(() => {}); setRemoteLevel(0); };
  }, [remoteStream]);

  // ── PiP drag state (for video calls) ────────────────────────────────
  const pipRef = useRef<HTMLDivElement>(null);
  const pipPos = useRef({ x: 16, y: 16 });
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
  const showRemoteScreen = isConnected && contactIsSharing;
  const showOwnScreen = isConnected && isScreenSharing;
  const isVideoOrScreen = callType === 'video' || showRemoteScreen || showOwnScreen;

  const localSpeaking = localLevel > 0.04;
  const remoteSpeaking = remoteLevel > 0.04;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      background: '#060e1f',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Hidden audio output */}
      {callType === 'audio' && <audio ref={audioRef} autoPlay style={{ display: 'none' }} />}

      {/* ── Main call area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>

        {/* Incoming call overlay */}
        {isIncomingRinging && <IncomingCallModal />}

        {/* Outgoing call — "Calling..." / "Ringing..." */}
        {isOutgoingCalling && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5,
            background: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
              border: '2.5px solid rgba(0,200,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-ring 2s ease infinite',
            }}>
              {callType === 'video'
                ? <Video className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} />
                : <Phone className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{contact?.username}</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                {isCaller && contactIsRinging ? 'Ringing…' : 'Calling…'}
              </p>
            </div>
            <button
              onClick={hangUp}
              style={{
                marginTop: 16, width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(220,50,50,0.85)', border: 'none', color: 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Phone className="h-5 w-5" style={{ transform: 'rotate(135deg)' }} />
            </button>
          </div>
        )}

        {/* ── Connected state ── */}
        {isConnected && (
          <>
            {isVideoOrScreen ? (
              /* ── Video / Screen share — keep existing full-frame layout ── */
              <>
                <div style={{ flex: 1, position: 'relative' }}>
                  <CameraFeed
                    stream={remoteStream}
                    style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }}
                  />

                  {(showRemoteScreen || showOwnScreen) && (
                    <div style={{
                      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                      background: 'rgba(220,50,50,0.75)', border: '1px solid rgba(220,50,50,0.9)',
                      borderRadius: 20, backdropFilter: 'blur(8px)', fontSize: 12, color: 'white', fontWeight: 600, zIndex: 10,
                    }}>
                      <Monitor className="h-3 w-3" />
                      {showOwnScreen ? 'You are sharing' : `${contact?.username} is sharing`}
                    </div>
                  )}

                  <div style={{
                    position: 'absolute', top: 16, right: 16, fontFamily: 'monospace', fontSize: 13,
                    color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 8, zIndex: 10,
                  }}>
                    {duration}
                  </div>

                  <div ref={pipRef} onMouseDown={onPipMouseDown} style={{
                    position: 'absolute', bottom: `${pipPos.current.y}px`, right: `${pipPos.current.x}px`,
                    width: 120, height: 90, cursor: 'grab', zIndex: 15, borderRadius: 10,
                    boxShadow: localSpeaking
                      ? `0 0 ${8 + localLevel * 18}px rgba(0,220,120,0.7), 0 0 0 2px rgba(0,220,120,0.5)`
                      : '0 2px 12px rgba(0,0,0,0.4)',
                    transition: 'box-shadow 0.1s ease',
                  }}>
                    <CameraFeed
                      stream={isScreenSharing ? screenStream : localStream}
                      muted
                      style={{ width: '100%', height: '100%' }}
                      label={isScreenSharing ? 'Screen' : 'Camera off'}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* ── Audio-only — 50/50 vertical split with card backgrounds ── */
              <>
                {/* My panel (left) */}
                <SplitPanel
                  profile={user}
                  username={user?.username ?? 'You'}
                  avatarUrl={user?.avatar_url ?? null}
                  isSpeaking={localSpeaking}
                  audioLevel={localLevel}
                  isMuted={isMuted}
                  isMe
                />

                {/* Divider */}
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

                {/* Contact panel (right) */}
                <SplitPanel
                  profile={contact}
                  username={contact?.username ?? ''}
                  avatarUrl={contact?.avatar_url ?? null}
                  isSpeaking={remoteSpeaking}
                  audioLevel={remoteLevel}
                  isMuted={false}
                  isMe={false}
                />

                {/* Floating duration */}
                <div style={{
                  position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)',
                  padding: '3px 12px', borderRadius: 10, zIndex: 10,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {duration}
                </div>
              </>
            )}

            {/* Controls bar — always shown for connected state */}
            <CallControls
              onToggleChat={() => setChatOpen(o => !o)}
              chatOpen={chatOpen}
              onAddPerson={status === 'connected' ? () => setShowAddToCall(true) : undefined}
            />
          </>
        )}
      </div>

      {/* ── Chat side panel ── */}
      <div style={{
        width: chatOpen ? 572 : 0, flexShrink: 0, overflow: 'hidden',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: chatOpen ? '1px solid rgba(0,200,255,0.18)' : 'none',
        background: 'rgba(4, 10, 28, 0.95)',
      }}>
        {contact && chatOpen && <ChatWindow contact={contact} />}
      </div>

      {showAddToCall && <AddToCallModal onClose={() => setShowAddToCall(false)} />}

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

/* ── Split Panel — one half of the 1:1 audio call view ──────────────── */

function SplitPanel({
  profile, username, avatarUrl, isSpeaking, audioLevel, isMuted, isMe,
}: {
  profile: Profile | null;
  username: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  isMe: boolean;
}) {
  const statusLabel = isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Listening';
  const statusColor = isMuted ? 'rgba(239,68,68,0.60)' : isSpeaking ? '#00d4ff' : 'rgba(255,255,255,0.35)';

  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Card background — blurred to mask low-res data-URL source and create atmosphere */}
      <div style={{ position: 'absolute', inset: -20, ...panelBackground(profile), opacity: 0.85, filter: 'blur(12px)', transform: 'scale(1.05)' }} />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
      }} />

      {/* Speaking glow */}
      {isSpeaking && (
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 60px rgba(0,212,255,0.08)', pointerEvents: 'none' }} />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Avatar with speaking ring */}
        <div style={{ position: 'relative' }}>
          {isSpeaking && (
            <div style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: '2.5px solid rgba(0,212,255,0.55)',
              boxShadow: '0 0 18px rgba(0,212,255,0.40), 0 0 36px rgba(0,212,255,0.15)',
              animation: 'aura-pulse 2.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <div style={{ width: 80, height: 80 }}>
            <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
          </div>
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(6,14,31,0.8)',
            }}>
              <MicOff className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <span className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>{username}</span>
          {isMe && (
            <span className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5"
              style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
          )}
        </div>

        {/* Status */}
        <span className="text-[11px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>

        {/* Audio bars */}
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + (isMuted ? 0 : audioLevel) * 20);
            const barHeight = isSpeaking && !isMuted ? Math.max(4, 24 * audioLevel * variance) : 4;
            return (
              <div
                key={i}
                style={{
                  width: 3, height: barHeight, borderRadius: 2,
                  background: isSpeaking && !isMuted ? `rgba(0,212,255,${0.4 + audioLevel * 0.3})` : 'rgba(255,255,255,0.08)',
                  transition: 'height 0.1s ease-out',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
