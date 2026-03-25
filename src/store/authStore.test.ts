import { describe, it, expect } from 'vitest';
import type { Profile } from './authStore';

describe('Profile type', () => {
  it('accepts card_gradient, card_image_url, card_image_params fields', () => {
    // Compile-time test: if Profile type is missing fields, TypeScript will error
    const p: Profile = {
      id: '1',
      username: 'alice',
      public_key: 'pk',
      card_gradient: 'ocean',
      card_image_url: null,
      card_image_params: { zoom: 1.5, x: 50, y: 50 },
    };
    expect(p.card_gradient).toBe('ocean');
    expect(p.card_image_params?.zoom).toBe(1.5);
  });
});
