import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ActionLink { label: string; url: string }

interface Props {
  notificationType?: string
  accountName?: string
  domain?: string
  websiteUrl?: string
  plan?: string
  billingCycle?: string
  amount?: number | string
  currency?: string
  status?: string
  dueDate?: string
  graceDeadline?: string
  lastPaymentDate?: string
  lastPaymentRef?: string
  notes?: string
  performedBy?: string
  actionLinks?: ActionLink[]
  headline?: string
  message?: string
  planTier?: string
  planPriceUsd?: number | string
  pilotRateUsd?: number | string | null
  pilotRateNote?: string | null
}

const TYPE_TO_HEADLINE: Record<string, string> = {
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

const money = (amount: number | string | undefined, currency: string | undefined) => {
  if (amount === undefined || amount === null || amount === '') return '—'
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n)) return String(amount)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'NGN' }).format(n)
  } catch { return `${n} ${currency ?? ''}`.trim() }
}

const fmt = (iso?: string) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

const usd = (amount: number | string | undefined | null) => {
  if (amount === undefined || amount === null || amount === '') return '—'
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n as number)) return String(amount)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: Number.isInteger(n as number) ? 0 : 2,
    }).format(n as number)
  } catch { return `$${n}` }
}

const PLAN_TIER_LABEL: Record<string, string> = {
  starter: 'Starter / Business Control',
  growth: 'Growth / Intelligence',
  partner: 'Partner / Scale',
  enterprise: 'Enterprise / Custom',
}

const PLAN_TIER_STARTING: Record<string, boolean> = {
  enterprise: true,
}

const planPrice = (tier: string | undefined, amount: number | string | undefined | null) => {
  const base = usd(amount)
  if (base === '—') return base
  return tier && PLAN_TIER_STARTING[tier] ? `from ${base}` : base
}

const SubscriptionOwnerAlert = (p: Props) => {
  const headline = p.headline ?? (p.notificationType && TYPE_TO_HEADLINE[p.notificationType]) ?? 'Subscription update'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline} — {p.accountName ?? 'Tenant'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>Core Media • Platform Owner Alert</Heading>
          </Section>
          <Section style={card}>
            <Heading style={h1}>{headline}</Heading>
            {p.message && <Text style={text}>{p.message}</Text>}

            <Section style={detailBlock}>
              <Text style={detail}><strong>Account:</strong> {p.accountName ?? '—'}</Text>
              <Text style={detail}><strong>Domain:</strong> {p.domain ?? '—'}</Text>
              {p.websiteUrl && <Text style={detail}><strong>Website:</strong> {p.websiteUrl}</Text>}
              <Text style={detail}>
                <strong>Plan:</strong>{' '}
                {p.planTier ? (PLAN_TIER_LABEL[p.planTier] ?? p.plan ?? '—') : (p.plan ?? '—')}
                {p.billingCycle ? ` (${p.billingCycle})` : ''}
              </Text>
              <Text style={detail}>
                <strong>Plan price:</strong> {planPrice(p.planTier, p.planPriceUsd)} / month
              </Text>
              {(p.pilotRateUsd !== undefined && p.pilotRateUsd !== null && p.pilotRateUsd !== '') && (
                <Text style={detail}>
                  <strong>Pilot rate:</strong> {usd(p.pilotRateUsd)} / month
                  {p.pilotRateNote ? ` — ${p.pilotRateNote}` : ''}
                </Text>
              )}
              <Text style={detail}><strong>Legacy amount field:</strong> {money(p.amount, p.currency)}</Text>
              <Text style={detail}><strong>Status:</strong> {p.status ?? '—'}</Text>
              <Text style={detail}><strong>Next due:</strong> {fmt(p.dueDate)}</Text>
              {p.graceDeadline && <Text style={detail}><strong>Grace ends:</strong> {fmt(p.graceDeadline)}</Text>}
              <Text style={detail}><strong>Last payment:</strong> {fmt(p.lastPaymentDate)}</Text>
              {p.lastPaymentRef && <Text style={detail}><strong>Reference:</strong> {p.lastPaymentRef}</Text>}
              {p.notes && <Text style={detail}><strong>Notes:</strong> {p.notes}</Text>}
              {p.performedBy && <Text style={detail}><strong>Performed by:</strong> {p.performedBy}</Text>}
            </Section>

            {Array.isArray(p.actionLinks) && p.actionLinks.length > 0 && (
              <Section style={{ textAlign: 'center', margin: '18px 0 8px' }}>
                {p.actionLinks.map((a, i) => (
                  <Button key={i} style={{ ...button, margin: '4px 6px' }} href={a.url}>{a.label}</Button>
                ))}
                <Text style={smallCenter}>
                  Links open the Subscription Control panel. You must log in — no action is applied automatically.
                </Text>
              </Section>
            )}

            <Hr style={hr} />
            <Text style={small}>
              Automated notification from the Core Media platform. Do not reply directly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SubscriptionOwnerAlert,
  subject: (data: Record<string, any>) => {
    const account = data?.accountName ?? 'Tenant'
    const headline = data?.headline ?? (data?.notificationType && TYPE_TO_HEADLINE[data.notificationType]) ?? 'Subscription update'
    return `[${account}] ${headline}`
  },
  displayName: 'Owner: subscription alert',
  previewData: {
    notificationType: 'payment_marked_paid',
    accountName: 'Tropics MedSpa',
    domain: 'tropicsmedspa.com',
    websiteUrl: 'https://tropicsmedspa.com',
    plan: 'Platform Access',
    billingCycle: 'monthly',
    amount: 50000,
    currency: 'NGN',
    status: 'active',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentRef: 'TRF-2026-07-03-001',
    performedBy: 'admin@tropicsmedspa.com',
    actionLinks: [
      { label: 'Review subscription', url: 'https://tropicsmedspa.com/admin?view=area-settings&tab=subscription' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Poppins, Arial, sans-serif' }
const container = { maxWidth: '580px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { color: '#2D1B47', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '0.06em', margin: 0 }
const card = { backgroundColor: '#faf8ff', borderRadius: '14px', padding: '28px 26px', border: '1px solid #ece6f7' }
const h1 = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 14px' }
const text = { color: '#4a4458', fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px' }
const detailBlock = { backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', margin: '14px 0' }
const detail = { color: '#2D1B47', fontSize: '14px', margin: '4px 0' }
const button = {
  backgroundColor: '#2D1B47', color: '#ffffff', borderRadius: '8px',
  padding: '10px 18px', fontWeight: 'bold' as const, fontSize: '13px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }
const smallCenter = { ...{ color: '#7a7390', fontSize: '11px', lineHeight: '1.5' }, textAlign: 'center' as const, marginTop: '10px' }