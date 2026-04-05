// src/components/servers/RoleEditor.tsx
import { memo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import type { PermissionKey } from '../../lib/serverTypes';

const PERM_LABELS: Record<PermissionKey, string> = {
  manage_server: 'Manage Server',
  manage_roles: 'Manage Roles',
  manage_bubbles: 'Manage Bubbles',
  manage_members: 'Manage Members',
  send_invites: 'Send Invites',
  send_messages: 'Send Messages',
  pin_messages: 'Pin Messages',
  start_calls: 'Start Calls',
};

export const RoleEditor = memo(function RoleEditor() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');

  const myMembership = members.find(m => m.user_id === user?.id);
  const myRole = myMembership ? roles.find(r => r.id === myMembership.role_id) : null;
  const myPosition = myRole?.position ?? -1;

  const handleCreateRole = async () => {
    if (!selectedServerId || !newName.trim()) return;
    const position = 2; // just above default Member
    const { data: role } = await supabase
      .from('server_roles')
      .insert({ server_id: selectedServerId, name: newName.trim(), color: newColor, position })
      .select()
      .single();
    if (role) {
      await supabase.from('server_role_permissions').insert({ role_id: role.id });
      await loadRoles(selectedServerId);
      setNewName('');
    }
  };

  const handleTogglePerm = async (roleId: string, perm: PermissionKey, current: boolean) => {
    await supabase.from('server_role_permissions').update({ [perm]: !current }).eq('role_id', roleId);
    if (selectedServerId) await loadRoles(selectedServerId);
  };

  const handleDeleteRole = async (roleId: string) => {
    await supabase.from('server_roles').delete().eq('id', roleId);
    if (selectedServerId) await loadRoles(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create new role */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
          placeholder="New role name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }} />
        <button
          onClick={handleCreateRole}
          disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {/* Role list */}
      {roles.map(role => (
        <div key={role.id} className="rounded-aero-lg p-3" style={{ border: '1px solid var(--panel-divider)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: role.color }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{role.name}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>pos: {role.position}</span>
            </div>
            {!role.is_owner_role && role.position < myPosition && (
              <button onClick={() => handleDeleteRole(role.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!role.is_owner_role && role.position < myPosition && (
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(PERM_LABELS) as PermissionKey[]).map(perm => (
                <label key={perm} className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={role.permissions[perm]}
                    onChange={() => handleTogglePerm(role.id, perm, role.permissions[perm])}
                    style={{ accentColor: role.color }}
                  />
                  {PERM_LABELS[perm]}
                </label>
              ))}
            </div>
          )}
          {role.is_owner_role && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Owner role — all permissions, cannot be edited</p>
          )}
        </div>
      ))}
    </div>
  );
});
