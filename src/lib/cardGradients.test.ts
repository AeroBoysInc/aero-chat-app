import { describe, it, expect } from 'vitest';
import { CARD_GRADIENTS } from './cardGradients';

describe('CARD_GRADIENTS', () => {
  it('exports an array with 6 entries', () => {
    expect(CARD_GRADIENTS).toHaveLength(6);
  });

  it('first entry has id ocean', () => {
    expect(CARD_GRADIENTS[0].id).toBe('ocean');
  });

  it('every entry has id, preview, and css fields', () => {
    for (const g of CARD_GRADIENTS) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.preview).toBe('string');
      expect(typeof g.css).toBe('string');
    }
  });
});
