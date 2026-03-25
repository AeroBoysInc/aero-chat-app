import { describe, it, expect } from 'vitest';
import type { Profile } from './authStore';

describe('friendStore profile spread', () => {
  it('Profile type includes card fields for spread compatibility', () => {
    // A profile update coming from payload.new should be spreadable onto a friend entry
    const existing: Profile = { id: '1', username: 'alice', public_key: 'pk' };
    const updated: Profile = {
      id: '1',
      username: 'alice',
      public_key: 'pk',
      card_gradient: 'sunset',
      card_image_url: 'https://example.com/card.jpg',
      card_image_params: { zoom: 1.2, x: 40, y: 60 },
    };
    const merged = { ...existing, ...updated };
    expect(merged.card_gradient).toBe('sunset');
    expect(merged.card_image_url).toBe('https://example.com/card.jpg');
  });
});
