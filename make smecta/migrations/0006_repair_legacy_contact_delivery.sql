UPDATE outbox_events
SET
  status = 'failed',
  delivered_at = NULL,
  available_at = CAST(strftime('%s', 'now') AS INTEGER),
  locked_at = NULL,
  last_error = 'legacy_browser_confirmation_unverified',
  updated_at = CURRENT_TIMESTAMP
WHERE event_type = 'contact.created'
  AND status = 'delivered'
  AND provider_message_id IS NULL;
