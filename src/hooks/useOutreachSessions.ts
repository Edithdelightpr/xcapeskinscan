import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type OutreachStatus =
  | 'draft'
  | 'submitted_for_approval'
  | 'approved'
  | 'ready_to_start'
  | 'active'
  | 'completed'
  | 'reconciliation_pending'
  | 'reconciled'
  | 'closed'
  | 'cancelled'
  | 'planned';
export type OutreachType = 'community' | 'event' | 'market' | 'clinic' | 'partner' | 'other';
export type OutreachRole = 'initiator' | 'sales' | 'capture' | 'logistics' | 'driver' | 'support' | 'medic' | 'other';
export type RewardStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface OutreachSession {
  id: string;
  name: string;
  location: string | null;
  outreach_date: string;
  outreach_type: OutreachType;
  status: OutreachStatus;
  initiator_staff_id: string | null;
  expected_attendance: number | null;
  notes: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  total_leads: number;
  total_revenue: number;
  total_cogs: number;
  total_op_expense: number;
  net_profit: number;
  reward_amount: number;
  created_at: string;
  updated_at: string;
  start_time: string | null;
  end_time: string | null;
  objective: string | null;
  public_intake_enabled: boolean;
  intake_slug: string | null;
  venue_contact_name?: string | null;
  venue_contact_phone?: string | null;
  coordinator_user_id?: string | null;
  skin_analyst_user_id?: string | null;
  capture_lead_user_id?: string | null;
  product_handler_user_id?: string | null;
  logistics_user_id?: string | null;
  closer_user_id?: string | null;
  follow_up_owner_user_id?: string | null;
  expected_leads?: number | null;
  expected_sales?: number | null;
  expected_bookings?: number | null;
  expected_analyses?: number | null;
  estimated_budget?: number | null;
  equipment_list?: string[] | null;
  materials_list?: string[] | null;
  resources_not_required?: boolean;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  submitted_at?: string | null;
  submitted_by_user_id?: string | null;
  closed_at?: string | null;
  closed_by_user_id?: string | null;
}

export interface OutreachAssignedStaff {
  id: string;
  outreach_id: string;
  staff_user_id: string;
  role_in_outreach: OutreachRole;
  reward_share_percent: number;
  created_at: string;
}

export interface OutreachReward {
  id: string;
  outreach_id: string;
  beneficiary_staff_id: string;
  basis_amount: number;
  percent: number;
  amount: number;
  status: RewardStatus;
  finance_entry_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const sb = supabase as any;

export const useOutreachSessions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-sessions'],
    enabled: !!user,
    queryFn: async (): Promise<OutreachSession[]> => {
      const { data, error } = await sb.from('outreach_sessions').select('*')
        .order('outreach_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachSession[];
    },
  });
};

export const useOutreachSession = (id?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-session', id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<OutreachSession | null> => {
      const { data, error } = await sb.from('outreach_sessions').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as OutreachSession | null;
    },
  });
};

export const useOutreachCrew = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-crew', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async (): Promise<OutreachAssignedStaff[]> => {
      const { data, error } = await sb.from('outreach_assigned_staff').select('*')
        .eq('outreach_id', outreachId).order('created_at');
      if (error) throw error;
      return (data ?? []) as OutreachAssignedStaff[];
    },
  });
};

export const useOutreachRewards = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-rewards', outreachId ?? 'all'],
    enabled: !!user,
    queryFn: async (): Promise<OutreachReward[]> => {
      let q = sb.from('outreach_rewards').select('*').order('created_at', { ascending: false });
      if (outreachId) q = q.eq('outreach_id', outreachId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OutreachReward[];
    },
  });
};

export const useOutreachLeads = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-leads', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async () => {
      const { data, error } = await sb.from('clients')
        .select('id, full_name, phone, email, created_at, attributed_staff_id, captured_via')
        .eq('outreach_id', outreachId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useOutreachDistributionRuns = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-runs', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async () => {
      const { data, error } = await sb.from('distribution_runs').select('*')
        .eq('outreach_id', outreachId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useOutreachExpenses = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-expenses', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async () => {
      const { data, error } = await sb.from('finance_entries')
        .select('id, kind, category, amount, date, notes, attributed_staff_id, created_at')
        .eq('outreach_id', outreachId)
        .eq('status', 'active')
        .order('date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

const invalidateAll = (qc: ReturnType<typeof useQueryClient>, outreachId?: string) => {
  qc.invalidateQueries({ queryKey: ['outreach-sessions'] });
  if (outreachId) {
    qc.invalidateQueries({ queryKey: ['outreach-session', outreachId] });
    qc.invalidateQueries({ queryKey: ['outreach-crew', outreachId] });
    qc.invalidateQueries({ queryKey: ['outreach-rewards', outreachId] });
    qc.invalidateQueries({ queryKey: ['outreach-leads', outreachId] });
    qc.invalidateQueries({ queryKey: ['outreach-runs', outreachId] });
    qc.invalidateQueries({ queryKey: ['outreach-expenses', outreachId] });
  }
  qc.invalidateQueries({ queryKey: ['outreach-rewards', 'all'] });
};

export const useCreateOutreachSession = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      location?: string;
      outreach_date?: string;
      outreach_type?: OutreachType;
      initiator_staff_id?: string | null;
      expected_attendance?: number | null;
      notes?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      objective?: string | null;
      public_intake_enabled?: boolean;
    }) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await sb.from('outreach_sessions').insert({
        name: input.name,
        location: input.location ?? null,
        outreach_date: input.outreach_date ?? new Date().toISOString().slice(0, 10),
        outreach_type: input.outreach_type ?? 'community',
        initiator_staff_id: input.initiator_staff_id ?? user.id,
        expected_attendance: input.expected_attendance ?? null,
        notes: input.notes ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        objective: input.objective ?? null,
        public_intake_enabled: input.public_intake_enabled ?? true,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      // Auto-add initiator to crew at 100% share
      if (data?.initiator_staff_id) {
        await sb.from('outreach_assigned_staff').insert({
          outreach_id: data.id,
          staff_user_id: data.initiator_staff_id,
          role_in_outreach: 'initiator',
          reward_share_percent: 100,
        });
      }
      return data.id as string;
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Outreach created' }); },
    onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
  });
};

/**
 * Admin-only one-click launch: create an outreach with just a name and
 * immediately transition it to `active` so the crew can start capturing
 * intake right away. All other fields fall back to sensible defaults
 * (today's date, community type, current admin as initiator).
 */
export const useQuickLaunchOutreach = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      if (!user) throw new Error('Not signed in');
      const name = input.name.trim();
      if (!name) throw new Error('Name is required');
      const today = new Date().toISOString().slice(0, 10);
      const { data: created, error: createErr } = await sb.from('outreach_sessions').insert({
        name,
        outreach_date: today,
        outreach_type: 'community',
        initiator_staff_id: user.id,
        public_intake_enabled: true,
        resources_not_required: true,
        created_by: user.id,
        status: 'active',
        started_at: new Date().toISOString(),
      }).select().single();
      if (createErr) throw createErr;
      // Auto-add admin to crew at 100% share so attribution is intact.
      await sb.from('outreach_assigned_staff').insert({
        outreach_id: created.id,
        staff_user_id: user.id,
        role_in_outreach: 'initiator',
        reward_share_percent: 100,
      });
      return created.id as string;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast({ title: 'Outreach is live', description: 'Crew can start capturing intake now.' });
    },
    onError: (e: any) =>
      toast({ title: 'Quick launch failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateOutreachSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<OutreachSession> }) => {
      const { error } = await sb.from('outreach_sessions').update(input.patch).eq('id', input.id);
      if (error) throw error;
      return input.id;
    },
    onSuccess: (id) => invalidateAll(qc, id),
    onError: (e: any) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });
};

/**
 * Hard-delete an outreach session. Admin-only via RLS. The safety gate below
 * matches what the UI enforces: refuse when the session has captured leads,
 * booked revenue, or has advanced into reconciled/closed states. Terminal or
 * empty rows (drafts, cancelled shells, mis-typed entries) can be removed to
 * keep the live picker clean. Downstream FKs on clients / finance_entries /
 * lead_interactions / distribution_runs are ON DELETE SET NULL so historical
 * records are preserved unlinked.
 */
export const useDeleteOutreachSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      // Re-read the row to enforce guards server-side-adjacent (RLS still authoritative).
      const { data: row, error: readErr } = await sb
        .from('outreach_sessions')
        .select('total_leads,total_revenue,status')
        .eq('id', input.id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!row) throw new Error('Outreach not found');
      if ((row.total_leads ?? 0) > 0) {
        throw new Error('Cannot delete: this outreach already has captured leads. Cancel it instead.');
      }
      if (Number(row.total_revenue ?? 0) > 0) {
        throw new Error('Cannot delete: this outreach has booked revenue. Cancel it instead.');
      }
      if (['reconciled', 'closed'].includes(row.status)) {
        throw new Error('Cannot delete a reconciled or closed outreach.');
      }
      const { error } = await sb.from('outreach_sessions').delete().eq('id', input.id);
      if (error) throw error;
      return input.id;
    },
    onSuccess: (id) => {
      invalidateAll(qc, id);
      qc.invalidateQueries({ queryKey: ['my-assigned-outreaches'] });
      toast({ title: 'Outreach deleted' });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};

export const useTransitionOutreach = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; to: OutreachStatus }) => {
      // Server-side state machine: validates checklist, edges, and admin gates.
      const { error } = await sb.rpc('transition_outreach', { _id: input.id, _to: input.to });
      if (error) throw error;
      return input.id;
    },
    onSuccess: (id, vars) => {
      invalidateAll(qc, id);
      toast({ title: `Outreach ${vars.to.replace(/_/g, ' ')}` });
    },
    onError: (e: any) => toast({ title: 'Transition failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertCrew = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      outreach_id: string;
      staff_user_id: string;
      role_in_outreach: OutreachRole;
      reward_share_percent: number;
    }) => {
      const { error } = await sb.from('outreach_assigned_staff').upsert({
        outreach_id: input.outreach_id,
        staff_user_id: input.staff_user_id,
        role_in_outreach: input.role_in_outreach,
        reward_share_percent: input.reward_share_percent,
      }, { onConflict: 'outreach_id,staff_user_id' });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => invalidateAll(qc, id),
    onError: (e: any) => toast({ title: 'Crew update failed', description: e.message, variant: 'destructive' }),
  });
};

export const useRemoveCrew = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; outreach_id: string }) => {
      const { error } = await sb.from('outreach_assigned_staff').delete().eq('id', input.id);
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => invalidateAll(qc, id),
  });
};

export const useApproveReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; outreach_id: string; notes?: string }) => {
      const { error } = await sb.rpc('approve_outreach_reward', { _reward_id: input.id, _approver_notes: input.notes ?? null });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => { invalidateAll(qc, id); toast({ title: 'Reward approved & posted to finance' }); },
    onError: (e: any) => toast({ title: 'Approve failed', description: e.message, variant: 'destructive' }),
  });
};

export const useRejectReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; outreach_id: string; reason?: string }) => {
      const { error } = await sb.rpc('reject_outreach_reward', { _reward_id: input.id, _reason: input.reason ?? null });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => { invalidateAll(qc, id); toast({ title: 'Reward rejected' }); },
  });
};

export const useRecomputeReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (outreachId: string) => {
      const { error } = await sb.rpc('compute_outreach_reward', { _outreach_id: outreachId });
      if (error) throw error;
      return outreachId;
    },
    onSuccess: (id) => { invalidateAll(qc, id); toast({ title: 'Reward recomputed' }); },
    onError: (e: any) => toast({ title: 'Recompute failed', description: e.message, variant: 'destructive' }),
  });
};

export const useCaptureOutreachLead = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { outreach_id: string; full_name: string; phone?: string; notes?: string }) => {
      if (!input.full_name.trim()) throw new Error('Name is required');
      const trimmedPhone = (input.phone ?? '').trim();
      const phoneDigits = trimmedPhone.replace(/\D/g, '');

      // Step 1 of "Outreach Live Sale v1": existing clients (matched by phone)
      // must NEVER have their acquisition ownership rewritten. We only log a
      // lightweight outreach interaction so the touch is recorded.
      let existingId: string | null = null;
      if (phoneDigits.length >= 7) {
        const { data: candidates } = await sb
          .from('clients')
          .select('id, phone, archived')
          .not('phone', 'is', null)
          .eq('archived', false)
          .limit(2000);
        const match = (candidates ?? []).find((c: any) =>
          (c.phone ?? '').replace(/\D/g, '') === phoneDigits,
        );
        if (match) existingId = match.id;
      }

      if (existingId) {
        const { error: liErr } = await sb.from('lead_interactions').insert({
          client_id: existingId,
          staff_user_id: user?.id ?? null,
          method: 'outreach',
          outcome: 'reached',
          outreach_id: input.outreach_id,
          notes: `Outreach touch: ${input.full_name.trim()}${input.notes ? ' — ' + input.notes : ''}`,
        });
        if (liErr) throw liErr;
        return input.outreach_id;
      }

      // Brand-new client → lock acquisition to the capturing staff so future
      // referral links can't silently rewrite ownership.
      const { error } = await sb.from('clients').insert({
        full_name: input.full_name.trim(),
        phone: trimmedPhone || null,
        outreach_id: input.outreach_id,
        captured_via: 'outreach',
        intake_source: 'outreach',
        source_type: 'outreach',
        attributed_staff_id: user?.id ?? null,
        acquisition_owner_id: user?.id ?? null,
        original_source: 'outreach',
        acquisition_locked: true,
        first_seen_at: new Date().toISOString(),
        notes: input.notes ?? null,
        status: 'lead',
      });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => { invalidateAll(qc, id); toast({ title: 'Lead captured' }); },
    onError: (e: any) => toast({ title: 'Capture failed', description: e.message, variant: 'destructive' }),
  });
};

export const useLogOutreachExpense = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { outreach_id: string; category: string; amount: number; notes?: string }) => {
      if (!user) throw new Error('Not signed in');
      if (!(input.amount > 0)) throw new Error('Amount must be positive');
      const { error } = await sb.from('finance_entries').insert({
        staff_user_id: user.id,
        kind: 'spend',
        category: input.category || 'other',
        amount: input.amount,
        date: new Date().toISOString().slice(0, 10),
        operation_kind: 'outreach',
        operation_ref_id: input.outreach_id,
        outreach_id: input.outreach_id,
        notes: input.notes ?? null,
      });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => { invalidateAll(qc, id); toast({ title: 'Expense logged' }); },
    onError: (e: any) => toast({ title: 'Log failed', description: e.message, variant: 'destructive' }),
  });
};

export const usePendingRewards = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-rewards-pending'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb.from('outreach_rewards')
        .select('*, outreach_sessions:outreach_id(name, outreach_date)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

// ============= Outreach Live Sale v1 =============

export interface RecordOutreachSaleInput {
  outreach_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  customer_phone: string;
  customer_name?: string;
  attributed_staff_id?: string;
  payment_status?: 'paid' | 'pending' | 'partial' | 'failed' | 'cancelled';
  payment_method?: 'cash' | 'bank_transfer' | 'pos' | 'online';
  payment_reference?: string;
  notes?: string;
}

export interface RecordOutreachSaleResult {
  finance_entry_id: string;
  client_id: string;
  client_created: boolean;
  total_amount: number;
  payment_status: string;
}

export const useRecordOutreachSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordOutreachSaleInput): Promise<RecordOutreachSaleResult> => {
      const { data, error } = await sb.rpc('record_outreach_sale', {
        _outreach_id: input.outreach_id,
        _product_id: input.product_id,
        _quantity: input.quantity,
        _unit_price: input.unit_price,
        _customer_phone: input.customer_phone,
        _customer_name: input.customer_name ?? null,
        _attributed_staff_id: input.attributed_staff_id ?? null,
        _payment_status: input.payment_status ?? 'paid',
        _payment_method: input.payment_method ?? 'cash',
        _payment_reference: input.payment_reference ?? null,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as RecordOutreachSaleResult;
    },
    onSuccess: (res, vars) => {
      invalidateAll(qc, vars.outreach_id);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-performance'] });
      qc.invalidateQueries({ queryKey: ['product-performance-v2'] });
      qc.invalidateQueries({ queryKey: ['inventory-batches'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      toast({
        title: res.client_created ? 'Sale recorded · new customer' : 'Sale recorded',
        description: `₦${Number(res.total_amount).toLocaleString()} · ${res.payment_status}`,
      });
    },
    onError: (e: any) => toast({ title: 'Sale failed', description: e.message, variant: 'destructive' }),
  });
};

// ============= Pending Outreach Orders =============

export interface PendingOutreachOrder {
  id: string;
  outreach_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  customer_phone: string;
  customer_name: string | null;
  customer_client_id: string | null;
  attributed_staff_id: string | null;
  payment_method: 'cash' | 'bank_transfer' | 'pos' | 'online' | null;
  payment_reference: string | null;
  notes: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  resulting_finance_entry_id: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const usePendingOutreachOrders = (outreachId?: string, status: 'pending' | 'all' = 'pending') => {
  return useQuery({
    queryKey: ['pending-outreach-orders', outreachId ?? null, status],
    enabled: !!outreachId,
    queryFn: async (): Promise<PendingOutreachOrder[]> => {
      let q = sb.from('pending_outreach_orders').select('*').eq('outreach_id', outreachId);
      if (status === 'pending') q = q.eq('status', 'pending');
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PendingOutreachOrder[];
    },
  });
};

export interface CreatePendingOrderInput {
  outreach_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  customer_phone: string;
  customer_name?: string;
  attributed_staff_id?: string;
  payment_method?: 'cash' | 'bank_transfer' | 'pos' | 'online';
  payment_reference?: string;
  notes?: string;
}

export const useCreatePendingOutreachOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePendingOrderInput) => {
      const { data, error } = await sb.rpc('create_pending_outreach_order', {
        _outreach_id: input.outreach_id,
        _product_id: input.product_id,
        _quantity: input.quantity,
        _unit_price: input.unit_price,
        _customer_phone: input.customer_phone,
        _customer_name: input.customer_name ?? null,
        _attributed_staff_id: input.attributed_staff_id ?? null,
        _payment_method: input.payment_method ?? 'bank_transfer',
        _payment_reference: input.payment_reference ?? null,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as { pending_order_id: string; matched_client_id: string | null; total_amount: number };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-outreach-orders', vars.outreach_id] });
      toast({ title: 'Saved as pending', description: 'No inventory deducted until payment is confirmed.' });
    },
    onError: (e: any) => toast({ title: 'Could not save pending order', description: e.message, variant: 'destructive' }),
  });
};

export const useConfirmPendingOutreachOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; outreach_id: string; payment_method?: string; payment_reference?: string }) => {
      const { data, error } = await sb.rpc('confirm_pending_outreach_order', {
        _id: input.id,
        _payment_method: input.payment_method ?? null,
        _payment_reference: input.payment_reference ?? null,
      });
      if (error) throw error;
      return data as { pending_order_id: string; finance_entry_id: string | null; client_id?: string; total_amount?: number; already_paid?: boolean };
    },
    onSuccess: (_res, vars) => {
      invalidateAll(qc, vars.outreach_id);
      qc.invalidateQueries({ queryKey: ['pending-outreach-orders', vars.outreach_id] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-performance'] });
      qc.invalidateQueries({ queryKey: ['product-performance-v2'] });
      qc.invalidateQueries({ queryKey: ['inventory-batches'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      toast({ title: 'Payment confirmed', description: 'Sale posted, inventory updated.' });
    },
    onError: (e: any) => toast({ title: 'Confirm failed', description: e.message, variant: 'destructive' }),
  });
};

export const useCancelPendingOutreachOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; outreach_id: string; reason?: string }) => {
      const { error } = await sb.rpc('cancel_pending_outreach_order', { _id: input.id, _reason: input.reason ?? null });
      if (error) throw error;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-outreach-orders', vars.outreach_id] });
      toast({ title: 'Pending order cancelled' });
    },
    onError: (e: any) => toast({ title: 'Cancel failed', description: e.message, variant: 'destructive' }),
  });
};

// ============= Outreach Portal v1 =============

export interface OutreachSlugInfo {
  id: string;
  name: string;
  location: string | null;
  outreach_date: string;
  start_time: string | null;
  end_time: string | null;
  status: OutreachStatus;
  public_intake_enabled: boolean;
  initiator_staff_id: string | null;
  intake_slug: string;
}

/** Public, anon-callable lookup. Used by the slug-based intake page. */
export const useOutreachBySlug = (slug?: string) =>
  useQuery({
    queryKey: ['outreach-by-slug', slug],
    enabled: !!slug,
    queryFn: async (): Promise<OutreachSlugInfo | null> => {
      const { data, error } = await sb.rpc('get_outreach_by_slug', { _slug: slug });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as OutreachSlugInfo | null;
    },
  });

export interface SlugCaptureInput {
  outreach_id: string;
  staff_id?: string | null;
  full_name: string;
  phone?: string;
  email?: string;
  gender?: string;
  main_skin_concern?: string;
  interest_level?: 'low' | 'medium' | 'high';
  wants_consultation?: boolean;
  product_interest?: string;
  notes?: string;
  consent_status?: 'granted' | 'denied' | 'unknown';
}

export const useSlugCaptureLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SlugCaptureInput) => {
      const { outreach_id, staff_id, ...rest } = input;
      const { data, error } = await sb.rpc('capture_outreach_lead', {
        _outreach_id: outreach_id,
        _staff_id: staff_id ?? null,
        _payload: rest,
      });
      if (error) throw error;
      const result = data as {
        client_id: string;
        created: boolean;
        outreach_id: string;
        attributed_staff_id: string | null;
        visit_id?: string | null;
        visit_created?: boolean;
        visit_error?: string | null;
      };
      // The treatment-dashboard bridge now runs server-side inside the RPC
      // (SECURITY DEFINER bypasses the RLS that blocked outreach/anon
      // callers from inserting into client_visit_logs). If the bridge ever
      // fails it surfaces here as `visit_error`, but the capture still
      // succeeds so the lead is never lost.
      if (result?.visit_error) {
        console.warn('[outreach-bridge] server bridge reported error', result.visit_error);
        toast({
          title: 'Lead saved, but not added to dashboard',
          description: result.visit_error,
          variant: 'destructive',
        });
      }
      return result;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['outreach-leads', vars.outreach_id] });
      qc.invalidateQueries({ queryKey: ['outreach-portal-recent', vars.outreach_id] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
    },
  });
};

/**
 * Every outreach the signed-in ops staff (outreach / front desk /
 * medical aesthetician) is allowed to see. RLS is authoritative:
 * ops roles now see every outreach regardless of status so any team
 * member can walk into any outreach and record intake data. We do NOT
 * narrow by status here — cancelled rows are the only ones excluded.
 *
 * Sort: active / ready first, then most-recent date.
 */
export const useMyAssignedActiveOutreaches = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-assigned-outreaches', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OutreachSession[]> => {
      const { data, error } = await sb
        .from('outreach_sessions')
        .select('*')
        .neq('status', 'cancelled')
        .order('outreach_date', { ascending: false })
        .order('start_time', { ascending: true, nullsFirst: true });
      if (error) throw error;
      const rows = (data ?? []) as OutreachSession[];
      const liveRank = (s: OutreachStatus) =>
        s === 'active' ? 0 : s === 'ready_to_start' ? 1 : 2;
      return [...rows].sort((a, b) => liveRank(a.status) - liveRank(b.status));
    },
  });
};

export const useRecentOutreachCaptures = (outreachId?: string, staffId?: string | null) =>
  useQuery({
    queryKey: ['outreach-portal-recent', outreachId, staffId ?? 'all'],
    enabled: !!outreachId,
    queryFn: async () => {
      let q = sb
        .from('clients')
        .select('id, full_name, phone, created_at, attributed_staff_id, captured_via')
        .eq('outreach_id', outreachId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (staffId) q = q.eq('attributed_staff_id', staffId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

/**
 * Upload one or more intake condition photos into the anon-writable
 * `intake-photos` bucket, then link them to the client + visit via the
 * `attach_intake_photos` RPC. Returns the count of linked rows.
 *
 * Safe by construction:
 *  - files go to `outreach/<outreach_id>/<client_id>/<ts>-<safe-name>`
 *  - the RPC verifies the client belongs to the outreach and was just created
 *  - failures never lose the already-captured lead
 */
export const useUploadIntakePhotos = () =>
  useMutation({
    mutationFn: async (input: {
      outreach_id: string;
      client_id: string;
      visit_id: string | null;
      files: File[];
    }) => {
      const { outreach_id, client_id, visit_id, files } = input;
      if (!files.length) return { uploaded: 0, linked: 0 };
      const paths: string[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `outreach/${outreach_id}/${client_id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safe}`;
        const { error: upErr } = await sb.storage
          .from('intake-photos')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { data, error } = await sb.rpc('attach_intake_photos', {
        _client_id: client_id,
        _visit_id: visit_id,
        _outreach_id: outreach_id,
        _paths: paths,
      });
      if (error) throw error;
      return { uploaded: paths.length, linked: (data as number) ?? 0 };
    },
  });
