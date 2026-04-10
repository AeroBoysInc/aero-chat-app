import { useState, useEffect } from 'react';
import { X, Check, Users } from 'lucide-react';
import { useFriendStore } from '../../store/friendStore';
import { useAuthStore } from '../../store/authStore';
import { useGroupChatStore } from '../../store/groupChatStore';
import { AvatarImage } from '../ui/AvatarImage';

interface Props {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const friends = useFriendStore(s => s.friends);
  const user = useAuthStore(s => s.user);
  const createGroup = useGroupChatStore(s => s.createGroup);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleFriend = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user || !name.trim() || selectedIds.size === 0) return;
    setCreating(true);
    await createGroup(name.trim(), Array.from(selectedIds), user.id);
    setCreating(false);
    onClose();
  };

  const canCreate = name.trim().length > 0 && selectedIds.size > 0 && !creating;

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
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: '#00d4ff' }} />
            <h2 className="font-bold" style={{ color: 'var(--popup-text)' }}>Create Group</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Group name */}
        <input
          className="aero-input w-full mb-3 py-2 px-3 text-sm"
          placeholder="Group name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
        />

        {/* Friend picker */}
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--popup-text-muted)' }}>
          Select friends ({selectedIds.size}/3)
        </p>
        <div className="max-h-48 overflow-y-auto scrollbar-aero flex flex-col gap-1 mb-4">
          {friends.map(f => {
            const selected = selectedIds.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFriend(f.id)}
                className="flex items-center gap-3 rounded-aero px-3 py-2 transition-colors text-left w-full"
                style={{
                  background: selected ? 'rgba(0,212,255,0.08)' : 'transparent',
                  border: selected ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <AvatarImage username={f.username} avatarUrl={f.avatar_url} size="sm" />
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                  {f.username}
                </span>
                {selected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,212,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check className="h-3 w-3" style={{ color: '#00d4ff' }} />
                  </div>
                )}
              </button>
            );
          })}
          {friends.length === 0 && (
            <p className="py-4 text-center text-xs" style={{ color: 'var(--popup-text-muted)' }}>
              Add some friends first!
            </p>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full rounded-aero py-2.5 text-sm font-bold transition-all"
          style={{
            background: canCreate
              ? 'linear-gradient(135deg, #1a6fd4, #00d4ff)'
              : 'rgba(255,255,255,0.06)',
            color: canCreate ? '#fff' : 'var(--text-muted)',
            opacity: canCreate ? 1 : 0.5,
            cursor: canCreate ? 'pointer' : 'not-allowed',
          }}
        >
          {creating ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
