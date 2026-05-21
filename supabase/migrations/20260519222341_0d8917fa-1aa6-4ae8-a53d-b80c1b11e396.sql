CREATE TABLE public.instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  token TEXT NOT NULL,
  jid TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read instances" ON public.instances FOR SELECT USING (true);
CREATE POLICY "Public insert instances" ON public.instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update instances" ON public.instances FOR UPDATE USING (true);
CREATE POLICY "Public delete instances" ON public.instances FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_instances_updated_at
BEFORE UPDATE ON public.instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();