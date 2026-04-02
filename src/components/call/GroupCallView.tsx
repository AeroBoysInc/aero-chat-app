// src/components/call/GroupCallView.tsx
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, UserPlus } from 'lucide-react';
import { useGroupCallStore, _getRemoteStream, type GroupParticipant } from '../../store/groupCallStore';
import { ParticipantCard } from './ParticipantCard';
import { AddToCallModal } from './AddToCallModal';
import { IncomingGroupCallModal } from './IncomingGroupCallModal';
import { CameraFeed } from './CameraFeed';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';

const MAX_PARTICIPANTS = 4;

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Builds a CSS background for a participant's panel using their card settings */
function panelBackground(p: GroupParticipant): React.CSSProperties {
  if (p.cardImageUrl) {
    return {
      backgroundImage: `url(${p.cardImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: `${p.cardImageParams?.x ?? 50}% ${p.cardImageParams?.y ?? 50}%`,
    };
  }
  const preset = CARD_GRADIENTS.find(g => g.id === (p.cardGradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
  // Use the preview hex to build a vivid full-panel gradient
  return {
    background: `linear-gradient(180deg, ${preset.preview}40 0%, ${preset.preview}18 40%, rgba(6,14,31,0.95) 100%)`,
  };
}

export function GroupCallView() {
  const {
    status, participants, myUserId,
    isMuted, screenSharingUserId, localScreenStream,
    callStartedAt, invitedUserIds,
    leaveCall, toggleMute, startScreenShare, stopScreenShare,
  } = useGroupCallStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duration ticker
  useEffect(() => {
    if (!callStartedAt) return;
    const id = setInterval(() => setDuration(formatDuration(callStartedAt)), 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  // Auto-hide controls
  useEffect(() => {
    function resetHide() {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    window.addEventListener('mousemove', resetHide);
    resetHide();
    return () => {
      window.removeEventListener('mousemove', resetHide);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (status === 'ringing') return <IncomingGroupCallModal />;
  if (status === 'idle') return null;

  const participantList = Array.from(participants.values());
  const isScreenSharing = !!screenSharingUserId;
  const iAmSharing = screenSharingUserId === myUserId;

  const btnBase: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s ease',
    color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: '#060e1f' }}
    >
      {/* ── Split panels ── */}
      <div className="flex-1 flex" style={{ position: 'relative', overflow: 'hidden' }}>
        {isScreenSharing ? (
          /* ── Screen sharing layout ── */
          <div className="flex flex-col w-full h-full">
            <div className="flex-1 relative" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {iAmSharing && localScreenStream && (
                <CameraFeed stream={localScreenStream} muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
                  {participants.get(screenSharingUserId!)?.username ?? 'Someone'} is sharing
                </span>
              </div>
            </div>
            {/* Compact participant strip below screen share */}
            <div className="flex gap-2 justify-center flex-wrap py-3 px-4"
              style={{ background: 'rgba(6,14,31,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {participantList.map(p => (
                <ParticipantCard
                  key={p.userId}
                  username={p.username}
                  avatarUrl={p.avatarUrl}
                  isMuted={p.userId === myUserId ? isMuted : p.isMuted}
                  isSpeaking={p.isSpeaking}
                  audioLevel={p.audioLevel}
                  isMe={p.userId === myUserId}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Vertical split panel layout ── */
          <>
            {participantList.map((p, i) => {
              const isMe = p.userId === myUserId;
              const muted = isMe ? isMuted : p.isMuted;
              const statusLabel = muted ? 'Muted' : p.isSpeaking ? 'Speaking' : 'Listening';
              const statusColor = muted ? 'rgba(239,68,68,0.60)' : p.isSpeaking ? '#00d4ff' : 'rgba(255,255,255,0.35)';

              return (
                <div key={p.userId} style={{ display: 'contents' }}>
                  {/* Divider between panels */}
                  {i > 0 && (
                    <div style={{
                      width: 1,
                      background: 'rgba(255,255,255,0.08)',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Panel */}
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Card background — fills the entire panel */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      ...panelBackground(p),
                      opacity: 0.85,
                    }} />

                    {/* Dark overlay for readability */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
                    }} />

                    {/* Speaking edge glow */}
                    {p.isSpeaking && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        boxShadow: 'inset 0 0 60px rgba(0,212,255,0.08)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      {/* Avatar with speaking ring */}
                      <div style={{ position: 'relative' }}>
                        {p.isSpeaking && (
                          <div style={{
                            position: 'absolute', inset: -6, borderRadius: '50%',
                            border: '2.5px solid rgba(0,212,255,0.55)',
                            boxShadow: '0 0 18px rgba(0,212,255,0.40), 0 0 36px rgba(0,212,255,0.15)',
                            animation: 'aura-pulse 2.5s ease-in-out infinite',
                            pointerEvents: 'none',
                          }} />
                        )}
                        <div style={{ width: 80, height: 80 }}>
                          <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="xl" />
                        </div>
                        {muted && (
                          <div style={{
                            position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
                            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid rgba(6,14,31,0.8)',
                          }}>
                            <MicOff className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Name + You badge */}
                      <div className="text-center">
                        <span className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>
                          {p.username}
                        </span>
                        {isMe && (
                          <span className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5"
                            style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
                        )}
                      </div>

                      {/* Status */}
                      <span className="text-[11px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>

                      {/* Audio bars */}
                      <AudioBars level={muted ? 0 : p.audioLevel} active={p.isSpeaking} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty slot panel — invite prompt */}
            {participantList.length < MAX_PARTICIPANTS && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                <div
                  onClick={() => setShowAddModal(true)}
                  style={{
                    flex: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.015)',
                    transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; }}
                >
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 56, height: 56, border: '2px dashed rgba(255,255,255,0.15)' }}>
                    <UserPlus className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.20)' }} />
                  </div>
                  <span className="mt-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Add friend</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Floating header overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-5 pt-4" style={{ zIndex: 10 }}>
          <div className="h-2 w-2 rounded-full" style={{ background: '#3dd87a', boxShadow: '0 0 6px rgba(61,216,122,0.50)' }} />
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Group Call</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>&middot;</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.40)' }}>{duration}</span>
          {invitedUserIds.length > 0 && (
            <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
              Ringing {invitedUserIds.length}...
            </span>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div
        className="flex justify-center pb-6 pt-2"
        style={{
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s',
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={toggleMute}
            style={{
              ...btnBase,
              ...(isMuted ? { background: 'rgba(245,158,11,0.25)', borderColor: 'rgba(245,158,11,0.50)', color: '#f59e0b' } : {}),
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={iAmSharing ? stopScreenShare : startScreenShare}
            style={{
              ...btnBase,
              ...(iAmSharing ? { background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.50)', color: '#ef4444' } : {}),
            }}
            title={iAmSharing ? 'Stop sharing' : 'Share screen'}
          >
            {iAmSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              ...btnBase,
              ...(participantList.length >= MAX_PARTICIPANTS ? { opacity: 0.35, cursor: 'default' } : {}),
            }}
            title="Add person"
            disabled={participantList.length >= MAX_PARTICIPANTS}
          >
            <UserPlus className="h-4 w-4" />
          </button>

          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

          <button
            onClick={leaveCall}
            style={{
              ...btnBase,
              width: 48, height: 48, borderRadius: 20,
              background: 'rgba(239,68,68,0.20)', borderColor: 'rgba(239,68,68,0.40)', color: '#ef4444',
            }}
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Hidden audio elements for each remote stream */}
      {participantList.filter(p => p.userId !== myUserId).map(p => (
        <RemoteAudio key={p.userId} userId={p.userId} />
      ))}

      {showAddModal && <AddToCallModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ── Audio Bars ──────────────────────────────────────────────────────────── */

function AudioBars({ level, active }: { level: number; active: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + level * 20);
        const barHeight = active ? Math.max(4, 24 * level * variance) : 4;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: barHeight,
              borderRadius: 2,
              background: active
                ? `rgba(0,212,255,${0.4 + level * 0.3})`
                : 'rgba(255,255,255,0.08)',
              transition: 'height 0.1s ease-out',
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Hidden audio playback per remote peer ────────────────────────────── */

function RemoteAudio({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const checkStream = setInterval(() => {
      const el = audioRef.current;
      if (!el) return;
      const stream = _getRemoteStream(userId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }, 500);
    return () => clearInterval(checkStream);
  }, [userId]);

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
}
