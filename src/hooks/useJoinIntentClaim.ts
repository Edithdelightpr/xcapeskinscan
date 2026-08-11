import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearJoinRole, readJoinRole, type XcapeJoinRole } from '@/lib/xcapeMarketing';

/** Join intents that map onto the internal XCAPE field-Team job role. */
const TEAM_INTENTS: XcapeJoinRole[] = ['team', 'ambassador'];

/**
 * Redeems a pending join intent once, after the user is authenticated.
 *
 * Registers the account as a PENDING Team member — it grants no access on its
 * own; an administrator must still approve it. The stored intent is cleared
 * ONLY after the RPC succeeds, so a network failure leaves it intact for the
 * next attempt.
 */
export const useJoinIntentClaim = (opts: {
  userId: string | undefined;
  hasRole: boolean;
  onClaimed?: () => void;
}) => {
  const { userId, hasRole, onClaimed } = opts;
  const attempted = useRef<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Only unassigned, signed-in accounts can claim.
    if (!userId || hasRole) return;
    if (attempted.current === userId) return;

    const intent = readJoinRole();
    if (!intent || !TEAM_INTENTS.includes(intent)) return;

    attempted.current = userId;
    let cancelled = false;
    setClaiming(true);

    void (async () => {
      const { error } = await supabase.rpc('claim_team_intent');
      if (cancelled) return;
      if (error) {
        // Keep the intent so a later attempt can still redeem it.
        attempted.current = null;
        console.error('[xcape] team intent claim failed', error.message);
      } else {
        clearJoinRole();
        onClaimed?.();
      }
      setClaiming(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, hasRole, onClaimed]);

  return { claiming };
};
