// src/components/servers/MemberList.tsx
import { memo } from 'react';
import { UserMinus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';

export const MemberList = memo(function MemberList() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members, loadServerData } = useServerStore();
  const { roles, hasPermission } = useServerRoleStore();

  const canManage = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'manage_members')
    : false;

  const myMembership = members.find(m => m.user_id === user?.id);
  const myRole = myMembership ? roles.find(r => r.id === myMembership.role_id) : null;
  const myPosition = myRole?.position ?? -1;

  const handleKick = async (userId: string) => {
    if (!selectedServerId) return;
    await supabase.from('server_members').delete().eq('server_id', selectedServerId).eq('user_id', userId);
    await loadServerData(selectedServerId);
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    if (!selectedServerId) return;
    await supabase.from('server_members').update({ role_id: roleId }).eq('server_id', selectedServerId).eq('user_id', userId);
    await loadServerData(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-2">
      {members.map(member => {
        const role = roles.find(r => r.id === member.role_id);
        const memberPosition = role?.position ?? 0;
        const canEdit = canManage && memberPosition < myPosition && member.user_id !== user?.id;

        return (
          <div key={member.user_id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
            <AvatarImage username={member.username ?? '?'} avatarUrl={member.avatar_url} size="sm" gifUrl={member.avatar_gif_url} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <AccentName
                  name={member.username ?? '?'}
                  accentColor={member.accent_color ?? null}
                  accentColorSecondary={member.accent_color_secondary ?? null}
                  nameEffect={member.name_effect ?? null}
                  animateOnHover={false}
                  style={{ fontSize: 12, fontWeight: 500 }}
                />
                <div className="flex items-center gap-1">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: role?.color }} />
                  <span style={{ fontSize: 9, color: role?.color }}>{role?.name}</span>
                </div>
              </div>
              {(member.custom_status_emoji || member.custom_status_text) && (
                <div style={{ marginTop: 1 }}>
                  <CustomStatusBadge emoji={member.custom_status_emoji ?? null} text={member.custom_status_text ?? null} size="sm" />
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <select
                  value={member.role_id}
                  onChange={e => handleRoleChange(member.user_id, e.target.value)}
                  className="rounded-aero px-2 py-1 text-xs"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  {roles.filter(r => r.position < myPosition && !r.is_owner_role).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button onClick={() => handleKick(member.user_id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
