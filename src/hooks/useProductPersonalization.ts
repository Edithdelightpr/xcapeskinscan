import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PersonalizationAnswers {
  concerns?: string[];
  concern_other?: string;
  duration?: string;
  skin_feel?: string;
  symptoms?: string[];
  symptoms_other?: string;
  current_products?: string;
  past_reaction?: string;
  past_reaction_details?: string;
  practitioner_notes?: string[];
}

export interface PersonalizationRequest {
  id: string;
  client_id: string | null;
  source: string;
  page_path: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  preferred_contact: 'whatsapp' | 'phone' | 'email';
  answers: PersonalizationAnswers;
  consent_given: boolean;
  status: string;
  staff_notes: string | null;
  created_at: string;
}

export const PERSONALIZATION_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'closed', label: 'Closed' },
] as const;

export const usePersonalizationRequests = () =>
  useQuery({
    queryKey: ['personalization-requests'],
    queryFn: async (): Promise<PersonalizationRequest[]> => {
      const { data, error } = await supabase
        .from('product_personalization_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as PersonalizationRequest[];
    },
  });

export const useUpdatePersonalizationRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: string; staff_notes?: string }) => {
      const patch: { status?: string; staff_notes?: string } = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.staff_notes !== undefined) patch.staff_notes = input.staff_notes;
      const { error } = await supabase
        .from('product_personalization_requests')
        .update(patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personalization-requests'] }),
  });
};

/** Public submit — goes through the edge function (never a direct insert). */
export const submitPersonalizationRequest = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('public-submit-personalization', {
    body: payload,
  });
  if (error) throw new Error('Could not submit your request. Please try again.');
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as { ok: true; id?: string; duplicate?: boolean };
};
