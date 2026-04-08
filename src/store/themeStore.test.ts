import { describe, it, expect } from 'vitest';
import { getThemeTier } from './themeStore';

describe('getThemeTier', () => {
  it('maps free themes to free', () => {
    expect(getThemeTier('day')).toBe('free');
    expect(getThemeTier('night')).toBe('free');
  });

  it('maps premium themes to premium', () => {
    expect(getThemeTier('ocean')).toBe('premium');
    expect(getThemeTier('sunset')).toBe('premium');
    expect(getThemeTier('aurora')).toBe('premium');
    expect(getThemeTier('sakura')).toBe('premium');
  });

  it('maps ultra themes to ultra', () => {
    expect(getThemeTier('john-frutiger')).toBe('ultra');
    expect(getThemeTier('golden-hour')).toBe('ultra');
  });

  it('maps master theme to master', () => {
    expect(getThemeTier('master')).toBe('master');
  });
});
