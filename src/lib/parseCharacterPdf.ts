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

// ── Internal types ────────────────────────────────────────────

interface PdfItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

// ── Helpers ───────────────────────────────────────────────────

/** Parse a number that may contain commas (e.g. "23,400" → 23400). */
function parseNum(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  return /^\d+$/.test(cleaned) ? parseInt(cleaned, 10) : null;
}

/** Find an item whose text exactly equals `label` (case-insensitive). */
function findLabel(items: PdfItem[], label: string): PdfItem | null {
  const lower = label.toLowerCase();
  return items.find(i => i.text.toLowerCase() === lower) ?? null;
}

/**
 * Find the nearest item to (ax, ay) that satisfies `pred`,
 * within `maxDist` PDF units.
 */
function findNearest(
  items: PdfItem[],
  ax: number,
  ay: number,
  pred: (i: PdfItem) => boolean,
  maxDist = 120,
): PdfItem | null {
  let best: PdfItem | null = null;
  let bestD = Infinity;
  for (const item of items) {
    if (!pred(item)) continue;
    const d = Math.hypot(item.x - ax, item.y - ay);
    if (d < maxDist && d < bestD) { best = item; bestD = d; }
  }
  return best;
}

/**
 * D&D Beyond puts field values ABOVE their labels.
 * Find the nearest non-label text item above `labelText`.
 */
function findValueAbove(items: PdfItem[], labelText: string, maxDist = 100): string | null {
  const label = findLabel(items, labelText);
  if (!label) return null;
  const hit = findNearest(items, label.x, label.y, i =>
    i !== label &&
    i.y > label.y &&                    // above in PDF coords (y increases upward)
    Math.abs(i.x - label.x) < 120 &&   // roughly same column
    i.text.length > 0,
  maxDist);
  return hit?.text ?? null;
}

/**
 * Ability scores: find the large-font score number directly below the
 * ability label (STRENGTH, DEXTERITY, etc.).  Modifiers like "+3" are
 * excluded because they contain a sign character.
 */
function findAbilityScore(items: PdfItem[], abilityName: string): number {
  const label = findLabel(items, abilityName);
  if (!label) return 10;

  const candidates: { val: number; fontSize: number; dist: number }[] = [];
  for (const item of items) {
    if (item === label) continue;
    const num = parseNum(item.text);
    if (num === null || num < 1 || num > 30) continue;  // valid ability score range
    if (item.y >= label.y) continue;           // must be below label
    if (Math.abs(item.x - label.x) > 40) continue;  // tight horizontal alignment
    const dist = Math.hypot(item.x - label.x, item.y - label.y);
    if (dist < 80) candidates.push({ val: num, fontSize: item.fontSize, dist });
  }
  if (!candidates.length) return 10;

  // Prefer larger font (score vs modifier), then closer
  candidates.sort((a, b) => {
    const fs = b.fontSize - a.fontSize;
    if (Math.abs(fs) > 1) return fs;
    return a.dist - b.dist;
  });
  return candidates[0].val;
}

// ── Main parser ───────────────────────────────────────────────

/**
 * Parse a D&D Beyond character sheet PDF and extract character data.
 * Uses spatial (x, y) proximity to match labels with their values.
 * Fields that cannot be parsed get sensible defaults.
 */
export async function parseCharacterPdf(file: File): Promise<ParsedCharacter> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Extract text items from pages 1 & 2 (page 2 has gold / equipment)
  const PAGE_OFFSET = 10_000;
  const allItems: PdfItem[] = [];

  for (let p = 1; p <= Math.min(pdf.numPages, 2); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const ti = raw as TextItem;
      const text = ti.str.trim();
      if (!text) continue;
      const tf = ti.transform as number[];
      allItems.push({
        text,
        x: tf[4],
        y: tf[5] - (p === 2 ? PAGE_OFFSET : 0),
        fontSize: Math.abs(tf[0]),
      });
    }
  }

  // Page-1-only items for most fields
  const p1 = allItems.filter(i => i.y > -PAGE_OFFSET / 2);

  // ── Character Name ──────────────────────────────────────────
  const name = findValueAbove(p1, 'CHARACTER NAME') ?? 'Unknown';

  // ── Class & Level (e.g. "Barbarian 7") ──────────────────────
  let charClass = 'Unknown';
  let level = 1;
  const clRaw = findValueAbove(p1, 'CLASS & LEVEL');
  if (clRaw) {
    const m = clRaw.match(/^(.+?)\s+(\d+)$/);
    if (m) { charClass = m[1].trim(); level = parseInt(m[2], 10) || 1; }
    else charClass = clRaw;
  }

  // ── Species ─────────────────────────────────────────────────
  const species = findValueAbove(p1, 'SPECIES')
    ?? findValueAbove(p1, 'RACE')
    ?? '';

  // ── Experience Points (may have commas) ─────────────────────
  const xpRaw = findValueAbove(p1, 'EXPERIENCE POINTS');
  const xpCurrent = xpRaw ? (parseNum(xpRaw) ?? 0) : 0;
  const XP_TABLE = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000,
    64000, 85000, 100000, 120000, 140000, 165000, 195000,
    225000, 265000, 305000, 355000,
  ];
  const xpMax = XP_TABLE[level + 1] ?? 355000;

  // ── Ability Scores ──────────────────────────────────────────
  const stats = {
    str: findAbilityScore(p1, 'STRENGTH'),
    dex: findAbilityScore(p1, 'DEXTERITY'),
    con: findAbilityScore(p1, 'CONSTITUTION'),
    int: findAbilityScore(p1, 'INTELLIGENCE'),
    wis: findAbilityScore(p1, 'WISDOM'),
    cha: findAbilityScore(p1, 'CHARISMA'),
  };

  // ── Armor Class ─────────────────────────────────────────────
  // D&D Beyond renders "ARMOR" and "CLASS" as separate text items
  let armorClass = 10;
  const armorLabel = findLabel(p1, 'ARMOR');
  if (armorLabel) {
    const acItem = findNearest(p1, armorLabel.x, armorLabel.y, i => {
      if (i === armorLabel) return false;
      const n = parseNum(i.text);
      return n !== null && n >= 5 && n <= 30;
    }, 100);
    if (acItem) armorClass = parseNum(acItem.text) ?? 10;
  }

  // ── Hit Points ──────────────────────────────────────────────
  let hpMax = 0;
  let hpCurrent = 0;

  const maxLabel = findLabel(p1, 'Max HP');
  if (maxLabel) {
    const hit = findNearest(p1, maxLabel.x, maxLabel.y, i =>
      i !== maxLabel && parseNum(i.text) !== null, 80);
    hpMax = hit ? (parseNum(hit.text) ?? 0) : 0;
  }

  const curLabel = findLabel(p1, 'Current HP');
  if (curLabel) {
    const hit = findNearest(p1, curLabel.x, curLabel.y, i =>
      i !== curLabel && parseNum(i.text) !== null, 80);
    hpCurrent = hit ? (parseNum(hit.text) ?? 0) : hpMax;
  } else {
    hpCurrent = hpMax;
  }

  // ── Gold (page 2 currency section, near "GP" label) ────────
  let gold = 0;
  const gpLabel = allItems.find(i => i.text === 'GP');
  if (gpLabel) {
    const hit = findNearest(allItems, gpLabel.x, gpLabel.y, i =>
      i !== gpLabel && parseNum(i.text) !== null, 80);
    gold = hit ? (parseNum(hit.text) ?? 0) : 0;
  }

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
