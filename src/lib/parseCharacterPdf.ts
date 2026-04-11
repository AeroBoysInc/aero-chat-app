import * as pdfjsLib from 'pdfjs-dist';

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

/** Parse a number that may contain commas (e.g. "23,400" → 23400). */
function parseNum(text: string): number {
  return parseInt(text.replace(/,/g, ''), 10) || 0;
}

/**
 * Parse a D&D Beyond character sheet PDF and extract character data.
 *
 * D&D Beyond PDFs store all character data as PDF form fields (AcroForm
 * Widget annotations), NOT as regular text content.  We read annotations
 * from pages 1 & 2 and look up values by their standardised field names.
 */
export async function parseCharacterPdf(file: File): Promise<ParsedCharacter> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Collect all form-field annotations from pages 1 & 2
  const fields = new Map<string, string>();
  for (let p = 1; p <= Math.min(pdf.numPages, 2); p++) {
    const page = await pdf.getPage(p);
    const annots = await page.getAnnotations();
    for (const a of annots) {
      if (a.subtype === 'Widget' && a.fieldName && a.fieldValue != null) {
        // Normalise field name (trim, collapse whitespace)
        const key = (a.fieldName as string).trim().replace(/\s+/g, ' ');
        const val = String(a.fieldValue).trim();
        if (val && !fields.has(key)) fields.set(key, val);
      }
    }
  }

  // ── Helper: get a field value by name (exact or fuzzy) ──────
  function f(name: string): string {
    // Try exact (normalised) match first
    if (fields.has(name)) return fields.get(name)!;
    // Try case-insensitive
    const lower = name.toLowerCase();
    for (const [k, v] of fields) {
      if (k.toLowerCase() === lower) return v;
    }
    return '';
  }

  // ── Character Name ──────────────────────────────────────────
  const name = f('CharacterName') || f('CharacterName2') || 'Unknown';

  // ── Class & Level (e.g. "Barbarian 7") ──────────────────────
  let charClass = 'Unknown';
  let level = 1;
  const clRaw = f('CLASS LEVEL') || f('CLASS  LEVEL') || f('CLASS LEVEL2') || f('CLASS  LEVEL2');
  if (clRaw) {
    const m = clRaw.match(/^(.+?)\s+(\d+)$/);
    if (m) { charClass = m[1].trim(); level = parseInt(m[2], 10) || 1; }
    else charClass = clRaw;
  }

  // ── Species / Race ──────────────────────────────────────────
  const species = f('RACE') || f('RACE2') || f('SPECIES') || '';

  // ── Experience Points ───────────────────────────────────────
  const xpCurrent = parseNum(f('EXPERIENCE POINTS') || f('EXPERIENCE POINTS2'));
  const XP_TABLE = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000,
    64000, 85000, 100000, 120000, 140000, 165000, 195000,
    225000, 265000, 305000, 355000,
  ];
  const xpMax = XP_TABLE[level + 1] ?? 355000;

  // ── Ability Scores ──────────────────────────────────────────
  const stats = {
    str: parseNum(f('STR')) || 10,
    dex: parseNum(f('DEX')) || 10,
    con: parseNum(f('CON')) || 10,
    int: parseNum(f('INT')) || 10,
    wis: parseNum(f('WIS')) || 10,
    cha: parseNum(f('CHA')) || 10,
  };

  // ── Armor Class ─────────────────────────────────────────────
  const armorClass = parseNum(f('AC')) || 10;

  // ── Hit Points ──────────────────────────────────────────────
  const hpMax = parseNum(f('MaxHP')) || 0;
  const hpCurrent = parseNum(f('CurrentHP')) || hpMax;

  // ── Gold ────────────────────────────────────────────────────
  const gold = parseNum(f('GP'));

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
