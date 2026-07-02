import type { ComponentType } from 'react'
import { template as savedCalculatorShare } from './saved-calculator-share'
import { template as phomoBookingConfirmation } from './phomo-booking-confirmation'
import { template as phomoBookingCanceled } from './phomo-booking-canceled'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'saved-calculator-share': savedCalculatorShare,
  'phomo-booking-confirmation': phomoBookingConfirmation,
  'phomo-booking-canceled': phomoBookingCanceled,
}
