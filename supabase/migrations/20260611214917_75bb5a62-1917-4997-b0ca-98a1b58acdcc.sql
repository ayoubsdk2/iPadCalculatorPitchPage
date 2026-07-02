CREATE TABLE public.solution_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solution text NOT NULL,
  name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.solution_inquiries TO anon, authenticated;
GRANT ALL ON public.solution_inquiries TO service_role;

ALTER TABLE public.solution_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an inquiry"
  ON public.solution_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 320
    AND length(message) BETWEEN 10 AND 5000
    AND length(solution) BETWEEN 1 AND 100
  );