import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tropics MedSpa'

interface Props {
  clientName?: string
  treatment?: string
  time?: string
  practitionerName?: string
  location?: string
  whatsappUrl?: string
}

const BookingReminder1h = ({
  clientName, treatment, time, practitionerName, location, whatsappUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>See you in an hour at {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {clientName ? `${clientName}, see you in an hour 💛` : 'See you in an hour 💛'}
          </Heading>
          <Text style={text}>
            A quick reminder that your appointment at {SITE_NAME} is in about an hour.
          </Text>

          <Section style={detailBlock}>
            {treatment && <Text style={detail}><strong>Treatment:</strong> {treatment}</Text>}
            {time && <Text style={detail}><strong>Time:</strong> {time}</Text>}
            {practitionerName && (
              <Text style={detail}><strong>With:</strong> {practitionerName}</Text>
            )}
            {location && <Text style={detail}><strong>Location:</strong> {location}</Text>}
          </Section>

          <Text style={text}>
            Please arrive 5–10 minutes early. If you're running late or need help,
            message us on WhatsApp.
          </Text>

          {whatsappUrl && (
            <Section style={{ textAlign: 'center', margin: '16px 0 4px' }}>
              <Button style={whatsappButton} href={whatsappUrl}>Message us on WhatsApp</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            We look forward to taking care of you shortly.
          </Text>
        </Section>
        <Text style={footer}>{SITE_NAME} • Premium skin & wellness</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingReminder1h,
  subject: `Reminder: your ${SITE_NAME} appointment is in 1 hour`,
  displayName: '1h appointment reminder',
  previewData: {
    clientName: 'Aisha',
    treatment: 'Hydrafacial',
    time: '11:00 AM',
    practitionerName: 'Tola Adebayo',
    location: 'Tropics MedSpa, Wonderland Estate, Kukwaba, Abuja',
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
const whatsappButton = {
  backgroundColor: '#25D366', color: '#0b3d20', borderRadius: '8px',
  padding: '10px 20px', fontWeight: 'bold' as const, fontSize: '13px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }
const footer = { color: '#9c95b3', fontSize: '11px', textAlign: 'center' as const, margin: '20px 0 0' }