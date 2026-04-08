// src/components/call/AddToCallModal.tsx
import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';
import type { Profile } from '../../store/authStore';

interface Props {
  onClose: () => void;
  multiSelect?: boolean;
}

export function AddToCallModal({ onClose, multiSelect }: Props) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const friends = useFriendStore(s => s.friends);
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const participants = useGroupCallStore(s => s.participants);
  const addParticipant = useGroupCallStore(s => s.addParticipant);
  const startGroupCall = useGroupCallStore(s => s.startGroupCall);

  const slotsUsed = participants.size;
  const slotsAvailable = 4 - slotsUsed - selectedIds.size;

  const inCallIds = useMemo(() => new Set(participants.keys()), [participants]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return friends
      .filter(f => !q || f.username.toLowerCase().includes(q))
      .sort((a, b) => {
        const aInCall = inCallIds.has(a.id);
        const bInCall = inCallIds.has(b.id);
        if (aInCall !== bInCall) return aInCall ? -1 : 1;
        const aOnline = onlineIds.has(a.id);
        const bOnline = onlineIds.has(b.id);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
  }, [friends, search, onlineIds, inCallIds]);

  function handleInvite(friend: Profile) {
    if (multiSelect) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(friend.id)) next.delete(friend.id);
        else if (slotsAvailable > 0) next.add(friend.id);
        return next;
      });
    } else {
      addParticipant(friend);
      onClose();
    }
  }

  async function handleStartCall() {
    const selected = friends.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    try {
      await startGroupCall(selected);
    } catch (err) {
      console.error('[group-call] Failed to start group call', err);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div
        className="flex flex-col rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(10,22,40,0.98), rgba(13,40,71,0.98))',
          border: '1px solid rgba(0,212,255,0.20)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.60), 0 0 40px rgba(0,212,255,0.08)',
          width: 340, maxHeight: '70vh',
        }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {multiSelect ? 'Start Group Call' : 'Add to Call'}
          </h3>
          <button onClick={onClose} className="flex items-center justify-center rounded-full h-7 w-7"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <Search className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1" style={{ maxHeight: 280 }}>
          {filtered.map(friend => {
            const isInCall = inCallIds.has(friend.id);
            const isOnline = onlineIds.has(friend.id);
            const isSelected = selectedIds.has(friend.id);
            const canInvite = !isInCall && isOnline && (slotsAvailable > 0 || isSelected);

            return (
              <div
                key={friend.id}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2"
                style={{
                  background: isSelected ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                  opacity: isInCall || !isOnline ? 0.4 : 1,
                  cursor: canInvite ? 'pointer' : 'default',
                }}
                onClick={() => canInvite && handleInvite(friend)}
              >
                <div style={{ position: 'relative' }}>
                  <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="md" />
                  {isOnline && !isInCall && (
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
                      background: '#3dd87a', border: '2px solid #0a1628',
                    }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{friend.username}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {isInCall ? 'Already in call' : isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                {isInCall && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>&#10003;</span>}
                {!isInCall && isOnline && !multiSelect && (
                  <button className="rounded-lg px-2.5 py-1 text-[10px] font-semibold"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.30)', color: '#00d4ff' }}>
                    Invite
                  </button>
                )}
                {multiSelect && isSelected && (
                  <div className="h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,212,255,0.25)', border: '1px solid rgba(0,212,255,0.50)' }}>
                    <span className="text-[10px] text-cyan-400">&#10003;</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {slotsAvailable} of 4 slots available
          </span>
          {multiSelect && (
            <button
              onClick={handleStartCall}
              disabled={selectedIds.size === 0}
              className="rounded-xl px-4 py-1.5 text-xs font-bold"
              style={{
                background: selectedIds.size > 0 ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: selectedIds.size > 0 ? '1px solid rgba(0,212,255,0.40)' : '1px solid rgba(255,255,255,0.08)',
                color: selectedIds.size > 0 ? '#00d4ff' : 'var(--text-muted)',
                cursor: selectedIds.size > 0 ? 'pointer' : 'default',
              }}>
              Start Call ({selectedIds.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
