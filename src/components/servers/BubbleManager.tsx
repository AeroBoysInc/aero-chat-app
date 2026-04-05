// src/components/servers/BubbleManager.tsx
import { memo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';

export const BubbleManager = memo(function BubbleManager() {
  const { selectedServerId, bubbles, loadServerData } = useServerStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');

  const handleCreate = async () => {
    if (!selectedServerId || !newName.trim()) return;
    await supabase.from('bubbles').insert({
      server_id: selectedServerId, name: newName.trim(), color: newColor, restricted_to_roles: [],
    });
    await loadServerData(selectedServerId);
    setNewName('');
  };

  const handleDelete = async (bubbleId: string) => {
    await supabase.from('bubbles').delete().eq('id', bubbleId);
    if (selectedServerId) await loadServerData(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
          placeholder="New bubble name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }} />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {bubbles.map(bubble => (
        <div key={bubble.id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: bubble.color }} />
          <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{bubble.name}</span>
          <button onClick={() => handleDelete(bubble.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
});
