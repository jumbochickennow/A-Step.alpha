CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'owner', 'editor', 'analyst')),
  created_at TEXT NOT NULL,
  last_authenticated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guide_assets (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name_ciphertext TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL,
  email_blind_index TEXT NOT NULL,
  message_ciphertext TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'fr', 'ar')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guide_download_leads (
  id TEXT PRIMARY KEY,
  name_ciphertext TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL,
  email_blind_index TEXT NOT NULL,
  phone_ciphertext TEXT,
  guide_slug TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'fr', 'ar')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email_ciphertext TEXT NOT NULL,
  email_blind_index TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'fr', 'ar')),
  unsubscribe_token TEXT NOT NULL UNIQUE,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  response TEXT,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS download_grants (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES guide_download_leads(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  guide_slug TEXT NOT NULL,
  object_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed IN (0, 1)),
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS guides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  storage_object_path TEXT,
  file_type TEXT NOT NULL DEFAULT 'PDF' CHECK (file_type = 'PDF'),
  page_count INTEGER NOT NULL CHECK (page_count BETWEEN 1 AND 2000),
  cover_path TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  content_updated_at TEXT NOT NULL,
  translations TEXT NOT NULL CHECK (json_valid(translations)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  country TEXT NOT NULL,
  categories TEXT NOT NULL CHECK (json_valid(categories)),
  image_path TEXT,
  apply_url TEXT,
  opens_at TEXT,
  deadline TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  translations TEXT NOT NULL CHECK (json_valid(translations)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('guide_lead.created', 'contact.created', 'newsletter.subscribed')),
  aggregate_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  available_at INTEGER NOT NULL,
  locked_at INTEGER,
  delivered_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS contact_submissions_email_idx ON contact_submissions(email_blind_index);
CREATE INDEX IF NOT EXISTS contact_submissions_created_idx ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS guide_download_leads_email_idx ON guide_download_leads(email_blind_index);
CREATE INDEX IF NOT EXISTS guide_download_leads_created_idx ON guide_download_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS download_grants_expiry_idx ON download_grants(expires_at, consumed);
CREATE INDEX IF NOT EXISTS idempotency_expiry_idx ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS guides_owner_idx ON guides(user_id, sort_order);
CREATE INDEX IF NOT EXISTS opportunities_owner_idx ON opportunities(user_id, deadline);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox_events(status, available_at, created_at);

INSERT OR IGNORE INTO guide_assets (id, slug, object_key, created_at) VALUES
  ('q1', 'list-of-italian-universities', 'list-of-italian-universities.pdf', CURRENT_TIMESTAMP),
  ('q2', 'china-student-visa', 'china-student-visa.pdf', CURRENT_TIMESTAMP),
  ('q3', 'campus-france-guide', 'campus-france-guide.pdf', CURRENT_TIMESTAMP),
  ('q4', 'canada-student-visa', 'canada-student-visa.pdf', CURRENT_TIMESTAMP),
  ('q5', 'cabin-crew-application-guide', 'cabin-crew-application-guide.pdf', CURRENT_TIMESTAMP),
  ('q6', 'poland-student-visa', 'poland-student-visa.pdf', CURRENT_TIMESTAMP),
  ('q7', 'italy-scholarship-process', 'italy-scholarship-process.pdf', CURRENT_TIMESTAMP),
  ('q8', 'china-list-of-universities', 'china-list-of-universities.pdf', CURRENT_TIMESTAMP),
  ('q9', 'list-of-european-universities', 'list-of-european-universities.pdf', CURRENT_TIMESTAMP),
  ('q10', 'germany-student-visa', 'germany-student-visa.pdf', CURRENT_TIMESTAMP),
  ('q11', 'list-of-german-institutions', 'list-of-german-institutions.pdf', CURRENT_TIMESTAMP),
  ('q12', 'cabin-crew-interview-questions', 'cabin-crew-interview-questions.pdf', CURRENT_TIMESTAMP);
