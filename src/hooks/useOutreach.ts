import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutreachTemplate {
  id: string;
  category: string;
  title: string;
  body: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachLog {
  id: string;
  client_id: string;
  staff_user_id: string | null;
  template_id: string | null;
  template_category: string | null;
  message_text: string;
  phone_number: string | null;
  status: string;
  clicked_at: string;
  sent_at: string | null;
  created_at: string;
}

const TEMPLATES_KEY = ['outreach-templates'] as const;
const LOGS_KEY = ['outreach-logs'] as const;

// Use a loose client cast — these tables aren't in the generated types yet.
const sb = supabase as unknown as {
  from: (table: string) => {
    select: (s: string) => {
      order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    insert: (rows: Record<string, unknown>) => {
      select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
    delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
};

export const useOutreachTemplates = () =>
  useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async (): Promise<OutreachTemplate[]> => {
      const { data, error } = await sb.from('outreach_templates').select('*').order('category', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as OutreachTemplate[] | null) ?? [];
    },
  });

export const useCreateOutreachTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; title: string; body: string; active?: boolean }) => {
      const { data, error } = await sb.from('outreach_templates').insert(input).select().single();
      if (error) throw new Error(error.message);
      return data as OutreachTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
};

export const useUpdateOutreachTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OutreachTemplate> }) => {
      const { data, error } = await sb.from('outreach_templates').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as OutreachTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
};

export const useDeleteOutreachTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('outreach_templates').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
};

export const useOutreachLogs = () =>
  useQuery({
    queryKey: LOGS_KEY,
    queryFn: async (): Promise<OutreachLog[]> => {
      const { data, error } = await sb.from('outreach_logs').select('*').order('clicked_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as OutreachLog[] | null) ?? [];
    },
  });

export const useCreateOutreachLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      staff_user_id: string | null;
      template_id: string | null;
      template_category: string | null;
      message_text: string;
      phone_number: string | null;
      status?: string;
    }) => {
      const payload = { status: 'clicked', ...input };
      const { data, error } = await sb.from('outreach_logs').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data as OutreachLog;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGS_KEY }),
  });
};

/**
 * Update an outreach log — most commonly to confirm "sent" or "not_sent" after a
 * staff member clicked the WhatsApp button. We never auto-mark sent.
 */
export const useUpdateOutreachLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OutreachLog> }) => {
      const { data, error } = await sb.from('outreach_logs').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as OutreachLog;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGS_KEY }),
  });
};