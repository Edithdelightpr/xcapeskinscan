import { z } from 'zod';

export const bookingSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(100, 'Name is too long')
    .regex(/^[\p{L}'\-.\s]+$/u, 'Use letters, spaces, hyphens or apostrophes'),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number looks too short')
    .max(20, 'Phone number is too long')
    .refine((p) => p.replace(/\D/g, '').length >= 7, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').max(255),
  gender: z.enum(['female', 'male', 'prefer_not_to_say']),
  treatment: z.string().max(200).optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export type BookingFormState = z.infer<typeof bookingSchema>;

/**
 * Generate 30-minute slot grid between openHour:00 and closeHour:00 (exclusive end).
 * 09:00 → 17:30 by default.
 */
export const generateTimeSlots = (openHour = 9, closeHour = 18, stepMin = 30): string[] => {
  const slots: string[] = [];
  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
};

export const formatHumanTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const GENDER_LABELS: Record<BookingFormState['gender'], string> = {
  female: 'Female',
  male: 'Male',
  prefer_not_to_say: 'Prefer not to say',
};