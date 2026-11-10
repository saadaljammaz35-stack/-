ALTER TABLE ai_messages ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE ai_conversations ALTER COLUMN created_at SET DEFAULT now();
