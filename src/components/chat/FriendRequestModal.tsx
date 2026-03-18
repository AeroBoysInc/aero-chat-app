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
      <div className="relative w-full max-w-sm rounded-aero-lg border border-white/20 bg-aero-deep/90 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Friend Requests</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {pendingIncoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">No pending requests</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingIncoming.map((req) => (
              <li key={req.id} className="flex items-center gap-3 rounded-aero bg-white/5 px-3 py-2.5">
                <AvatarImage username={req.sender?.username ?? '?'} avatarUrl={req.sender?.avatar_url} size="md" />
                <span className="flex-1 truncate text-sm font-medium text-white">{req.sender?.username}</span>
                <button
                  onClick={() => respondToRequest(req.id, true)}
                  className="rounded-lg p-1.5 text-aero-green hover:bg-aero-green/15 transition-colors"
                  title="Accept"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => respondToRequest(req.id, false)}
                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-400/15 transition-colors"
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
