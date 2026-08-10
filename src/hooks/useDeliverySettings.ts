import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliverySettings {
  enabled: boolean;
  fee: number;
  free_threshold: number | null;
  pickup_enabled: boolean;
  label: string;
  note: string;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  enabled: false,
  fee: 0,
  free_threshold: null,
  pickup_enabled: true,
  label: 'Delivery fee',
  note: '',
};

const KEY = ['site-settings', 'delivery'] as const;

function normalize(raw: unknown): DeliverySettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (x: unknown, d = 0) => {
    const n = typeof x === 'string' ? Number(x) : (x as number);
    return Number.isFinite(n) ? Number(n) : d;
  };
  const threshold = v.free_threshold;
  return {
    enabled: Boolean(v.enabled),
    fee: Math.max(0, num(v.fee, 0)),
    free_threshold:
      threshold === null || threshold === undefined || threshold === ''
        ? null
        : Math.max(0, num(threshold, 0)),
    pickup_enabled: v.pickup_enabled === undefined ? true : Boolean(v.pickup_enabled),
    label: typeof v.label === 'string' && v.label.trim() ? v.label : 'Delivery fee',
    note: typeof v.note === 'string' ? v.note : '',
  };
}

export function useDeliverySettings() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<DeliverySettings> => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'delivery')
        .maybeSingle();
      if (error) throw error;
      return normalize(data?.value);
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (patch: DeliverySettings) => {
      const clean = normalize(patch);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = clean as any;
      const { error } = await supabase
        .from('site_settings')
        .upsert([{ key: 'delivery', value }], { onConflict: 'key' });
      if (error) throw error;
      return clean;
    },
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });

  return {
    settings: query.data ?? DEFAULT_DELIVERY_SETTINGS,
    isLoading: query.isLoading,
    error: query.error,
    save,
  };
}

export function computeDeliveryFee(subtotal: number, s: DeliverySettings, method: 'delivery' | 'pickup') {
  if (!s.enabled || method !== 'delivery') return 0;
  if (s.free_threshold !== null && subtotal >= s.free_threshold) return 0;
  return Math.max(0, s.fee);
}