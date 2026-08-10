import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Runs daily (via pg_cron). Scans subscription_accounts and:
//  - Auto-transitions expired 'active' rows to 'past_due' (when no grace applies).
//  - Sends 'due_soon' owner emails for accounts within their threshold.
//  - Sends 'past_due' owner email once when transition happens.
// All owner emails are dedup'd to at most one per (account, type) per 24h.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: accounts, error } = await supabase
    .from('subscription_accounts')
    .select('*')
  if (error) {
    console.error('failed to load subscription_accounts', error)
    return json({ error: 'load failed' }, 500)
  }

  const now = Date.now()
  const results: any[] = []

  for (const a of accounts ?? []) {
    const acc = a as any
    const status: string = acc.status
    const end = acc.next_due_date ?? acc.current_period_end
    const endMs = end ? new Date(end).getTime() : null
    const thresholdDays = Number(acc.due_soon_threshold_days ?? 7)

    // 1. Auto-transition active → past_due when period elapsed and no grace applies
    if (status === 'active' && endMs && endMs < now) {
      const graceMs = acc.grace_period_end ? new Date(acc.grace_period_end).getTime() : null
      const stillInGrace = graceMs && graceMs > now
      if (!stillInGrace) {
        const { error: upErr } = await supabase
          .from('subscription_accounts')
          .update({ status: 'past_due' })
          .eq('id', acc.id)
        if (!upErr) {
          await supabase.from('subscription_action_logs').insert({
            subscription_account_id: acc.id,
            action: 'auto_past_due',
            previous_status: 'active',
            new_status: 'past_due',
            performed_from: 'system',
            notes: 'subscription-daily-check: period elapsed with no active grace',
          })
          await notify(supabase, acc.id, 'past_due', {
            message: 'The subscription period has elapsed without a confirmed payment. Access will pause once a Suspend is applied.',
          })
          results.push({ id: acc.id, action: 'transitioned_past_due' })
          continue
        }
      }
    }

    // 2. Due soon: active + within threshold
    if (status === 'active' && endMs) {
      const daysUntil = Math.ceil((endMs - now) / (24 * 60 * 60 * 1000))
      if (daysUntil >= 0 && daysUntil <= thresholdDays) {
        const r = await notify(supabase, acc.id, 'due_soon', {
          dedupe24h: true,
          message: `The subscription renews in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
        })
        results.push({ id: acc.id, action: 'due_soon', ...r })
      }
    }
  }

  return json({ success: true, processed: (accounts ?? []).length, results }, 200)
})

async function notify(
  supabase: any,
  accountId: string,
  notificationType: string,
  opts: { message?: string; dedupe24h?: boolean } = {},
) {
  try {
    const { data, error } = await supabase.functions.invoke('notify-subscription-owner', {
      body: {
        accountId,
        notificationType,
        performedFrom: 'system',
        dedupe24h: opts.dedupe24h ?? true,
        message: opts.message,
      },
    })
    if (error) return { notify: 'failed', error: error.message }
    return { notify: 'ok', ...(data ?? {}) }
  } catch (e) {
    return { notify: 'threw', error: e instanceof Error ? e.message : String(e) }
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}