import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The dedupe layer has two sources of truth:
 *  - the RLS-scoped `clients` rows this operator can already read
 *  - the secure cross-operator identity lookup (`xcape_lookup_client_by_phone`)
 * These tests lock the merge behaviour between them.
 */

const state = {
  rows: [] as Record<string, unknown>[],
  shared: [] as Record<string, unknown>[],
  sharedError: null as unknown,
  rpcCalls: [] as { fn: string; args: unknown }[],
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({
          limit: async () => ({ data: state.rows, error: null }),
        }),
      }),
    }),
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: state.shared, error: state.sharedError };
    },
  },
}));

const { findPotentialDuplicates, normalisePhone, hasStrongMatch } = await import('./clientDedupe');

const sharedRow = (over: Record<string, unknown> = {}) => ({
  id: 'shared-1',
  full_name: 'Ada Obi',
  phone_masked: '••• 6789',
  created_at: '2026-01-01T00:00:00Z',
  assessment_count: 3,
  already_accessible: false,
  ...over,
});

beforeEach(() => {
  state.rows = [];
  state.shared = [];
  state.sharedError = null;
  state.rpcCalls = [];
});

describe('normalisePhone', () => {
  it('keeps the last 10 digits regardless of formatting', () => {
    expect(normalisePhone('+234 803 123 6789')).toBe('8031236789');
    expect(normalisePhone('0803-123-6789')).toBe('8031236789');
  });
});

describe('cross-operator identity lookup', () => {
  it('surfaces a person registered by another partner', async () => {
    state.shared = [sharedRow()];
    const matches = await findPotentialDuplicates({
      full_name: 'Ada Obi',
      phone: '08031236789',
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].crossOperator).toBe(true);
    expect(matches[0].assessmentCount).toBe(3);
    expect(matches[0].reasons).toContain('existing_identity');
    // Only identity fields ever come back — never another partner's history.
    expect(matches[0].client.phone).toBe('••• 6789');
    expect(matches[0].client.email).toBeNull();
    expect(hasStrongMatch(matches)).toBe(true);
  });

  it('does not duplicate a record the operator can already read', async () => {
    state.rows = [
      {
        id: 'shared-1',
        full_name: 'Ada Obi',
        phone: '08031236789',
        email: null,
        client_code: 'XC-1',
        membership_type: 'none',
        status: 'lead',
        attributed_staff_id: null,
        last_contact_date: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    state.shared = [sharedRow({ already_accessible: true })];
    const matches = await findPotentialDuplicates({
      full_name: 'Ada Obi',
      phone: '08031236789',
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].crossOperator).toBeUndefined();
    expect(matches[0].client.client_code).toBe('XC-1');
  });

  it('skips the secure lookup when the phone is too short to identify anyone', async () => {
    await findPotentialDuplicates({ full_name: 'Ada', phone: '0803' });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('degrades to local matches when the secure lookup fails', async () => {
    state.sharedError = { message: 'permission denied' };
    const matches = await findPotentialDuplicates({
      full_name: 'Ada Obi',
      phone: '08031236789',
    });
    expect(matches).toEqual([]);
  });
});
