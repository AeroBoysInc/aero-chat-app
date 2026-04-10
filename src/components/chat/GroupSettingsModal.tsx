import { useState, useEffect } from 'react';
import { X, UserMinus, Save } from 'lucide-react';
import { useGroupChatStore } from '../../store/groupChatStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { supabase } from '../../lib/supabase';

interface Props {
  groupId: string;
  onClose: () => void;
}

export function GroupSettingsModal({ groupId, onClose }: Props) {
  const user = useAuthStore(s => s.user);
  const group = useGroupChatStore(s => s.groups.find(g => g.id === groupId));
  const updateGroupCard = useGroupChatStore(s => s.updateGroupCard);
  const removeMember = useGroupChatStore(s => s.removeMember);

  const [name, setName] = useState(group?.name ?? '');
  const [selectedGradient, setSelectedGradient] = useState(group?.card_gradient ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!group || !user) return null;

  const handleSave = async () => {
    setSaving(true);
    await updateGroupCard(groupId, {
      name: name.trim() || group.name,
      card_gradient: selectedGradient,
    });
    setSaving(false);
    onClose();
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember(groupId, userId);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${groupId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('group-images').upload(path, file);
    if (error) return;
    const { data } = supabase.storage.from('group-images').getPublicUrl(path);
    await updateGroupCard(groupId, { card_image_url: data.publicUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm p-5 shadow-2xl animate-fade-in max-h-[80vh] overflow-y-auto scrollbar-aero"
        style={{
          borderRadius: 20,
          border: '1px solid var(--popup-border)',
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: 'var(--popup-text)' }}>Group Settings</h2>
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

        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Group Name
        </label>
        <input
          className="aero-input w-full mb-4 py-2 px-3 text-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
        />

        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Card Gradient
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {CARD_GRADIENTS.slice(0, 12).map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGradient(g.id)}
              className="rounded-lg transition-all"
              style={{
                width: 32, height: 32,
                background: g.css,
                border: selectedGradient === g.id ? '2px solid #00d4ff' : '2px solid transparent',
                boxShadow: selectedGradient === g.id ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
              }}
            />
          ))}
        </div>

        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Card Image
        </label>
        <label
          className="flex items-center justify-center w-full py-2 mb-4 rounded-aero text-xs font-medium cursor-pointer transition-colors"
          style={{ border: '1px dashed rgba(0,212,255,0.25)', color: '#00d4ff' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          Upload Image
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Members ({group.members.length}/4)
        </label>
        <div className="flex flex-col gap-1 mb-4">
          {group.members.map(m => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 rounded-aero px-3 py-2"
              style={{ background: 'var(--popup-item-bg)', border: '1px solid var(--popup-divider)' }}
            >
              <AvatarImage username={m.profile?.username ?? '?'} avatarUrl={m.profile?.avatar_url} size="sm" />
              <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                {m.profile?.username ?? '?'}
                {m.user_id === group.leader_id && (
                  <span className="ml-1.5 text-[9px] font-bold" style={{ color: '#f59e0b' }}>LEADER</span>
                )}
              </span>
              {m.user_id !== user.id && m.user_id !== group.leader_id && (
                <button
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: '#f87171' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  title="Remove member"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-aero py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
            color: '#fff',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
