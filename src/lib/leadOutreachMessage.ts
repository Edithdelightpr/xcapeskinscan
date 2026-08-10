import { deriveFirstName } from '@/lib/whatsapp';

export interface LeadOutreachInput {
  full_name?: string | null;
  attributed_staff_slug?: string | null;
}

/**
 * Build the default Sunday-ready WhatsApp first-touch message.
 * Greets by first name, introduces Tropics, adds urgency, and pastes a booking link.
 */
export const buildLeadOutreachMessage = (input: LeadOutreachInput): string => {
  const first = deriveFirstName(input.full_name) || 'there';
  return [
    `Hi ${first}!`,
    `This is Tropics MedSpa, Abuja. We offer skin analysis, facials, body treatments and personalized treatments tailored to your needs. Your premium skin & wellness destination.`,
    `We're available for the booking now and open 24/7`,
    `Click the link to book a session: https://tropicsmedspa.com`,
  ].join('\n\n');
};
