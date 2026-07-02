-- ============================================================
-- pending_onboardings: commitment wizard submissions + Stripe/provisioning state
-- ============================================================
CREATE TABLE public.pending_onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  company_data jsonb NOT NULL,
  selected_packages jsonb NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  stripe_session_id text NULL,
  stripe_metered_item_id text NULL,
  retell_agent_id text NULL,
  telnyx_number text NULL,
  phaos_account_id text NULL,
  provisioning_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_onboardings_status_check CHECK (
    status IN ('pending_payment','paid','provisioning','live','failed','canceled')
  ),
  CONSTRAINT pending_onboardings_env_check CHECK (environment IN ('sandbox','live'))
);

CREATE INDEX idx_pending_onboardings_user ON public.pending_onboardings(user_id);
CREATE INDEX idx_pending_onboardings_status ON public.pending_onboardings(status);
CREATE INDEX idx_pending_onboardings_session ON public.pending_onboardings(stripe_session_id);
CREATE INDEX idx_pending_onboardings_subscription ON public.pending_onboardings(stripe_subscription_id);

GRANT SELECT ON public.pending_onboardings TO authenticated;
GRANT ALL ON public.pending_onboardings TO service_role;

ALTER TABLE public.pending_onboardings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding rows"
  ON public.pending_onboardings
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Service role manages onboardings"
  ON public.pending_onboardings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- stripe_prices: cache of programmatically-created Stripe Prices
-- ============================================================
CREATE TABLE public.stripe_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_product_id text NOT NULL,
  stripe_price_id text NOT NULL,
  unit_amount integer NULL,
  currency text NOT NULL DEFAULT 'usd',
  recurring_interval text NULL,
  usage_type text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_prices_env_check CHECK (environment IN ('sandbox','live')),
  CONSTRAINT stripe_prices_unique_sku UNIQUE (sku, environment)
);

GRANT ALL ON public.stripe_prices TO service_role;

ALTER TABLE public.stripe_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe prices"
  ON public.stripe_prices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Shared updated_at trigger (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pending_onboardings_touch_updated_at
  BEFORE UPDATE ON public.pending_onboardings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER stripe_prices_touch_updated_at
  BEFORE UPDATE ON public.stripe_prices
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
