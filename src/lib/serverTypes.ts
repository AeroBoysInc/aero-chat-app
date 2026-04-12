// src/lib/serverTypes.ts

export interface Server {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  member_cap: number;
  created_at: string;
  updated_at: string;
}

export interface ServerRole {
  id: string;
  server_id: string;
  name: string;
  color: string;
  position: number;
  is_owner_role: boolean;
  created_at: string;
}

export interface ServerRolePermissions {
  role_id: string;
  manage_server: boolean;
  manage_roles: boolean;
  manage_bubbles: boolean;
  manage_members: boolean;
  send_invites: boolean;
  send_messages: boolean;
  pin_messages: boolean;
  start_calls: boolean;
  dungeon_master: boolean;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role_id: string;
  joined_at: string;
  // Joined from profiles:
  username?: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;
  card_image_url?: string | null;
  card_image_params?: any;
  // Identity fields:
  bio?: string | null;
  custom_status_text?: string | null;
  custom_status_emoji?: string | null;
  accent_color?: string | null;
  accent_color_secondary?: string | null;
  banner_gradient?: string | null;
  banner_image_url?: string | null;
  card_effect?: string | null;
  avatar_gif_url?: string | null;
  name_effect?: string | null;
}

export interface Bubble {
  id: string;
  server_id: string;
  name: string;
  color: string;
  restricted_to_roles: string[];
  created_at: string;
}

export interface BubbleMessage {
  id: string;
  bubble_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ServerInvite {
  id: string;
  server_id: string;
  created_by: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

export interface ServerToolkit {
  server_id: string;
  toolkit_id: string;
  activated_by: string;
  activated_at: string;
}

export interface DndCharacter {
  id: string;
  server_id: string;
  user_id: string;
  name: string;
  species: string;
  class: string;
  level: number;
  portrait_url: string | null;
  background_url: string | null;
  hp_current: number;
  hp_max: number;
  xp_current: number;
  xp_max: number;
  gold: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  armor_class: number;
  created_at: string;
}

export interface DndMap {
  id: string;
  server_id: string;
  name: string;
  image_url: string;
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface DndMapPin {
  id: string;
  map_id: string;
  x: number;
  y: number;
  pin_type: string;
  emoji: string;
  name: string;
  subtitle: string;
  description: Record<string, unknown>;
  header_image_url: string | null;
  color: string;
  created_by: string;
  created_at: string;
}

export interface DndMapVisibility {
  id: string;
  map_id: string;
  target_type: 'role' | 'member';
  target_id: string;
}

export type PermissionKey = keyof Omit<ServerRolePermissions, 'role_id'>;
