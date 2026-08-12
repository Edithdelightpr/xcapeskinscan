/**
 * P2.1: resuming a public session (or switching capture mode) must never ask
 * for a view that is already final server-side. The staff guided scan passes
 * no `skipViews` and must keep its historical front → left → right order.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGuidedCapture } from './useGuidedCapture';
import { SCAN_VIEWS } from '@/lib/scan/scanQuality';

describe('useGuidedCapture skipViews', () => {
  it('staff flow (no skipViews) still starts at the first view', () => {
    const { result } = renderHook(() => useGuidedCapture({ active: false }));
    expect(result.current.currentView).toBe(SCAN_VIEWS[0].id);
    expect(result.current.viewIndex).toBe(0);
  });

  it('starts at the first outstanding view after a resume', () => {
    const { result } = renderHook(() =>
      useGuidedCapture({ active: false, skipViews: ['front'] }),
    );
    expect(result.current.currentView).toBe('left');
  });

  it('skips a view verified in the other capture mode', () => {
    const { result } = renderHook(() =>
      useGuidedCapture({ active: false, skipViews: ['front', 'left'] }),
    );
    expect(result.current.currentView).toBe('right');
  });

  it('does not crash when every view is already verified', () => {
    const { result } = renderHook(() =>
      useGuidedCapture({ active: false, skipViews: ['front', 'left', 'right'] }),
    );
    expect(SCAN_VIEWS.map((v) => v.id)).toContain(result.current.currentView);
  });
});
