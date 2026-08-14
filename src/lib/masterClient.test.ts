import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MASTER CLIENT identity regressions.
 *
 * A person is one permanent record keyed by their canonical phone. Running a
 * second analysis — even from a different partner account — must resolve back
 * to that record and append a NEW assessment, never fork a duplicate person
 * and never rewrite the first-touch attribution stamped at original capture.
 */

const state = {
  local: [] as Record<string, unknown>[],
  shared: [] as Record<string, unknown>[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  clientRow: null as Record<string, unknown> | null,
  updates: [] as unknown[],
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({ limit: async () => ({ data: state.local, error: null }) }),
        eq: () => ({ maybeSingle: async () => ({ data: state.clientRow, error: null }) }),
      }),
      update: (patch: unknown) => {
        state.updates.push(patch);
        return { eq: async () => ({ data: null, error: null }) };
      },
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (fn === 'xcape_lookup_client_by_phone') return { data: state.shared, error: null };
      return { data: state.clientRow, error: null };
    },
  },
}));

const { findMasterClientByPhone, openMasterClient } = await import('./masterClient');

/** First-touch attribution stamped when the affiliate originally captured her. */
const FIRST_TOUCH = {
  origin_user_id: 'affiliate-1',
  origin_role: 'affiliate',
  origin_org_id: 'xcape-root',
};

const masterRow = (over: Record<string, unknown> = {}) => ({
  id: 'client-master',
  full_name: 'Ada Obi',
  phone: '+2348031236789',
  created_at: '2026-01-01T00:00:00Z',
  ...FIRST_TOUCH,
  ...over,
});

beforeEach(() => {
  state.local = [];
  state.shared = [];
  state.rpcCalls = [];
  state.clientRow = masterRow();
  state.updates = [];
});

describe('phone variants resolve to one master client', () => {
  const variants = [
    '+234 803 123 6789',
    '0803 123 6789',
    '234-803-123-6789',
    '08031236789',
  ];

  it.each(variants)('matches the same person for %s', async (phone) => {
    state.local = [masterRow()];
    const match = await findMasterClientByPhone({ full_name: 'Ada O', phone });
    expect(match?.clientId).toBe('client-master');
  });

  it('returns null for a phone too short to identify anyone', async () => {
    state.local = [masterRow()];
    expect(await findMasterClientByPhone({ full_name: 'Ada', phone: '123' })).toBeNull();
  });

  it('creates nobody when no record shares the phone', async () => {
    state.local = [masterRow({ phone: '+2349000000000' })];
    expect(
      await findMasterClientByPhone({ full_name: 'Ada', phone: '+2348031236789' }),
    ).toBeNull();
  });
});

describe('a later partner analysis appends instead of overwriting', () => {
  it('opens the record read-only for an operator who already owns it', async () => {
    const existing = await openMasterClient(
      {
        clientId: 'client-master',
        fullName: 'Ada Obi',
        phone: '+2348031236789',
        assessmentCount: 1,
        crossOperator: false,
      },
      '+2348031236789',
    );
    expect(existing.id).toBe('client-master');
    // No write of any kind against the client row: first touch is untouched.
    expect(state.updates).toEqual([]);
    expect(state.rpcCalls).toEqual([]);
  });

  it('opens another operator’s record through the reuse RPC without mutating attribution', async () => {
    const existing = await openMasterClient(
      {
        clientId: 'client-master',
        fullName: 'Ada O.',
        phone: '••• 6789',
        assessmentCount: 2,
        crossOperator: true,
      },
      '0803 123 6789',
    );
    expect(state.rpcCalls[0].fn).toBe('xcape_reuse_client');
    // The CDP passes only an identity proof — never new attribution fields.
    expect(Object.keys(state.rpcCalls[0].args).sort()).toEqual(['_client_id', '_phone']);
    expect(state.updates).toEqual([]);
    // The original affiliate first touch survives the CDP interaction.
    expect(existing).toMatchObject(FIRST_TOUCH);
  });
});
