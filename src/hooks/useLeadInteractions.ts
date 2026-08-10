import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type LeadInteraction = Database['public']['Tables']['lead_interactions']['Row'];
export type LeadInteractionInsert = Database['public']['Tables']['lead_interactions']['Insert'];

export const INTERACTION_METHODS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Phone Call' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'in_person', label: 'In-Person' },
  { id: 'outreach', label: 'Outreach Event' },
  { id: 'dm', label: 'Social DM' },
  { id: 'other', label: 'Other' },
] as const;

export const INTERACTION_OUTCOMES = [
  { id: 'no_response', label: 'No Response' },
  { id: 'reached', label: 'Reached' },
  { id: 'interested', label: 'Interested' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'follow_up', label: 'Follow-up Needed' },
  { id: 'booked', label: 'Booked' },
  { id: 'converted', label: 'Converted' },
  { id: 'closed', label: 'Closed' },
  { id: 'other', label: 'Other' },
] as const;

export const useLeadInteractions = (clientId: string | undefined) =>
  useQuery({
    queryKey: ['lead-interactions', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<LeadInteraction[]> => {
      const { data, error } = await supabase
        .from('lead_interactions')
        .select('*')
        .eq('client_id', clientId!)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateLeadInteraction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadInteractionInsert) => {
      const { data, error } = await supabase
        .from('lead_interactions')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as LeadInteraction;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-interactions', vars.client_id] });
      qc.invalidateQueries({ queryKey: ['real-clients'] });
    },
  });
};

/** Returns hours since the most recent touch (interaction or creation). */
export const hoursSinceTouch = (
  lastInteractionAt: string | null | undefined,
  createdAt: string,
): number => {
  const ts = lastInteractionAt ?? createdAt;
  return (Date.now() - new Date(ts).getTime()) / 3_600_000;
};

/** Stale = early-stage lead with no touch in 48h. */
export const isStaleLead = (
  pipelineStage: string | null | undefined,
  lastInteractionAt: string | null | undefined,
  createdAt: string,
): boolean => {
  if (!pipelineStage) return false;
  if (!['new', 'contacted', 'interested'].includes(pipelineStage)) return false;
  return hoursSinceTouch(lastInteractionAt, createdAt) >= 48;
};