import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneKey } from '@/lib/phone';
import { findPotentialDuplicates, type DupeMatch } from '@/lib/clientDedupe';
import type { RealClient } from '@/hooks/useRealClients';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * MASTER CLIENT resolution for the XCAPE analysis path.
 *
 * A person is one permanent record identified by their canonical phone key.
 * Running a second analysis must append a NEW assessment to that record, never
 * create a second person and never rewrite the first-touch attribution that was
 * stamped when they were originally captured.
 */
export interface MasterClientMatch {
  clientId: string;
  fullName: string;
  /** Masked when the record belongs to another operator. */
  phone: string | null;
  /** Analyses already on file (identity layer count when cross-operator). */
  assessmentCount: number;
  /** True when the record lives with another operator and needs the reuse RPC. */
  crossOperator: boolean;
}

const strongPhone = (m: DupeMatch) => m.reasons.includes('exact_phone');

/**
 * Looks for an existing master client with the same canonical phone.
 * Returns `null` when the phone is unusable or nobody matches — the caller
 * then creates a genuinely new person.
 */
export const findMasterClientByPhone = async (input: {
  full_name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<MasterClientMatch | null> => {
  const key = normalizePhoneKey(input.phone);
  if (!key) return null;

  const matches = await findPotentialDuplicates({
    full_name: input.full_name,
    phone: key,
    email: input.email ?? null,
  });
  const hit = matches.find(strongPhone);
  if (!hit) return null;

  return {
    clientId: hit.client.id,
    fullName: hit.client.full_name,
    phone: hit.client.phone ?? null,
    assessmentCount: hit.assessmentCount ?? 0,
    crossOperator: !!hit.crossOperator,
  };
};

/**
 * Returns the usable client row for a match. Cross-operator records are opened
 * through `xcape_reuse_client`, which grants this operator a touchpoint without
 * exposing or mutating the original capture attribution.
 */
export const openMasterClient = async (
  match: MasterClientMatch,
  rawPhone: string,
): Promise<RealClient> => {
  if (!match.crossOperator) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', match.clientId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Could not load that client');
    return data as RealClient;
  }
  const { data, error } = await (supabase as any).rpc('xcape_reuse_client', {
    _client_id: match.clientId,
    _phone: normalizePhoneKey(rawPhone) || rawPhone,
  });
  if (error) throw error;
  const existing = data as RealClient | null;
  if (!existing) throw new Error('Could not load that client');
  return existing;
};
