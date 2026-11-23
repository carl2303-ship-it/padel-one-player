-- ============================================
-- DIRECT MESSAGES for Padel One Player
-- Project: rqiwnxcexsccguruiteq (padel1)
-- Run in Supabase Dashboard > SQL Editor if not yet applied
-- ============================================

CREATE TABLE IF NOT EXISTS direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  created_at timestamptz DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS direct_conversations_last_message_at_idx
  ON direct_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS direct_conversations_user_a_idx
  ON direct_conversations (user_a);
CREATE INDEX IF NOT EXISTS direct_conversations_user_b_idx
  ON direct_conversations (user_b);
CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx
  ON direct_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_sender_idx
  ON direct_messages (sender_id);

ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read conversations" ON direct_conversations;
CREATE POLICY "Participants can read conversations" ON direct_conversations
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Authenticated can create conversations" ON direct_conversations;
CREATE POLICY "Authenticated can create conversations" ON direct_conversations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (auth.uid() = user_a OR auth.uid() = user_b)
    AND user_a < user_b
  );

DROP POLICY IF EXISTS "Participants can update conversations" ON direct_conversations;
CREATE POLICY "Participants can update conversations" ON direct_conversations
  FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Participants can read messages" ON direct_messages;
CREATE POLICY "Participants can read messages" ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM direct_conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON direct_messages;
CREATE POLICY "Participants can send messages" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM direct_conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Recipients can mark messages read" ON direct_messages;
CREATE POLICY "Recipients can mark messages read" ON direct_messages
  FOR UPDATE USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM direct_conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Realtime (opcional, para chat live)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Storage: bucket "community" already exists (public read, auth upload).
-- DMs reuse community/dms/{userId}/... — no new bucket required.
