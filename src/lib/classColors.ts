// src/lib/classColors.ts

/** D&D class → color mapping for portrait borders and stat highlighting */
export const CLASS_COLORS: Record<string, string> = {
  barbarian: '#e53935',
  bard:      '#AB47BC',
  cleric:    '#FFD54F',
  druid:     '#66BB6A',
  fighter:   '#795548',
  monk:      '#00ACC1',
  paladin:   '#FFB74D',
  ranger:    '#4CAF50',
  rogue:     '#78909C',
  sorcerer:  '#EF5350',
  warlock:   '#7E57C2',
  wizard:    '#42A5F5',
  artificer: '#8D6E63',
  'blood hunter': '#C62828',
};

/** Get the class color for a character. Uses the first class for multiclass. */
export function getClassColor(className: string): string {
  const first = className.split(',')[0].split('/')[0].trim().toLowerCase();
  return CLASS_COLORS[first] ?? '#D2691E'; // fallback to medieval brown
}
