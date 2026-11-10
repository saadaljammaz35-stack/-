-- 0003_message_ordering — messages written in the same transaction (the
-- user's question and the assistant placeholder) shared one now() value,
-- which left their order ambiguous. clock_timestamp() advances within a
-- transaction, so created_at gives a strict order.
ALTER TABLE ai_messages ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE ai_conversations ALTER COLUMN created_at SET DEFAULT clock_timestamp();
