import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set worker to bundled version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ParsedCharacter {
  name: string;
  species: string;
  class: string;
  level: number;
  hp_current: number;
  hp_max: number;
  xp_current: number;
  xp_max: number;
  gold: number;
  armor_class: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
}

/**
 * Parse a D&D character sheet PDF and extract character data.
 * Works with D&D Beyond exported PDFs. Returns best-effort extracted data.
 * Fields that cannot be parsed get default values.
 */
export async function parseCharacterPdf(file: File): Promise<ParsedCharacter> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Extract all text items from page 1 (character summary page)
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items
    .filter((item): item is TextItem => 'str' in item && (item as TextItem).str.trim() !== '')
    .map(item => ({
      text: item.str.trim(),
      x: (item.transform as number[])[4],
      y: (item.transform as number[])[5],
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x); // top-to-bottom, left-to-right

  const allText = items.map(i => i.text);

  // ── Name: typically the largest/first text item at the top
  const name = allText[0] ?? 'Unknown';

  // ── Helper: find a number near a label
  function findNumberNear(label: string): number {
    const idx = allText.findIndex(t => t.toLowerCase().includes(label.toLowerCase()));
    if (idx === -1) return 0;
    // Check surrounding items for a number
    for (let offset = -2; offset <= 2; offset++) {
      const candidate = allText[idx + offset];
      if (candidate && /^\d+$/.test(candidate)) return parseInt(candidate, 10);
    }
    return 0;
  }

  // ── Helper: find text near a label
  function findTextNear(label: string): string {
    const idx = allText.findIndex(t => t.toLowerCase().includes(label.toLowerCase()));
    if (idx === -1) return '';
    // The value is often the item just before or after the label
    for (const offset of [1, -1, 2, -2]) {
      const candidate = allText[idx + offset];
      if (candidate && !/^\d+$/.test(candidate) && candidate.toLowerCase() !== label.toLowerCase()) {
        return candidate;
      }
    }
    return '';
  }

  // ── Stats (D&D Beyond PDFs list these as label + score pairs)
  const stats = {
    str: findNumberNear('strength') || findNumberNear('str') || 10,
    dex: findNumberNear('dexterity') || findNumberNear('dex') || 10,
    con: findNumberNear('constitution') || findNumberNear('con') || 10,
    int: findNumberNear('intelligence') || findNumberNear('int') || 10,
    wis: findNumberNear('wisdom') || findNumberNear('wis') || 10,
    cha: findNumberNear('charisma') || findNumberNear('cha') || 10,
  };

  // ── Class & Level — often formatted as "Fighter 5" or "Level 5 Fighter"
  let charClass = '';
  let level = 1;
  const classLevelMatch = allText.find(t => /^[A-Z][a-z]+\s+\d+/.test(t));
  if (classLevelMatch) {
    const parts = classLevelMatch.match(/^([A-Za-z\s/]+?)\s+(\d+)$/);
    if (parts) {
      charClass = parts[1].trim();
      level = parseInt(parts[2], 10) || 1;
    }
  }
  if (!charClass) {
    charClass = findTextNear('class') || 'Unknown';
    level = findNumberNear('level') || 1;
  }

  // ── Species
  const species = findTextNear('race') || findTextNear('species') || '';

  // ── HP
  const hpMax = findNumberNear('hit point maximum') || findNumberNear('hp') || 0;
  const hpCurrent = findNumberNear('current hit points') || hpMax;

  // ── AC
  const armorClass = findNumberNear('armor class') || findNumberNear('ac') || 10;

  // ── XP
  const xpCurrent = findNumberNear('experience points') || findNumberNear('xp') || 0;

  // XP thresholds by level (5e)
  const XP_TABLE = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const xpMax = XP_TABLE[level + 1] ?? 355000;

  // ── Gold — may not be on the first page
  const gold = findNumberNear('gold') || findNumberNear('gp') || 0;

  return {
    name,
    species,
    class: charClass,
    level,
    hp_current: hpCurrent,
    hp_max: hpMax,
    xp_current: xpCurrent,
    xp_max: xpMax,
    gold,
    armor_class: armorClass,
    stats,
  };
}
