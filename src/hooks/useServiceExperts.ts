import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceExpertRow {
  id: string;
  service_id: string;
  staff_user_id: string;
}

const KEY = ['service-experts'] as const;

/** Loads ALL service<->expert mappings. Cheap (small table); we filter client-side. */
export const useServiceExperts = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ServiceExpertRow[]> => {
      const { data, error } = await supabase
        .from('service_experts' as never)
        .select('id, service_id, staff_user_id');
      if (error) throw error;
      return (data as unknown as ServiceExpertRow[]) ?? [];
    },
  });

/**
 * Replaces the eligible-expert list for a single service.
 * Performs a diff so we only insert/delete what changed.
 */
export const useSetServiceExperts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, staffIds }: { serviceId: string; staffIds: string[] }) => {
      const { data: existing, error: loadErr } = await supabase
        .from('service_experts' as never)
        .select('id, staff_user_id')
        .eq('service_id', serviceId);
      if (loadErr) throw loadErr;
      const current = (existing as unknown as { id: string; staff_user_id: string }[]) ?? [];
      const currentIds = new Set(current.map((r) => r.staff_user_id));
      const targetIds = new Set(staffIds);

      const toAdd = staffIds.filter((id) => !currentIds.has(id));
      const toRemove = current.filter((r) => !targetIds.has(r.staff_user_id));

      if (toAdd.length) {
        const { error: insErr } = await supabase
          .from('service_experts' as never)
          .insert(toAdd.map((sid) => ({ service_id: serviceId, staff_user_id: sid })) as never);
        if (insErr) throw insErr;
      }
      if (toRemove.length) {
        const { error: delErr } = await supabase
          .from('service_experts' as never)
          .delete()
          .in('id', toRemove.map((r) => r.id));
        if (delErr) throw delErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};