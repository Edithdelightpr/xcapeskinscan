/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Turns a Supabase/PostgREST client-creation failure into a short, human
 * sentence for the toast description while preserving the real backend detail
 * for logs. Never returns raw SQL noise as the primary message.
 */
export const describeClientError = (e: unknown): string => {
  const err = e as any;
  const code: string | undefined = err?.code;
  const message: string = typeof err?.message === 'string' ? err.message : String(e ?? '');

  switch (code) {
    case '42501':
      return 'Your account is not permitted to create clients yet. Sign out and back in, then try again.';
    case '23505':
      return 'A client with these details already exists — search for them instead.';
    case '23503':
      return 'Your operator profile is not fully linked yet. Sign out and back in, then try again.';
    case '23502':
      return 'A required field was missing from this client record.';
    default:
      return message || 'Unexpected error while saving this client.';
  }
};

export default describeClientError;
