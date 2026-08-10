import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tropics MedSpa'

interface Props {
  clientName?: string
  reportLabel?: string
  reportVersion?: number
  downloadUrl?: string
  expiresInDays?: number
  practitionerName?: string
  whatsappUrl?: string
  reportPageUrl?: string
}

const ClientReport = ({
  clientName,
  reportLabel,
  reportVersion,
  downloadUrl,
  expiresInDays = 7,
  practitionerName,
  whatsappUrl,
  reportPageUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} {reportLabel ?? 'visit'} report is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {clientName ? `Hi ${clientName}, your report is ready ✨` : `Your report is ready ✨`}
          </Heading>
          <Text style={text}>
            Thank you for visiting {SITE_NAME}. Your personalised
            {reportLabel ? ` ${reportLabel.toLowerCase()} ` : ' '}report
            {typeof reportVersion === 'number' ? ` (v${reportVersion})` : ''} is
            available through the secure download link below.
          </Text>

          {reportPageUrl && (
            <>
              <Section style={{ textAlign: 'center', margin: '18px 0 8px' }}>
                <Button style={button} href={reportPageUrl}>Open your secure report</Button>
              </Section>
              <Text style={fallback}>
                Or paste this link into your browser:
                <br />
                <a href={reportPageUrl} style={fallbackLink}>{reportPageUrl}</a>
              </Text>
            </>
          )}

          {downloadUrl && (
            <>
              <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
                <Button style={reportPageUrl ? secondaryButton : button} href={downloadUrl}>
                  Download your report (PDF)
                </Button>
              </Section>
              <Text style={fallback}>
                If the button above doesn't work, copy and paste this link into your browser:
                <br />
                <a href={downloadUrl} style={fallbackLink}>{downloadUrl}</a>
              </Text>
            </>
          )}

          <Text style={small}>
            This secure link expires in {expiresInDays} day{expiresInDays === 1 ? '' : 's'}.
            Please save the PDF for your records.
          </Text>

          {practitionerName && (
            <>
              <Hr style={hr} />
              <Text style={text}>
                Prepared by <strong>{practitionerName}</strong>. If you have any
                questions about your assessment, recommendations or next steps,
                just reply to this email.
              </Text>
            </>
          )}

          {whatsappUrl && (
            <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
              <Button style={whatsappButton} href={whatsappUrl}>Message us on WhatsApp</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            This report contains confidential health and skin information. Please
            do not forward it without your consent.
          </Text>
        </Section>
        <Text style={footer}>{SITE_NAME} • Premium skin & wellness</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientReport,
  subject: (data: Record<string, any>) =>
    data?.reportLabel
      ? `Your ${SITE_NAME} ${data.reportLabel} report`
      : `Your ${SITE_NAME} report is ready`,
  displayName: 'Client report delivery',
  previewData: {
    clientName: 'Aisha',
    reportLabel: 'Current Visit',
    reportVersion: 1,
    downloadUrl: 'https://example.com/report.pdf',
    expiresInDays: 7,
    practitionerName: 'Tola Adebayo',
    whatsappUrl: 'https://wa.me/?text=Hi%20Tropics%20MedSpa',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Poppins, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, letterSpacing: '0.04em', margin: 0 }
const card = { backgroundColor: '#faf8ff', borderRadius: '14px', padding: '28px 26px', border: '1px solid #ece6f7' }
const h1 = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 14px' }
const text = { color: '#4a4458', fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const button = {
  backgroundColor: '#C9A961', color: '#1a0f2e', borderRadius: '8px',
  padding: '12px 24px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
}
const secondaryButton = {
  backgroundColor: '#2D1B47', color: '#faf8ff', borderRadius: '8px',
  padding: '10px 22px', fontWeight: 'bold' as const, fontSize: '13px',
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
const fallback = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: '4px 0 14px', wordBreak: 'break-all' as const, textAlign: 'center' as const }
const fallbackLink = { color: '#2D1B47', textDecoration: 'underline', wordBreak: 'break-all' as const }