/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingConfirmation } from './booking-confirmation.tsx'
import { template as bookingReminder24h } from './booking-reminder-24h.tsx'
import { template as bookingReminder1h } from './booking-reminder-1h.tsx'
import { template as bookingCancelReschedule } from './booking-cancel-reschedule.tsx'
import { template as staffNewBookingAlert } from './staff-new-booking-alert.tsx'
import { template as clientReport } from './client-report.tsx'
import { template as subscriptionOwnerAlert } from './subscription-owner-alert.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'booking-reminder-24h': bookingReminder24h,
  'booking-reminder-1h': bookingReminder1h,
  'booking-cancel-reschedule': bookingCancelReschedule,
  'staff-new-booking-alert': staffNewBookingAlert,
  'client-report': clientReport,
  'subscription-owner-alert': subscriptionOwnerAlert,
}