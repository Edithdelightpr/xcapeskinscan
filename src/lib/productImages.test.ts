import { describe, expect, it } from 'vitest';
import { productCutout } from './productImages';

describe('productCutout', () => {
  it('prefers the local transparent cutout over the catalogue packshot', () => {
    const src = productCutout('XCAPE Face Cream', 'https://cdn.example/gold-bg.jpg');
    expect(src).toBeTruthy();
    expect(src).not.toContain('gold-bg');
  });

  it('matches body milk and add-on products by name', () => {
    for (const n of [
      'XCAPE Body Milk',
      'XCAPE Purifying Cleanser',
      'XCAPE Alcohol Free Toner',
      'XCAPE Advanced Serum',
      'XCAPE Treatment Glycerine',
    ]) {
      expect(productCutout(n, null)).toBeTruthy();
    }
  });

  it('falls back to the catalogue image for unknown products', () => {
    expect(productCutout('Unknown Thing', 'https://cdn.example/x.jpg')).toBe(
      'https://cdn.example/x.jpg',
    );
    expect(productCutout(null, null)).toBeNull();
  });
});
