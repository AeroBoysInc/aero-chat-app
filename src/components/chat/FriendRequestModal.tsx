import { useEffect } from 'react';
import { X, Check, UserX } from 'lucide-react';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage } from '../ui/AvatarImage';

interface Props { onClose: () => void; }

export function FriendRequestModal({ onClose }: Props) {
  const { pendingIncoming, respondToRequest } = useFriendStore();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm p-5 shadow-2xl animate-fade-in"
        style={{
          borderRadius: 20,
          border: '1px solid var(--popup-border)',
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: 'var(--popup-text)' }}>Friend Requests</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-muted)'; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pendingIncoming.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--popup-text-muted)' }}>No pending requests</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingIncoming.map((req) => (
              <li
                key={req.id}
                className="flex items-center gap-3 rounded-aero px-3 py-2.5"
                style={{ background: 'var(--popup-item-bg)', border: '1px solid var(--popup-divider)' }}
              >
                <AvatarImage username={req.sender?.username ?? '?'} avatarUrl={req.sender?.avatar_url} size="md" />
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                  {req.sender?.username}
                </span>
                <button
                  onClick={() => respondToRequest(req.id, true)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: '#4fc97a' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(79,201,122,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  title="Accept"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => respondToRequest(req.id, false)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: '#f87171' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  title="Decline"
                >
                  <UserX className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
