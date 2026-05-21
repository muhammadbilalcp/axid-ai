-- Admin access for muhammadbilalcp@gmail.com
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = 'muhammadbilalcp@gmail.com'
$$;

CREATE POLICY "admin can view all messages"
ON public.messages
FOR SELECT
USING (public.is_admin());

CREATE POLICY "admin can view all chats"
ON public.chats
FOR SELECT
USING (public.is_admin());

CREATE POLICY "admin can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin());