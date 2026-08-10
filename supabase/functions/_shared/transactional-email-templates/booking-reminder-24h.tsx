import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tropics MedSpa'

interface Props {
  clientName?: string
  treatment?: string
  date?: string
  time?: string
  practitionerName?: string
  manageUrl?: string
  whatsappUrl?: string
}

const BookingReminder24h = ({
  clientName, treatment, date, time, practitionerName, manageUrl, whatsappUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>See you tomorrow at {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {clientName ? `${clientName}, see you tomorrow 💛` : 'See you tomorrow 💛'}
          </Heading>
          <Text style={text}>
            This is a friendly reminder of your upcoming appointment at {SITE_NAME}.
          </Text>

          <Section style={detailBlock}>
            {treatment && <Text style={detail}><strong>Treatment:</strong> {treatment}</Text>}
            {date && <Text style={detail}><strong>Date:</strong> {date}</Text>}
            {time && <Text style={detail}><strong>Time:</strong> {time}</Text>}
            {practitionerName && (
              <Text style={detail}><strong>With:</strong> {practitionerName}</Text>
            )}
          </Section>

          <Text style={text}>
            Please come with clean skin and arrive 5–10 minutes early. If anything
            has changed, you can reschedule below.
          </Text>

          {manageUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
              <Button style={button} href={manageUrl}>Reschedule or cancel</Button>
            </Section>
          )}

          {whatsappUrl && (
            <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
              <Button style={whatsappButton} href={whatsappUrl}>Message us on WhatsApp</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            We look forward to taking care of you.
          </Text>
        </Section>
        <Text style={footer}>{SITE_NAME} • Premium skin & wellness</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingReminder24h,
  subject: (data: Record<string, any>) =>
    data?.time ? `Reminder: your ${SITE_NAME} appointment at ${data.time} tomorrow`
               : `Reminder: your ${SITE_NAME} appointment tomorrow`,
  displayName: '24h appointment reminder',
  previewData: {
    clientName: 'Aisha',
    treatment: 'Hydrafacial',
    date: 'Sunday, 4 May 2026',
    time: '11:00 AM',
    practitionerName: 'Tola Adebayo',
    manageUrl: 'https://tropics-medspa-pro.lovable.app/book',
    whatsappUrl: 'https://wa.me/?text=Hi%20Tropics%20MedSpa',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Poppins, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, letterSpacing: '0.04em', margin: 0 }
const card = { backgroundColor: '#faf8ff', borderRadius: '14px', padding: '28px 26px', border: '1px solid #ece6f7' }
const h1 = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 14px' }
const text = { color: '#4a4458', fontSize: '15px', lineHeight: '1.6', margin: '0 0 18px' }
const detailBlock = { backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', margin: '14px 0' }
const detail = { color: '#2D1B47', fontSize: '14px', margin: '4px 0' }
const button = {
  backgroundColor: '#C9A961', color: '#1a0f2e', borderRadius: '8px',
  padding: '12px 24px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
}
const whatsappButton = {
  backgroundColor: '#25D366', color: '#0b3d20', borderRadius: '8px',
  padding: '10px 20px', fontWeight: 'bold' as const, fontSize: '13px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }
const footer = { color: '#9c95b3', fontSize: '11px', textAlign: 'center' as const, margin: '20px 0 0' }