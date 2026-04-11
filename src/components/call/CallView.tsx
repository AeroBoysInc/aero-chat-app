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
import { useAudioStore } from '../../store/audioStore';
import { Phone, Video, Monitor, MicOff, Mic, PhoneOff, MessageSquare } from 'lucide-react';
import { useIsMobile } from '../../lib/useIsMobile';
import type { Profile } from '../../store/authStore';
import { getCallTier, getTierPalette, type TierPalette, type AudioBarConfig } from '../../lib/callTierVisuals';
import { useThemeStore } from '../../store/themeStore';

/** Formats elapsed seconds as M:SS */
function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Builds a CSS background for a participant panel from their Profile card settings */
function panelBackground(profile: Profile | null, palette: TierPalette): React.CSSProperties {
  if (palette.tier === 'free') {
    return { background: palette.bg };
  }
  if (palette.tier === 'premium') {
    if (!profile) return { background: palette.bg };
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
  return { background: palette.bg };
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
    contactIsMuted,
    isCaller,
    isMuted,
    isCameraOn,
    callStartedAt,
    hangUp,
    toggleMute,
    toggleCamera,
  } = useCallStore();

  const user = useAuthStore(s => s.user);
  const activeTheme = useThemeStore(s => s.theme);
  const myTier = getCallTier(user, activeTheme);
  const myPalette = getTierPalette(myTier);

  const chatPosition = useAudioStore(s => s.chatPosition);
  const chatSizeRight = useAudioStore(s => s.chatSizeRight);
  const chatSizeBottom = useAudioStore(s => s.chatSizeBottom);

  const isMobile = useIsMobile();
  const [mobileChatMode, setMobileChatMode] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAddToCall, setShowAddToCall] = useState(false);
  const [duration, setDuration] = useState('0:00');

  // Hidden audio output for calls
  const audioRef = useRef<HTMLAudioElement>(null);
  const outputDeviceId = useAudioStore(s => s.outputDeviceId);
  const outputVolume = useAudioStore(s => s.outputVolume);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    el.play().catch(() => {});
  }, [remoteStream]);

  // Apply output device selection
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !outputDeviceId) return;
    if ('setSinkId' in el) {
      (el as any).setSinkId(outputDeviceId).catch(() => {});
    }
  }, [outputDeviceId, remoteStream]);

  // Apply output volume
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = outputVolume / 100;
  }, [outputVolume]);

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

  // Track when remote audio tracks arrive (same-ref object won't re-trigger effects)
  const [remoteTrackCount, setRemoteTrackCount] = useState(0);
  useEffect(() => {
    if (!remoteStream) return;
    const update = () => setRemoteTrackCount(remoteStream.getAudioTracks().length);
    update();
    remoteStream.addEventListener('addtrack', update);
    remoteStream.addEventListener('removetrack', update);
    return () => {
      remoteStream.removeEventListener('addtrack', update);
      remoteStream.removeEventListener('removetrack', update);
    };
  }, [remoteStream]);

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
  }, [remoteStream, remoteTrackCount]);

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

  // ── Chat panel resize drag ─────────────────────────────────────────
  const resizing = useRef(false);
  const resizeStart = useRef({ mouse: 0, size: 0 });

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const isBot = useAudioStore.getState().chatPosition === 'bottom';
    const currentSize = isBot ? useAudioStore.getState().chatSizeBottom : useAudioStore.getState().chatSizeRight;
    resizeStart.current = { mouse: isBot ? e.clientY : e.clientX, size: currentSize };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isBot ? 'row-resize' : 'col-resize';

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const isB = useAudioStore.getState().chatPosition === 'bottom';
      const delta = resizeStart.current.mouse - (isB ? ev.clientY : ev.clientX);
      const next = Math.round(resizeStart.current.size + delta);
      if (isB) {
        useAudioStore.getState().set({ chatSizeBottom: Math.max(200, Math.min(600, next)) });
      } else {
        useAudioStore.getState().set({ chatSizeRight: Math.max(320, Math.min(800, next)) });
      }
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (status === 'idle') return null;

  /* ── Mobile render path ── */
  if (isMobile) {
    // Mini widget + chat mode
    if (mobileChatMode && status === 'connected' && contact) {
      return (
        <div className="h-dvh flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
          {/* Mini call bar — tap to return to full-screen */}
          <button
            onClick={() => setMobileChatMode(false)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0,80,200,0.2), rgba(0,40,100,0.3))',
              borderBottom: '1px solid rgba(0,212,255,0.1)',
              color: '#fff', width: '100%',
            }}
          >
            <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{contact.username}</div>
              <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.5)' }}>{duration}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); hangUp(); }}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.5)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </button>
          </button>
          {/* Chat below */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatWindow contact={contact} />
          </div>
          <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
        </div>
      );
    }

    // Full-screen call view
    return (
      <div className="h-dvh safe-bottom flex flex-col" style={{ background: 'rgba(6,14,31,0.98)' }}>
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
        {/* Ringing state */}
        {status === 'ringing' && <IncomingCallModal />}
        {/* Connected state */}
        {status === 'connected' && (
          <>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {/* PiP self-view */}
              {localStream && callType === 'video' && (
                <div style={{ position: 'absolute', top: 12, right: 12, width: 56, height: 72, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.15)', zIndex: 5 }}>
                  <CameraFeed stream={localStream} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              {/* Remote video or avatar */}
              {remoteStream && callType === 'video' ? (
                <CameraFeed stream={remoteStream} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <div style={{ width: 88, height: 88 }}>
                    <AvatarImage username={contact?.username ?? ''} avatarUrl={contact?.avatar_url} size="xl" />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 14 }}>{contact?.username}</p>
                  <p style={{ fontSize: 12, color: 'rgba(0,212,255,0.5)', marginTop: 4, fontFamily: 'monospace' }}>{duration}</p>
                </>
              )}
            </div>
            {/* Controls bar */}
            <div style={{
              flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 14,
              padding: '16px 20px 20px', alignItems: 'center',
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
            }}>
              <button onClick={toggleMute} style={{
                width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                background: isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button onClick={toggleCamera} style={{
                width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                background: isCameraOn ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <Video className="h-4 w-4" />
              </button>
              {/* Chat toggle */}
              {contact && (
                <button onClick={() => setMobileChatMode(true)} style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.15)',
                  color: 'rgba(0,212,255,0.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <MessageSquare className="h-4 w-4" />
                </button>
              )}
              <button onClick={hangUp} style={{
                width: 48, height: 48, borderRadius: '50%', border: 'none',
                background: 'rgba(239,68,68,0.7)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 0 15px rgba(239,68,68,0.3)',
              }}>
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
        {/* Calling state */}
        {status === 'calling' && contact && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>Calling...</p>
            <div style={{ width: 80, height: 80 }}>
              <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="xl" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 12 }}>{contact.username}</p>
            <button onClick={hangUp} style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none', marginTop: 40,
              background: 'rgba(239,68,68,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const isConnected = status === 'connected';
  const isIncomingRinging = status === 'ringing';
  const isOutgoingCalling = status === 'calling';
  const showRemoteScreen = isConnected && contactIsSharing;
  const showOwnScreen = isConnected && isScreenSharing;
  const isVideoOrScreen = callType === 'video' || showRemoteScreen || showOwnScreen;

  const localSpeaking = localLevel > 0.04;
  const remoteSpeaking = remoteLevel > 0.04;

  const isBottom = chatPosition === 'bottom';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: isBottom ? 'column' : 'row',
      background: '#060e1f',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Hidden audio output — always rendered so setSinkId + volume work for all call types */}
      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

      {/* ── Main call area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>

        {/* Incoming call overlay */}
        {isIncomingRinging && <IncomingCallModal />}

        {/* Outgoing call — "Calling..." / "Ringing..." */}
        {isOutgoingCalling && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5,
            background: myPalette.ringingBg,
          }}>
            {/* Ambient effects for ringing screen */}
            <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              {myPalette.orbs.map((orb, i) => (
                <div key={`ring-orb-${i}`} style={{
                  position: 'absolute',
                  width: orb.width, height: orb.height,
                  borderRadius: '50%',
                  background: orb.background,
                  filter: `blur(${orb.blur}px)`,
                  top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
                  pointerEvents: 'none',
                }} />
              ))}
              {myPalette.particles.map((p, i) => (
                <div key={`ring-particle-${i}`} style={{
                  position: 'absolute',
                  width: p.size, height: p.size,
                  borderRadius: '50%',
                  background: p.color,
                  boxShadow: p.glow,
                  top: p.top, left: p.left,
                  animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
                  pointerEvents: 'none',
                }} />
              ))}
            </div>

            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
              border: myPalette.ringingRingColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-ring 2s ease infinite',
              boxShadow: myPalette.ringingRingGlow,
              position: 'relative', zIndex: 1,
            }}>
              {callType === 'video'
                ? <Video className="h-10 w-10" style={{ color: myPalette.ringingIconColor }} />
                : <Phone className="h-10 w-10" style={{ color: myPalette.ringingIconColor }} />}
            </div>
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
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
                position: 'relative', zIndex: 1,
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

                  {myPalette.cornerAccents.map((accent, i) => {
                    const pos: React.CSSProperties = {};
                    if (accent.position.includes('top')) pos.top = 0;
                    if (accent.position.includes('bottom')) pos.bottom = 0;
                    if (accent.position.includes('left')) pos.left = 0;
                    if (accent.position.includes('right')) pos.right = 0;
                    return (
                      <div key={i} style={{
                        position: 'absolute', ...pos,
                        width: accent.size, height: accent.size,
                        background: `radial-gradient(circle at ${accent.position.replace('-', ' ')}, ${accent.color} 0%, transparent 70%)`,
                        pointerEvents: 'none', zIndex: 5,
                      }} />
                    );
                  })}

                  <div ref={pipRef} onMouseDown={onPipMouseDown} style={{
                    position: 'absolute', bottom: `${pipPos.current.y}px`, right: `${pipPos.current.x}px`,
                    width: 120, height: 90, cursor: 'grab', zIndex: 15, borderRadius: 10,
                    boxShadow: localSpeaking
                      ? `0 0 ${8 + localLevel * 18}px rgba(0,220,120,0.7), 0 0 0 2px rgba(0,220,120,0.5)`
                      : `${myPalette.pipGlow}, 0 2px 12px rgba(0,0,0,0.4)`,
                    border: `2px solid ${myPalette.pipBorderColor}`,
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
                  palette={myPalette}
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
                  isMuted={contactIsMuted}
                  isMe={false}
                  palette={myPalette}
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

      {/* ── Chat panel (right or bottom) with resize handle ── */}
      <div style={{
        position: 'relative',
        ...(isBottom
          ? { height: chatOpen ? chatSizeBottom : 0, width: '100%' }
          : { width: chatOpen ? chatSizeRight : 0 }),
        flexShrink: 0,
        overflow: 'hidden',
        transition: resizing.current ? 'none' : isBottom
          ? 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(chatOpen
          ? isBottom
            ? { borderTop: '1px solid rgba(0,200,255,0.18)' }
            : { borderLeft: '1px solid rgba(0,200,255,0.18)' }
          : {}),
        background: 'rgba(4, 10, 28, 0.95)',
      }}>
        {/* Resize handle */}
        {chatOpen && (
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute',
              ...(isBottom
                ? { top: 0, left: 0, right: 0, height: 6, cursor: 'row-resize' }
                : { top: 0, left: 0, bottom: 0, width: 6, cursor: 'col-resize' }),
              zIndex: 10,
            }}
          >
            {/* Visible drag indicator */}
            <div style={{
              position: 'absolute',
              ...(isBottom
                ? { top: 1, left: '50%', transform: 'translateX(-50%)', width: 40, height: 3, borderRadius: 2 }
                : { left: 1, top: '50%', transform: 'translateY(-50%)', width: 3, height: 40, borderRadius: 2 }),
              background: 'rgba(0,200,255,0.25)',
              transition: 'background 0.15s',
            }} />
          </div>
        )}
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
  profile, username, avatarUrl, isSpeaking, audioLevel, isMuted, isMe, palette,
}: {
  profile: Profile | null;
  username: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  isMe: boolean;
  palette: TierPalette;
}) {
  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Card background */}
      <div style={{ position: 'absolute', inset: -20, ...panelBackground(profile, palette), opacity: 0.85, filter: 'blur(12px)', transform: 'scale(1.05)' }} />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
      }} />

      {/* Ambient effects (orbs + particles) */}
      <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {palette.orbs.map((orb, i) => (
          <div key={`orb-${i}`} style={{
            position: 'absolute',
            width: orb.width, height: orb.height,
            borderRadius: '50%',
            background: orb.background,
            filter: `blur(${orb.blur}px)`,
            top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
            pointerEvents: 'none',
          }} />
        ))}
        {palette.particles.map((p, i) => (
          <div key={`particle-${i}`} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            boxShadow: p.glow,
            top: p.top, left: p.left,
            animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Avatar with rings */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Pulse rings */}
          {palette.rings.map((ring, i) => (
            <div key={`ring-${i}`} style={{
              position: 'absolute',
              width: ring.radius * 2, height: ring.radius * 2,
              borderRadius: '50%',
              border: ring.border,
              boxShadow: ring.boxShadow,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: ring.animate ? `aura-pulse ${ring.animationDuration ?? '3s'} ease-in-out infinite` : undefined,
              pointerEvents: 'none',
            }} />
          ))}

          <div style={{
            width: 50, height: 50,
            borderRadius: '50%',
            border: palette.avatarBorder,
            boxShadow: palette.avatarGlow,
            overflow: 'hidden',
          }}>
            <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
          </div>
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(6,14,31,0.8)', zIndex: 2,
            }}>
              <MicOff className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <span className="text-base" style={{
            color: palette.nameColor,
            fontWeight: palette.nameWeight,
            textShadow: palette.nameShadow,
          }}>
            {username}
          </span>
          {isMe && (
            <span className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5"
              style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
          )}
        </div>

        {/* Audio bars */}
        <TierAudioBars config={palette.audioBars} level={audioLevel} speaking={isSpeaking} muted={isMuted} />
      </div>
    </div>
  );
}

/* ── Tier-aware audio bar visualizer ────────────────────────────────── */

function TierAudioBars({ config, level, speaking, muted }: {
  config: AudioBarConfig;
  level: number;
  speaking: boolean;
  muted: boolean;
}) {
  const active = speaking && !muted;
  const effectiveLevel = muted ? 0 : level;

  if (config.style === 'simple') {
    return (
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
        {Array.from({ length: config.count }).map((_, i) => {
          const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + effectiveLevel * 20);
          const barHeight = active ? Math.max(4, 24 * effectiveLevel * variance) : 4;
          return (
            <div key={i} style={{
              width: config.width, height: barHeight, borderRadius: 2,
              background: active ? config.activeColor : config.silentColor,
              transition: 'height 0.1s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  const bands = config.bands!;
  let barIndex = 0;
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
      {bands.map((band, bi) => (
        <div key={bi} style={{ display: 'flex', gap: 2, marginLeft: bi > 0 ? config.bandGap : 0 }}>
          {Array.from({ length: band.count }).map((_, i) => {
            const idx = barIndex++;
            const variance = 0.5 + 0.5 * Math.sin(idx * 1.8 + effectiveLevel * 25);
            const barHeight = active ? Math.max(3, 22 * effectiveLevel * variance) : 3;
            return (
              <div key={i} style={{
                width: config.width, height: barHeight, borderRadius: 1,
                background: active ? band.activeColor : band.color,
                transition: 'height 0.1s ease-out',
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
