// src/lib/pinTypePresets.ts

export interface PinTypePreset {
  key: string;
  emoji: string;
  color: string;
  label: string;
}

export const PIN_TYPE_PRESETS: PinTypePreset[] = [
  { key: 'city',     emoji: '🏰', color: '#FFD700', label: 'City / Capital' },
  { key: 'town',     emoji: '🏘️', color: '#D4A87A', label: 'Town / Village' },
  { key: 'dungeon',  emoji: '⚔️', color: '#E05050', label: 'Dungeon' },
  { key: 'forest',   emoji: '🌲', color: '#66CC66', label: 'Forest / Wilderness' },
  { key: 'tavern',   emoji: '🍺', color: '#FFAA33', label: 'Tavern / Inn' },
  { key: 'temple',   emoji: '🏛️', color: '#AA99EE', label: 'Temple / Shrine' },
  { key: 'mountain', emoji: '⛰️', color: '#AAAAAA', label: 'Mountain / Cave' },
  { key: 'port',     emoji: '⚓', color: '#55BBEE', label: 'Port / Harbor' },
  { key: 'camp',     emoji: '🏕️', color: '#CC8844', label: 'Camp / Outpost' },
  { key: 'ruins',    emoji: '🏚️', color: '#998866', label: 'Ruins' },
  { key: 'lake',     emoji: '🌊', color: '#4488CC', label: 'Lake / River' },
  { key: 'custom',   emoji: '📍', color: '#00B4FF', label: 'Custom' },
];

export const PIN_TYPE_MAP = Object.fromEntries(
  PIN_TYPE_PRESETS.map(p => [p.key, p])
) as Record<string, PinTypePreset>;
