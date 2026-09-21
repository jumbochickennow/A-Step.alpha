ALTER TABLE outbox_events ADD COLUMN provider_message_id TEXT;

CREATE INDEX IF NOT EXISTS outbox_delivery_status_idx
  ON outbox_events(event_type, status, created_at DESC);
