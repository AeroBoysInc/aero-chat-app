// src/components/call/GroupCallView.tsx
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, UserPlus } from 'lucide-react';
import { useGroupCallStore, _getRemoteStream } from '../../store/groupCallStore';
import { ParticipantCard } from './ParticipantCard';
import { AddToCallModal } from './AddToCallModal';
import { IncomingGroupCallModal } from './IncomingGroupCallModal';
import { CameraFeed } from './CameraFeed';

const MAX_PARTICIPANTS = 4;

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  const emptySlots = MAX_PARTICIPANTS - participantList.length;
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
      style={{ background: 'linear-gradient(135deg, #060e1f 0%, #0a1e3d 50%, #0d2847 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4">
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

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {isScreenSharing ? (
          <div className="flex flex-col gap-3 w-full h-full max-w-5xl">
            <div className="flex-1 rounded-2xl overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
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
            <div className="flex gap-2 justify-center flex-wrap">
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
          <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 440 }}>
            {participantList.map(p => (
              <ParticipantCard
                key={p.userId}
                username={p.username}
                avatarUrl={p.avatarUrl}
                isMuted={p.userId === myUserId ? isMuted : p.isMuted}
                isSpeaking={p.isSpeaking}
                audioLevel={p.audioLevel}
                isMe={p.userId === myUserId}
              />
            ))}
            {Array.from({ length: Math.min(emptySlots, MAX_PARTICIPANTS - participantList.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center rounded-2xl p-5 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px dashed rgba(255,255,255,0.10)',
                  minHeight: 160,
                }}
                onClick={() => setShowAddModal(true)}
              >
                <div className="flex items-center justify-center rounded-full"
                  style={{ width: 52, height: 52, border: '2px dashed rgba(255,255,255,0.15)' }}>
                  <UserPlus className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.20)' }} />
                </div>
                <span className="mt-2 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Add friend</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="flex justify-center pb-6 pt-2"
        style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
