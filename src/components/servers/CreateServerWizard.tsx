// src/components/servers/CreateServerWizard.tsx
import { memo, useState, useRef } from 'react';
import { X, ArrowRight, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useCornerStore } from '../../store/cornerStore';

export const CreateServerWizard = memo(function CreateServerWizard({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { addServer, selectServer, loadServerData } = useServerStore();
  const { enterServer } = useCornerStore();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [memberCap, setMemberCap] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const iconRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    setError('');

    try {
      // 1. Upload icon/banner if provided
      let icon_url: string | null = null;
      let banner_url: string | null = null;

      if (iconFile) {
        const path = `${user.id}/${Date.now()}-icon`;
        const { error: upErr } = await supabase.storage.from('server-icons').upload(path, iconFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('server-icons').getPublicUrl(path);
          icon_url = urlData.publicUrl;
        }
      }
      if (bannerFile) {
        const path = `${user.id}/${Date.now()}-banner`;
        const { error: upErr } = await supabase.storage.from('server-banners').upload(path, bannerFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('server-banners').getPublicUrl(path);
          banner_url = urlData.publicUrl;
        }
      }

      // 2. Insert server
      const { data: server, error: sErr } = await supabase
        .from('servers')
        .insert({ owner_id: user.id, name: name.trim(), description: description.trim() || null, icon_url, banner_url, member_cap: memberCap })
        .select()
        .single();
      if (sErr || !server) throw new Error(sErr?.message ?? 'Failed to create server');

      // 3. Insert Owner role + permissions
      const { data: ownerRole, error: orErr } = await supabase
        .from('server_roles')
        .insert({ server_id: server.id, name: 'Owner', color: '#ff6b35', position: 999, is_owner_role: true })
        .select()
        .single();
      if (orErr || !ownerRole) throw new Error(orErr?.message ?? 'Failed to create owner role');

      await supabase.from('server_role_permissions').insert({
        role_id: ownerRole.id,
        manage_server: true, manage_roles: true, manage_bubbles: true,
        manage_members: true, send_invites: true, send_messages: true,
        pin_messages: true, start_calls: true, dungeon_master: true,
      });

      // 4. Insert default Member role + permissions
      const { data: memberRole, error: mrErr } = await supabase
        .from('server_roles')
        .insert({ server_id: server.id, name: 'Member', color: '#8b949e', position: 1, is_owner_role: false })
        .select()
        .single();
      if (mrErr || !memberRole) throw new Error(mrErr?.message ?? 'Failed to create member role');

      await supabase.from('server_role_permissions').insert({
        role_id: memberRole.id,
        manage_server: false, manage_roles: false, manage_bubbles: false,
        manage_members: false, send_invites: false, send_messages: true,
        pin_messages: false, start_calls: true, dungeon_master: false,
      });

      // 5. Insert creator as member with Owner role
      await supabase.from('server_members').insert({
        server_id: server.id, user_id: user.id, role_id: ownerRole.id,
      });

      // 6. Insert "general" bubble
      await supabase.from('bubbles').insert({
        server_id: server.id, name: 'general', color: '#00d4ff', restricted_to_roles: [],
      });

      // 7. Navigate into the new server
      addServer(server);
      selectServer(server.id);
      await loadServerData(server.id);
      enterServer();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    color: 'var(--text-primary)', outline: 'none',
  };

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 60, backdropFilter: 'blur(24px)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 440, borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Create Server — Step {step} of 3
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Step 1: Name & Description */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Server Name *</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 50))}
                  placeholder="My Awesome Server"
                  autoFocus
                />
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{name.length}/50</p>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Description</label>
                <textarea
                  style={{ ...inputStyle, resize: 'none', height: 60 }}
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 200))}
                  placeholder="What's this server about?"
                />
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{description.length}/200</p>
              </div>
            </div>
          )}

          {/* Step 2: Icon & Banner */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Server Icon</label>
                <div
                  onClick={() => iconRef.current?.click()}
                  className="mt-1 flex items-center gap-3 cursor-pointer rounded-aero-lg p-3 transition-opacity hover:opacity-80"
                  style={{ border: '1px dashed var(--panel-divider)' }}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {iconFile ? iconFile.name : 'Click to upload (optional)'}
                  </span>
                </div>
                <input ref={iconRef} type="file" accept="image/*" onChange={handleIconChange} hidden />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Banner Image</label>
                <div
                  onClick={() => bannerRef.current?.click()}
                  className="mt-1 cursor-pointer overflow-hidden rounded-aero-lg transition-opacity hover:opacity-80"
                  style={{ border: '1px dashed var(--panel-divider)', height: 80 }}
                >
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ background: 'var(--input-bg)' }}>
                      <Upload className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      <span className="ml-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Upload banner (optional)</span>
                    </div>
                  )}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" onChange={handleBannerChange} hidden />
              </div>
            </div>
          )}

          {/* Step 3: Member Cap & Preview */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Member Cap</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={1} max={200}
                    value={memberCap}
                    onChange={e => setMemberCap(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 32, textAlign: 'right' }}>
                    {memberCap}
                  </span>
                </div>
              </div>
              <div className="rounded-aero-lg p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-divider)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
                  <Sparkles className="inline h-3 w-3 mr-1" style={{ color: '#00d4ff' }} />
                  What will be created:
                </p>
                <ul style={{ fontSize: 11, color: 'var(--text-muted)', listStyle: 'disc', paddingLeft: 16 }}>
                  <li>Server: <strong style={{ color: 'var(--text-primary)' }}>{name || '(unnamed)'}</strong></li>
                  <li>Your role: <strong style={{ color: '#ff6b35' }}>Owner</strong> (all permissions)</li>
                  <li>Default role: <strong style={{ color: '#8b949e' }}>Member</strong></li>
                  <li>Initial bubble: <strong style={{ color: '#00d4ff' }}>#general</strong></li>
                </ul>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--panel-divider)' }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="rounded-aero px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <div className="flex gap-2">
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  className="rounded-aero px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !name.trim()}
                className="flex items-center gap-1 rounded-aero px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              >
                Next <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-aero px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              {creating ? 'Creating...' : 'Create Server'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
