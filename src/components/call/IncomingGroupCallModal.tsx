import { useEffect } from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';
import { startRingtone, stopRingtone } from '../../lib/ringtone';
import { useIsMobile } from '../../lib/useIsMobile';

export function IncomingGroupCallModal() {
  const { status, callId, participants, joinGroupCall } = useGroupCallStore();
  const isMobile = useIsMobile();

  // Play ringtone while ringing
  useEffect(() => {
    if (status === 'ringing') {
      startRingtone();
      return () => stopRingtone();
    }
  }, [status]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter') handleAccept();
      if (e.key === 'Escape') handleReject();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, participants]);

  if (status !== 'ringing') return null;

  const participantList = Array.from(participants.values());
  const names = participantList.map(p => p.username);
  const displayNames = names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, 2).join(', ')} and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`;

  function handleAccept() {
    if (!callId) return;
    joinGroupCall(callId, '', participantList);
  }

  function handleReject() {
    useGroupCallStore.setState({
      status: 'idle',
      callId: null,
      participants: new Map(),
      invitedUserIds: [],
    });
  }

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(0,40,100,0.5) 0%, rgba(0,0,0,0.7) 100%)',
      }}>
        {/* Pulsing rings */}
        <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[160, 120, 80].map((size, i) => (
            <div key={i} style={{
              position: 'absolute', width: size, height: size, borderRadius: '50%',
              border: `1px solid rgba(0,212,255,${0.06 + i * 0.04})`,
              animation: `aura-pulse ${2.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20 }}>
            Incoming Group Call
          </p>
          {/* Participant avatars row */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            {participantList.slice(0, 3).map((p, i) => (
              <div key={p.userId} style={{ marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: 3 - i }}>
                <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="lg" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{displayNames}</p>
        </div>

        {/* Accept / Decline */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 56, marginTop: 48 }}>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleReject}
              style={{
                width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.7)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(239,68,68,0.3)',
              }}
            >
              <PhoneOff className="h-6 w-6" />
            </button>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Decline</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleAccept}
              style={{
                width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(34,197,94,0.7)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(34,197,94,0.3)',
              }}
            >
              <Phone className="h-6 w-6" />
            </button>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Accept</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
        style={{
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(0,212,255,0.25)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.60), 0 0 40px rgba(0,212,255,0.10)',
          minWidth: 300,
        }}
      >
        <Users className="h-10 w-10" style={{ color: '#00d4ff' }} />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Group Call</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{displayNames}</p>
        </div>

        <div className="flex -space-x-2">
          {participantList.slice(0, 4).map(p => (
            <div key={p.userId} className="ring-2 ring-[#0a1628] rounded-full">
              <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="lg" />
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleReject}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm"
            style={{ background: 'rgba(239,68,68,0.20)', border: '1px solid rgba(239,68,68,0.40)', color: '#ef4444' }}
          >
            <PhoneOff className="h-4 w-4" /> Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm"
            style={{ background: 'rgba(52,211,153,0.20)', border: '1px solid rgba(52,211,153,0.40)', color: '#34d399' }}
          >
            <Phone className="h-4 w-4" /> Join
          </button>
        </div>
      </div>
    </div>
  );
}
