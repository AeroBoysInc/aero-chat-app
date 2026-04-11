import { useEffect } from 'react';
import { X, Check, UserX, Users, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '../../lib/useIsMobile';
import { useFriendStore } from '../../store/friendStore';
import { useGroupChatStore } from '../../store/groupChatStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';

interface Props { onClose: () => void; }

export function FriendRequestModal({ onClose }: Props) {
  const { pendingIncoming, respondToRequest } = useFriendStore();
  const { pendingInvites, acceptInvite, declineInvite } = useGroupChatStore();
  const user = useAuthStore(s => s.user);
  const isMobile = useIsMobile();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (isMobile) {
    return (
      <div className="h-dvh flex flex-col" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--sidebar-bg)' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--panel-divider)' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)', fontSize: 16 }}>Friend Requests</h2>
        </div>
        {/* Content — scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
          {pendingIncoming.length === 0 && pendingInvites.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No pending requests</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingIncoming.map((req) => (
                <li key={req.id} className="flex items-center gap-3 rounded-aero px-3 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-divider)' }}>
                  <AvatarImage username={req.sender?.username ?? '?'} avatarUrl={req.sender?.avatar_url} size="md" />
                  <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{req.sender?.username}</span>
                  <button onClick={() => respondToRequest(req.id, true)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => respondToRequest(req.id, false)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-aero px-3 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-divider)' }}>
                  <Users className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{inv.group?.name ?? 'Group invite'}</span>
                  <button onClick={() => user && acceptInvite(inv.id, user.id)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => declineInvite(inv.id)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

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

        {pendingIncoming.length === 0 && pendingInvites.length === 0 ? (
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

        {/* ── Group Invites ── */}
        {pendingInvites.length > 0 && (
          <>
            <div className="my-3" style={{ height: 1, background: 'var(--popup-divider)' }} />
            <h3 className="flex items-center gap-2 mb-2 text-sm font-bold" style={{ color: 'var(--popup-text)' }}>
              <Users className="h-3.5 w-3.5" style={{ color: '#00d4ff' }} />
              Group Invites
            </h3>
            <ul className="flex flex-col gap-2">
              {pendingInvites.map(inv => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-aero px-3 py-2.5"
                  style={{ background: 'var(--popup-item-bg)', border: '1px solid var(--popup-divider)' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,100,200,0.2))',
                    border: '1px solid rgba(0,212,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Users className="h-4 w-4" style={{ color: '#00d4ff' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                      {inv.group?.name ?? 'Group'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--popup-text-muted)' }}>
                      from {inv.inviter?.username ?? '?'}
                    </p>
                  </div>
                  <button
                    onClick={() => user && acceptInvite(inv.id, user.id)}
                    className="rounded-lg p-1.5 transition-colors"
                    style={{ color: '#4fc97a' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(79,201,122,0.12)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    title="Accept"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => declineInvite(inv.id)}
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
          </>
        )}
      </div>
    </div>
  );
}
