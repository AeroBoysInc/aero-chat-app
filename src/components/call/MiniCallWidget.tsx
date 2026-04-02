import { useState, useEffect } from 'react';
import { PhoneOff, ArrowUpRight } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';
import { AvatarImage } from '../ui/AvatarImage';

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Discord-style mini call widget shown at bottom-right when a call is active
 * and the user has navigated to a corner (game, writer, dev).
 * Clicking "Return" closes the corner and goes back to the call view.
 */
export function MiniCallWidget() {
  // 1:1 call state
  const callStatus = useCallStore(s => s.status);
  const callContact = useCallStore(s => s.contact);
  const callStartedAt = useCallStore(s => s.callStartedAt);
  const callHangUp = useCallStore(s => s.hangUp);
  const callRemoteStream = useCallStore(s => s.remoteStream);

  // Group call state
  const groupStatus = useGroupCallStore(s => s.status);
  const groupParticipants = useGroupCallStore(s => s.participants);
  const groupStartedAt = useGroupCallStore(s => s.callStartedAt);
  const groupLeave = useGroupCallStore(s => s.leaveCall);

  // Corner navigation
  const { closeGameView, closeDevView, closeWriterView } = useCornerStore();

  const is1v1 = callStatus === 'connected';
  const isGroup = groupStatus === 'connected';
  if (!is1v1 && !isGroup) return null;

  const startedAt = is1v1 ? callStartedAt : groupStartedAt;
  const hangUp = is1v1 ? callHangUp : groupLeave;

  // Find who's speaking in group, or use contact for 1:1
  let speakerName = '';
  let speakerAvatar: string | null = null;

  if (is1v1) {
    speakerName = callContact?.username ?? '';
    speakerAvatar = callContact?.avatar_url ?? null;
  } else {
    const pList = Array.from(groupParticipants.values());
    const speaker = pList.find(p => p.isSpeaking && p.userId !== useGroupCallStore.getState().myUserId);
    if (speaker) {
      speakerName = speaker.username;
      speakerAvatar = speaker.avatarUrl;
    } else if (pList.length > 0) {
      // Show first non-self participant
      const other = pList.find(p => p.userId !== useGroupCallStore.getState().myUserId) ?? pList[0];
      speakerName = other.username;
      speakerAvatar = other.avatarUrl;
    }
  }

  const returnToCall = () => {
    closeGameView();
    closeDevView();
    closeWriterView();
  };

  return (
    <MiniCallWidgetInner
      speakerName={speakerName}
      speakerAvatar={speakerAvatar}
      startedAt={startedAt}
      remoteStream={is1v1 ? callRemoteStream : null}
      isGroup={isGroup}
      participantCount={isGroup ? groupParticipants.size : 2}
      onReturn={returnToCall}
      onHangUp={hangUp}
    />
  );
}

function MiniCallWidgetInner({
  speakerName,
  speakerAvatar,
  startedAt,
  remoteStream,
  isGroup,
  participantCount,
  onReturn,
  onHangUp,
}: {
  speakerName: string;
  speakerAvatar: string | null;
  startedAt: number | null;
  remoteStream: MediaStream | null;
  isGroup: boolean;
  participantCount: number;
  onReturn: () => void;
  onHangUp: () => void;
}) {
  const [duration, setDuration] = useState('0:00');
  const [audioLevel, setAudioLevel] = useState(0);
  const [hovered, setHovered] = useState(false);

  // Duration timer
  useEffect(() => {
    if (!startedAt) return;
    setDuration(formatDuration(startedAt));
    const id = setInterval(() => setDuration(formatDuration(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Audio level from remote stream (1:1 only)
  useEffect(() => {
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) { setAudioLevel(0); return; }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(remoteStream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setAudioLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 255);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(rafId); ctx.close().catch(() => {}); };
  }, [remoteStream]);

  const speaking = audioLevel > 0.04;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 60,
        width: 240,
        borderRadius: 14,
        background: 'rgba(6, 14, 31, 0.92)',
        border: `1px solid ${hovered ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.10)'}`,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        cursor: 'pointer',
      }}
      onClick={onReturn}
    >
      {/* Top section — speaker info */}
      <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Avatar with speaking glow */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          boxShadow: speaking ? '0 0 8px rgba(0,212,255,0.5)' : 'none',
          transition: 'box-shadow 0.15s',
        }}>
          <AvatarImage username={speakerName} avatarUrl={speakerAvatar} size="sm" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.90)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {speakerName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3dd87a', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
              {duration}
            </span>
            {isGroup && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                · {participantCount} people
              </span>
            )}
          </div>
        </div>

        {/* Mini audio bars */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => {
            const v = 0.5 + 0.5 * Math.sin(i * 2.1 + audioLevel * 20);
            const h = speaking ? Math.max(3, 16 * audioLevel * v) : 3;
            return (
              <div key={i} style={{
                width: 2, height: h, borderRadius: 1,
                background: speaking ? `rgba(0,212,255,${0.4 + audioLevel * 0.4})` : 'rgba(255,255,255,0.12)',
                transition: 'height 0.1s ease-out',
              }} />
            );
          })}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        display: 'flex', gap: 6, padding: '6px 14px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onReturn(); }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(0,200,255,0.12)', color: 'rgba(0,212,255,0.85)',
            fontSize: 11, fontWeight: 600, transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,255,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,200,255,0.12)')}
        >
          <ArrowUpRight className="h-3 w-3" />
          Return
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onHangUp(); }}
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.30)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
        >
          <PhoneOff className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
