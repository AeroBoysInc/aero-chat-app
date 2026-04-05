// src/store/serverRoleStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ServerRole, ServerRolePermissions, PermissionKey } from '../lib/serverTypes';

interface RoleWithPerms extends ServerRole {
  permissions: ServerRolePermissions;
}

interface ServerRoleStoreState {
  roles: RoleWithPerms[];
  loadRoles: (serverId: string) => Promise<void>;
  getMyPermissions: (serverId: string, userId: string, members: { user_id: string; role_id: string }[]) => ServerRolePermissions | null;
  hasPermission: (serverId: string, userId: string, members: { user_id: string; role_id: string }[], perm: PermissionKey) => boolean;
  reset: () => void;
}

const DEFAULT_PERMS: ServerRolePermissions = {
  role_id: '',
  manage_server: false, manage_roles: false, manage_bubbles: false,
  manage_members: false, send_invites: false, send_messages: false,
  pin_messages: false, start_calls: false,
};

export const useServerRoleStore = create<ServerRoleStoreState>()((set, get) => ({
  roles: [],

  loadRoles: async (serverId) => {
    const { data: rolesData } = await supabase
      .from('server_roles')
      .select('*, server_role_permissions(*)')
      .eq('server_id', serverId)
      .order('position', { ascending: false });

    if (rolesData) {
      const roles: RoleWithPerms[] = rolesData.map((r: any) => ({
        id: r.id,
        server_id: r.server_id,
        name: r.name,
        color: r.color,
        position: r.position,
        is_owner_role: r.is_owner_role,
        created_at: r.created_at,
        permissions: r.server_role_permissions ?? DEFAULT_PERMS,
      }));
      set({ roles });
    }
  },

  getMyPermissions: (_serverId, userId, members) => {
    const membership = members.find(m => m.user_id === userId);
    if (!membership) return null;
    const role = get().roles.find(r => r.id === membership.role_id);
    return role?.permissions ?? null;
  },

  hasPermission: (serverId, userId, members, perm) => {
    const perms = get().getMyPermissions(serverId, userId, members);
    return perms ? perms[perm] : false;
  },

  reset: () => set({ roles: [] }),
}));
