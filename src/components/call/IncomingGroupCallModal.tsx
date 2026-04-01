import { useEffect } from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';

export function IncomingGroupCallModal() {
  const { status, callId, participants, joinGroupCall } = useGroupCallStore();

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
