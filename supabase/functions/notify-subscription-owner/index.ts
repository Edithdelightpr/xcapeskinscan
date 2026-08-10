import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Notification types accepted by this function.
const NOTIFICATION_TYPES = new Set([
  'payment_marked_paid',
  'grace_started',
  'past_due',
  'suspended',
  'reactivated',
  'cancelled',
  'manual_note_added',
  'payment_submitted',
  'due_soon',
  'plan_changed',
  'pilot_rate_changed',
])

const TYPE_HEADLINE: Record<string, string> = {
  payment_marked_paid: 'Payment marked as paid',
  grace_started: 'Grace period started',
  past_due: 'Subscription is past due',
  suspended: 'Subscription access suspended',
  reactivated: 'Subscription reactivated',
  cancelled: 'Subscription cancelled',
  manual_note_added: 'Subscription note updated',
  payment_submitted: 'Tenant submitted payment reference',
  due_soon: 'Subscription is due soon',
  plan_changed: 'Subscription plan changed',
  pilot_rate_changed: 'Pilot rate updated',
}

interface Payload {
  accountId: string
  notificationType: string
  performedBy?: string | null
  performedFrom?: string
  notes?: string | null
  message?: string | null
  actionContext?: string // one of: review, mark_paid, grant_grace, suspend, reactivate
  extra?: Record<string, unknown>
  /** When true, skip send if same notification_type was sent for this account within last 24h. */
  dedupe24h?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body?.accountId || typeof body.accountId !== 'string') {
    return json({ error: 'accountId is required' }, 400)
  }
  if (!body?.notificationType || !NOTIFICATION_TYPES.has(body.notificationType)) {
    return json({ error: `notificationType must be one of: ${Array.from(NOTIFICATION_TYPES).join(', ')}` }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Load account
  const { data: account, error: accErr } = await supabase
    .from('subscription_accounts')
    .select('*')
    .eq('id', body.accountId)
    .maybeSingle()
  if (accErr || !account) {
    console.error('subscription account lookup failed', accErr)
    return json({ error: 'Subscription account not found' }, 404)
  }

  const recipient = (account as any).owner_email || 'jforkwa@gmail.com'

  // 2. Optional dedupe: skip if same type sent within last 24h
  if (body.dedupe24h) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('subscription_notification_logs')
      .select('id')
      .eq('subscription_account_id', body.accountId)
      .eq('notification_type', body.notificationType)
      .eq('status', 'sent')
      .gte('sent_at', since)
      .limit(1)
    if (recent && recent.length > 0) {
      return json({ success: true, skipped: 'deduped_24h' }, 200)
    }
  }

  // 3. Build action deep-links (safe: login required to apply)
  const publicBase = Deno.env.get('APP_PUBLIC_URL') || 'https://tropicsmedspa.com'
  const link = (action: string) =>
    `${publicBase.replace(/\/+$/, '')}/admin?view=area-settings&tab=subscription&action=${encodeURIComponent(action)}`
  const actionLinks = [
    { label: 'Review Subscription', url: link('review') },
    { label: 'Mark Paid', url: link('mark_paid') },
    { label: 'Grant Grace', url: link('grant_grace') },
    { label: 'Suspend Access', url: link('suspend') },
  ]

  const headline = TYPE_HEADLINE[body.notificationType]
  const templateData = {
    notificationType: body.notificationType,
    headline,
    accountName: (account as any).account_name,
    domain: (account as any).domain_name,
    websiteUrl: (account as any).website_url,
    plan: (account as any).plan_name,
    billingCycle: (account as any).billing_cycle,
    amount: (account as any).amount,
    currency: (account as any).currency,
    status: (account as any).status,
    dueDate: (account as any).next_due_date ?? (account as any).current_period_end,
    graceDeadline: (account as any).grace_period_end,
    lastPaymentDate: (account as any).last_payment_date,
    lastPaymentRef: (account as any).payment_reference,
    notes: body.notes ?? (account as any).notes,
    performedBy: body.performedBy ?? undefined,
    message: body.message ?? undefined,
    actionLinks,
    planTier: (account as any).plan_tier,
    planPriceUsd: (account as any).plan_price_usd,
    pilotRateUsd: (account as any).pilot_rate_usd,
    pilotRateNote: (account as any).pilot_rate_note,
    ...(body.extra ?? {}),
  }

  const subject = `[${templateData.accountName ?? 'Tenant'}] ${headline}`

  // 4. Invoke send-transactional-email
  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null
  try {
    const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'subscription-owner-alert',
        recipientEmail: recipient,
        idempotencyKey: `sub-${body.accountId}-${body.notificationType}-${Date.now()}`,
        templateData,
      },
    })
    if (sendErr) {
      status = 'failed'
      errorMessage = sendErr.message ?? 'send-transactional-email failed'
    }
  } catch (e) {
    status = 'failed'
    errorMessage = e instanceof Error ? e.message : 'send-transactional-email threw'
  }

  // 5. Log the notification
  await supabase.from('subscription_notification_logs').insert({
    subscription_account_id: body.accountId,
    notification_type: body.notificationType,
    sent_to: recipient,
    subject,
    status,
    error_message: errorMessage,
  })

  if (status === 'failed') return json({ error: errorMessage }, 500)
  return json({ success: true, sent_to: recipient }, 200)
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}