import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tropics MedSpa'

interface Props {
  staffName?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  treatment?: string
  date?: string
  time?: string
  source?: string
  adminUrl?: string
}

const StaffNewBookingAlert = ({
  staffName, clientName, clientPhone, clientEmail, treatment, date, time, source, adminUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New booking: {clientName ?? 'a new client'}{treatment ? ` — ${treatment}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME} • Staff alert</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {staffName ? `${staffName}, you have a new booking` : 'New booking received'}
          </Heading>
          <Text style={text}>
            A new appointment was just booked. Please review the details below and
            confirm in the admin dashboard.
          </Text>

          <Section style={detailBlock}>
            {clientName && <Text style={detail}><strong>Client:</strong> {clientName}</Text>}
            {clientPhone && <Text style={detail}><strong>Phone:</strong> {clientPhone}</Text>}
            {clientEmail && <Text style={detail}><strong>Email:</strong> {clientEmail}</Text>}
            {treatment && <Text style={detail}><strong>Treatment:</strong> {treatment}</Text>}
            {date && <Text style={detail}><strong>Date:</strong> {date}</Text>}
            {time && <Text style={detail}><strong>Time:</strong> {time}</Text>}
            {source && <Text style={detail}><strong>Source:</strong> {source}</Text>}
          </Section>

          {adminUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
              <Button style={button} href={adminUrl}>Open in admin</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            Automated alert from {SITE_NAME}. Do not reply directly to this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffNewBookingAlert,
  subject: (data: Record<string, any>) => {
    const who = data?.clientName ?? 'New client'
    const what = data?.treatment ? ` — ${data.treatment}` : ''
    return `New booking: ${who}${what}`
  },
  displayName: 'Staff: new booking alert',
  previewData: {
    staffName: 'Tola',
    clientName: 'Aisha Bello',
    clientPhone: '+234 802 123 4567',
    clientEmail: 'aisha@example.com',
    treatment: 'Hydrafacial',
    date: 'Saturday, 3 May 2026',
    time: '11:00 AM',
    source: 'Public booking page',
    adminUrl: 'https://tropics-medspa-pro.lovable.app/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Poppins, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { color: '#2D1B47', fontSize: '20px', fontWeight: 'bold' as const, letterSpacing: '0.04em', margin: 0 }
const card = { backgroundColor: '#faf8ff', borderRadius: '14px', padding: '28px 26px', border: '1px solid #ece6f7' }
const h1 = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 14px' }
const text = { color: '#4a4458', fontSize: '15px', lineHeight: '1.6', margin: '0 0 18px' }
const detailBlock = { backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', margin: '14px 0' }
const detail = { color: '#2D1B47', fontSize: '14px', margin: '4px 0' }
const button = {
  backgroundColor: '#2D1B47', color: '#ffffff', borderRadius: '8px',
  padding: '12px 24px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }