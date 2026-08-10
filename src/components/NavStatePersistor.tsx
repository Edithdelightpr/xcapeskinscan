import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Mirrors the in-memory navigation slice (active stage / completed stages /
 * active staff perspective) to sessionStorage so a browser refresh restores
 * the user to the exact spot they were on. URL state already covers the
 * Admin section/tab — this covers the in-store bits that aren't in the URL.
 */
const KEY = 'tropics:nav:store-slice';

interface PersistedSlice {
  activeStage?: number;
  completedStages?: number[];
  activeStaffId?: string;
}

const NavStatePersistor = () => {
  const hydratedRef = useRef(false);

  // One-time hydrate on mount.
  useEffect(() => {
    if (hydratedRef.current || typeof window === 'undefined') return;
    hydratedRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSlice;
      const patch: PersistedSlice = {};
      if (typeof parsed.activeStage === 'number') patch.activeStage = parsed.activeStage;
      if (Array.isArray(parsed.completedStages)) patch.completedStages = parsed.completedStages;
      if (typeof parsed.activeStaffId === 'string') patch.activeStaffId = parsed.activeStaffId;
      if (Object.keys(patch).length > 0) {
        useAppStore.setState(patch as Partial<ReturnType<typeof useAppStore.getState>>);
      }
    } catch { /* noop */ }
  }, []);

  // Subscribe to changes and persist a tiny slice.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsub = useAppStore.subscribe((state) => {
      try {
        const slice: PersistedSlice = {
          activeStage: state.activeStage,
          completedStages: state.completedStages,
          activeStaffId: state.activeStaffId,
        };
        window.sessionStorage.setItem(KEY, JSON.stringify(slice));
      } catch { /* quota or disabled storage — ignore */ }
    });
    return () => { unsub(); };
  }, []);

  return null;
};

export default NavStatePersistor;