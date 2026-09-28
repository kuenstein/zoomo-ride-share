CREATE TABLE public.payment_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 50 AND amount <= 10000),
  method text NOT NULL CHECK (method IN ('gcash','maya')),
  provider_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_checkouts TO authenticated;
GRANT ALL ON public.payment_checkouts TO service_role;
ALTER TABLE public.payment_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkouts read" ON public.payment_checkouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payment_checkouts_updated BEFORE UPDATE ON public.payment_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Credits the wallet exactly once for a verified paid checkout. Server-only.
CREATE OR REPLACE FUNCTION public.credit_paid_checkout(_session_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.payment_checkouts;
BEGIN
  SELECT * INTO c FROM public.payment_checkouts WHERE provider_session_id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','unknown session'); END IF;
  IF c.status = 'paid' THEN RETURN jsonb_build_object('success',true,'already',true); END IF;
  UPDATE public.payment_checkouts SET status='paid', paid_at=now() WHERE id=c.id;
  INSERT INTO public.wallets(user_id,balance) VALUES (c.user_id,0) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance = balance + c.amount, updated_at=now() WHERE user_id=c.user_id;
  INSERT INTO public.wallet_transactions(user_id,amount,kind,description)
    VALUES (c.user_id, c.amount, 'topup', 'Top-up via ' || CASE c.method WHEN 'gcash' THEN 'GCash' ELSE 'Maya' END);
  RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.credit_paid_checkout(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_paid_checkout(text) TO service_role;

-- Stop simulated top-ups from clients.
REVOKE EXECUTE ON FUNCTION public.wallet_topup(numeric) FROM PUBLIC, anon, authenticated;