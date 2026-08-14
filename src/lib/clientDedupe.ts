import { supabase } from '@/integrations/supabase/client';
import type { RealClient } from '@/hooks/useRealClients';

export type DupeReason = 'exact_phone' | 'exact_email' | 'name_match' | 'existing_identity';

export interface DupeMatch {
  client: Pick<
    RealClient,
    'id' | 'full_name' | 'phone' | 'email' | 'client_code' |
    'membership_type' | 'status' | 'attributed_staff_id' |
    'last_contact_date' | 'created_at'
  >;
  reasons: DupeReason[];
  /**
   * True when the person already exists in the permanent XCAPE identity
   * layer but was first registered by a different operator, so the current
   * user cannot read the full record yet. Reuse goes through the
   * `xcape_reuse_client` RPC instead of a direct field merge.
   */
  crossOperator?: boolean;
  /** Number of analyses already on file for this person (identity layer only). */
  assessmentCount?: number;
}


/** Strip everything except digits, then keep the last 10 (matches DB index). */
export const normalisePhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  return digits.slice(-10);
};

export const normaliseEmail = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
};

/** Punctuation-stripped lowercase name for soft-match comparison. */
export const normaliseName = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
};

export interface DupeCheckInput {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  /** Skip these client ids (e.g. when editing). */
  excludeIds?: string[];
}

/**
 * Searches the clients table for potential duplicates of the given person.
 * Strong matches (phone or email) are returned first; soft name matches follow.
 */
export const findPotentialDuplicates = async (
  input: DupeCheckInput,
): Promise<DupeMatch[]> => {
  const phoneKey = normalisePhone(input.phone);
  const emailKey = normaliseEmail(input.email);
  const nameKey = normaliseName(input.full_name);
  const excludeIds = new Set(input.excludeIds ?? []);

  // Build OR filter; we fetch a wide-ish candidate set and refine in JS.
  const orParts: string[] = [];
  if (phoneKey) {
    // Postgrest .or — last-10-digit suffix match (handles +234… vs 0… vs raw).
    orParts.push(`phone.ilike.%${phoneKey}`);
  }
  if (emailKey) {
    orParts.push(`email.ilike.${emailKey}`);
  }
  if (nameKey) {
    // First-token name match keeps the candidate set small but still catches dupes.
    const firstToken = nameKey.split(' ')[0];
    if (firstToken.length >= 2) {
      orParts.push(`full_name.ilike.%${firstToken}%`);
    }
  }
  if (orParts.length === 0) return [];

  const { data, error } = await supabase
    .from('clients')
    .select(
      'id, full_name, phone, email, client_code, membership_type, status, attributed_staff_id, last_contact_date, created_at',
    )
    .or(orParts.join(','))
    .limit(25);
  if (error) {
    console.error('[clientDedupe] lookup failed', error);
    return [];
  }

  const matches: DupeMatch[] = [];
  (data ?? []).forEach((c) => {
    if (excludeIds.has(c.id)) return;
    const reasons: DupeReason[] = [];
    if (phoneKey && normalisePhone(c.phone) === phoneKey) reasons.push('exact_phone');
    if (emailKey && normaliseEmail(c.email) === emailKey) reasons.push('exact_email');
    if (nameKey && normaliseName(c.full_name) === nameKey) reasons.push('name_match');
    if (reasons.length > 0) matches.push({ client: c, reasons });
  });

  // Strong matches (phone/email) first.
  matches.sort((a, b) => {
    const aStrong = a.reasons.some((r) => r !== 'name_match') ? 0 : 1;
    const bStrong = b.reasons.some((r) => r !== 'name_match') ? 0 : 1;
    return aStrong - bStrong;
  });
  return matches;
};

export const reasonLabel = (r: DupeReason): string => {
  switch (r) {
    case 'exact_phone': return 'Same phone number';
    case 'exact_email': return 'Same email';
    case 'name_match':  return 'Same name';
  }
};

export const hasStrongMatch = (matches: DupeMatch[]): boolean =>
  matches.some((m) => m.reasons.some((r) => r !== 'name_match'));