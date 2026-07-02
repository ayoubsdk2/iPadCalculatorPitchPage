CREATE TABLE public.saved_calculations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_name text NOT NULL CHECK (char_length(trim(company_name)) BETWEEN 1 AND 200),
  calculator_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_calculations TO authenticated;
GRANT ALL ON public.saved_calculations TO service_role;

ALTER TABLE public.saved_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view saved calculator repository"
ON public.saved_calculations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own saved calculations"
ON public.saved_calculations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved calculations"
ON public.saved_calculations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved calculations"
ON public.saved_calculations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_saved_calculations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_saved_calculations_updated_at
BEFORE UPDATE ON public.saved_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_saved_calculations_updated_at();