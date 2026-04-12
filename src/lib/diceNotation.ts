// src/lib/diceNotation.ts — parsing + rolling /roll commands

export interface DiceRollPayload {
  _dndRoll: true;
  expression: string;
  dice: number[];
  sides: number;
  modifier: number;
  total: number;
}

export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
  expression: string;
}

/**
 * Parse dice notation: "NdX", "NdX+M", "NdX-M", "dX" (shorthand for 1dX).
 * Returns null if input is invalid.
 */
export function parseDiceNotation(input: string): ParsedDice | null {
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;
  if (count < 1 || count > 100) return null;
  if (sides < 2 || sides > 1000) return null;
  const expression = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ''}`;
  return { count, sides, modifier, expression };
}

/** Parse a `/roll ...` command; returns parsed dice or null if not a roll command / invalid. */
export function parseRollCommand(text: string): ParsedDice | null {
  const t = text.trim();
  if (!/^\/roll\b/i.test(t)) return null;
  const rest = t.replace(/^\/roll\s*/i, '');
  if (!rest) return null;
  return parseDiceNotation(rest);
}

/** Roll dice according to parsed notation. */
export function rollDice(parsed: ParsedDice): DiceRollPayload {
  const dice: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    dice.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  const sum = dice.reduce((a, b) => a + b, 0);
  return {
    _dndRoll: true,
    expression: parsed.expression,
    dice,
    sides: parsed.sides,
    modifier: parsed.modifier,
    total: sum + parsed.modifier,
  };
}

/** Detect + parse a roll payload stored as JSON in a message content string. */
export function parseDiceRollMessage(content: string): DiceRollPayload | null {
  try {
    const p = JSON.parse(content);
    if (p && p._dndRoll === true) return p as DiceRollPayload;
  } catch { /* not JSON */ }
  return null;
}

export function isDiceRollMessage(content: string): boolean {
  return parseDiceRollMessage(content) !== null;
}

/** HSL colour for a die result: red (low) → yellow (mid) → green (high). */
export function dieColor(value: number, sides: number): string {
  if (sides <= 1) return 'hsl(60, 70%, 50%)';
  const t = (value - 1) / (sides - 1);
  const hue = t * 120; // 0 = red, 120 = green
  return `hsl(${hue}, 75%, 50%)`;
}
