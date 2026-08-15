import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_PUBLIC_APP_URL } from '@/lib/publicAppUrl';

const root = resolve(__dirname, '../../..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'),
) as Record<string, any>;
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('PWA manifest identity', () => {
  it('keeps a stable, route-independent app id/start_url/scope', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('resolves same-origin against the canonical production origin', () => {
    for (const key of ['id', 'start_url', 'scope'] as const) {
      const url = new URL(manifest[key], CANONICAL_PUBLIC_APP_URL);
      expect(url.origin).toBe(CANONICAL_PUBLIC_APP_URL);
      expect(url.host).not.toContain('preview');
      expect(url.host).not.toContain('localhost');
    }
  });

  it('references icon files that actually exist, in both any and maskable', () => {
    const icons = manifest.icons as Array<{ src: string; sizes: string; purpose: string }>;
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(existsSync(resolve(root, 'public', icon.src.slice(1)))).toBe(true);
    }
    for (const purpose of ['any', 'maskable']) {
      for (const size of ['192x192', '512x512']) {
        expect(icons.some((i) => i.purpose === purpose && i.sizes === size)).toBe(true);
      }
    }
  });

  it('links the manifest and icons from index.html before React loads', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).toContain('name="theme-color"');
    const manifestIdx = indexHtml.indexOf('manifest.webmanifest');
    const scriptIdx = indexHtml.indexOf('/src/main.tsx');
    expect(manifestIdx).toBeGreaterThan(-1);
    expect(manifestIdx).toBeLessThan(scriptIdx);
  });
});
