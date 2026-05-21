-- Blocked users table
CREATE TABLE public.blocked_users (
  user_id uuid PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage blocked users"
ON public.blocked_users
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "users can see own block status"
ON public.blocked_users
FOR SELECT
USING (auth.uid() = user_id);

-- Helper: is current user blocked
CREATE OR REPLACE FUNCTION public.is_blocked(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = _uid)
$$;

-- Block insert on messages/chats for blocked users
CREATE POLICY "blocked cannot insert messages"
ON public.messages
AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT public.is_blocked(auth.uid()));

CREATE POLICY "blocked cannot insert chats"
ON public.chats
AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT public.is_blocked(auth.uid()));

-- Admin delete on messages and chats
CREATE POLICY "admin delete messages"
ON public.messages
FOR DELETE
USING (public.is_admin());

CREATE POLICY "admin delete chats"
ON public.chats
FOR DELETE
USING (public.is_admin());

-- Admin user listing (with email + activity)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  message_count bigint,
  chat_count bigint,
  last_message_at timestamptz,
  is_blocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(m.cnt, 0) AS message_count,
    COALESCE(c.cnt, 0) AS chat_count,
    m.last_at AS last_message_at,
    (b.user_id IS NOT NULL) AS is_blocked
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
    FROM public.messages GROUP BY user_id
  ) m ON m.user_id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt
    FROM public.chats GROUP BY user_id
  ) c ON c.user_id = u.id
  LEFT JOIN public.blocked_users b ON b.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Admin stats
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_messages', (SELECT COUNT(*) FROM public.messages),
    'total_chats', (SELECT COUNT(*) FROM public.chats),
    'total_blocked', (SELECT COUNT(*) FROM public.blocked_users),
    'messages_today', (SELECT COUNT(*) FROM public.messages WHERE created_at > now() - interval '1 day'),
    'users_week', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '7 days')
  ) INTO result;

  RETURN result;
END;
$$;