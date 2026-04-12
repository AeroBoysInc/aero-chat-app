import { memo, useState, useRef, useCallback } from 'react';
import { X, Upload, Trash2, GripVertical } from 'lucide-react';
import type { DndMap } from '../../../../lib/serverTypes';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { useDndMapStore } from '../../../../store/dndMapStore';

export const MapManager = memo(function MapManager({
  serverId,
  maps,
  onClose,
}: {
  serverId: string;
  maps: DndMap[];
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { createMap, deleteMap } = useDndMapStore();
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleUpload = useCallback(async () => {
    if (!pendingFile || !newName.trim() || !user) return;
    setUploading(true);

    const ext = pendingFile.name.split('.').pop() ?? 'png';
    const path = `maps/${serverId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('dnd-assets').upload(path, pendingFile);
    if (upErr) { console.error('Map upload error:', upErr); setUploading(false); return; }
    const { data } = supabase.storage.from('dnd-assets').getPublicUrl(path);

    await createMap({
      server_id: serverId,
      name: newName.trim(),
      image_url: data.publicUrl,
      created_by: user.id,
    });

    setNewName('');
    setPendingFile(null);
    setUploading(false);
  }, [pendingFile, newName, user, serverId, createMap]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete map "${name}" and all its pins?`)) return;
    await deleteMap(id);
  }, [deleteMap]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e0e0e0', outline: 'none',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: 400, maxHeight: '80vh', borderRadius: 20, overflow: 'hidden', overflowY: 'auto',
        background: 'rgba(22,22,38,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>Manage Maps</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Map list */}
        <div style={{ padding: '12px 20px' }}>
          {maps.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <GripVertical size={14} style={{ color: '#444', flexShrink: 0 }} />
              <img src={m.image_url} alt="" style={{ width: 40, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: '#ccc', fontWeight: 600 }}>{m.name}</span>
              <button
                onClick={() => handleDelete(m.id, m.name)}
                style={{ background: 'none', border: 'none', color: '#e05050', cursor: 'pointer', flexShrink: 0 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {maps.length === 0 && (
            <p style={{ fontSize: 12, color: '#555', textAlign: 'center', padding: '20px 0' }}>No maps yet. Upload one below.</p>
          )}
        </div>

        {/* Upload section */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 8 }}>ADD NEW MAP</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); }} />

          {pendingFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#aaa', flex: 1 }}>{pendingFile.name}</span>
              <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 10 }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                cursor: 'pointer', color: '#666', marginBottom: 10,
              }}
            >
              <Upload size={12} /> Choose map image
            </button>
          )}

          <input style={{ ...inputStyle, marginBottom: 10 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Map name (e.g. Overworld)" />

          <button
            onClick={handleUpload}
            disabled={!pendingFile || !newName.trim() || uploading}
            style={{
              width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: (!pendingFile || !newName.trim() || uploading) ? 'rgba(139,69,19,0.3)' : 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: pendingFile && newName.trim() && !uploading ? 'pointer' : 'default',
              opacity: (!pendingFile || !newName.trim() || uploading) ? 0.5 : 1,
            }}
          >
            {uploading ? 'Uploading…' : 'Upload Map'}
          </button>
        </div>
      </div>
    </div>
  );
});
