ALTER TABLE public.pending_onboardings
  ADD COLUMN IF NOT EXISTS voice_usage_subscription_item_id text;

-- Broaden status check so webhook + cron can set granular values.
ALTER TABLE public.pending_onboardings
  DROP CONSTRAINT IF EXISTS pending_onboardings_status_check;
ALTER TABLE public.pending_onboardings
  ADD CONSTRAINT pending_onboardings_status_check
  CHECK (status IN (
    'pending_payment',
    'paid',
    'provisioning_started',
    'provisioning',
    'provisioning_complete',
    'live',
    'failed',
    'canceled'
  ));