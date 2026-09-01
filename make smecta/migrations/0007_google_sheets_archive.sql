ALTER TABLE outbox_events ADD COLUMN archive_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (archive_status IN ('pending', 'failed', 'delivered'));
ALTER TABLE outbox_events ADD COLUMN archive_attempts INTEGER NOT NULL DEFAULT 0
  CHECK (archive_attempts BETWEEN 0 AND 100);
ALTER TABLE outbox_events ADD COLUMN archived_at TEXT;
ALTER TABLE outbox_events ADD COLUMN archive_last_error TEXT;
ALTER TABLE outbox_events ADD COLUMN archive_row_id TEXT;

CREATE INDEX IF NOT EXISTS outbox_archive_pending_idx
  ON outbox_events(archive_status, available_at, created_at);

-- Re-queue previously emailed events so the new Sheet receives the historical
-- records. provider_message_id is retained, preventing duplicate contact mail.
UPDATE outbox_events
SET status = 'pending', delivered_at = NULL, locked_at = NULL,
    available_at = unixepoch(), last_error = NULL, updated_at = CURRENT_TIMESTAMP
WHERE status = 'delivered';
