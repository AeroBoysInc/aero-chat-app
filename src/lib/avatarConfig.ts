// src/lib/avatarConfig.ts
// Avatar system configuration — base characters, item slots, layer order.

export interface AvatarBase {
  id: string;
  label: string;
  src: string; // path relative to public/, e.g. '/avatars/bases/flutter.png'
}

export const AVATAR_BASES: AvatarBase[] = [
  { id: 'flutter', label: 'Flutter', src: '/avatars/bases/flutter.png' },
];

export type ItemSlot = 'helmet' | 'armor' | 'weapon' | 'wings';

export interface EquippedItems {
  helmet?: string; // image path or undefined
  armor?: string;
  weapon?: string;
  wings?: string;
}

/** Layer order from back (index 0) to front (last). Base character is at index 2. */
export const LAYER_ORDER: readonly (ItemSlot | 'base')[] = [
  'weapon',  // z-index 1 — backmost
  'wings',   // z-index 2 — behind character
  'base',    // z-index 3 — the character itself
  'armor',   // z-index 4 — over body
  'helmet',  // z-index 5 — topmost
] as const;

/** Item slots only (excludes 'base'), for UI iteration. */
export const ITEM_SLOTS: readonly ItemSlot[] = ['helmet', 'armor', 'weapon', 'wings'] as const;

/** Get an AvatarBase by id, falling back to the first entry. */
export function getAvatarBase(id: string): AvatarBase {
  return AVATAR_BASES.find(b => b.id === id) ?? AVATAR_BASES[0];
}
