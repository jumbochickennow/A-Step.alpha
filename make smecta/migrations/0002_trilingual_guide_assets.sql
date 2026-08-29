ALTER TABLE guide_assets ADD COLUMN r2_key_en TEXT;
ALTER TABLE guide_assets ADD COLUMN r2_key_fr TEXT;
ALTER TABLE guide_assets ADD COLUMN r2_key_ar TEXT;

UPDATE guide_assets SET r2_key_en = object_key WHERE r2_key_en IS NULL;

INSERT OR IGNORE INTO guide_assets (id, slug, object_key, r2_key_en, created_at) VALUES
  ('fallback-guide-france', 'study-in-france-starter-guide', 'study-in-france-starter-guide.pdf', 'study-in-france-starter-guide.pdf', CURRENT_TIMESTAMP),
  ('fallback-guide-italy', 'italy-scholarship-guide', 'italy-scholarship-guide.pdf', 'italy-scholarship-guide.pdf', CURRENT_TIMESTAMP),
  ('fallback-guide-canada', 'canada-student-visa-checklist', 'canada-student-visa-checklist.pdf', 'canada-student-visa-checklist.pdf', CURRENT_TIMESTAMP),
  ('fallback-guide-china', 'china-student-visa-guide', 'china-student-visa-guide.pdf', 'china-student-visa-guide.pdf', CURRENT_TIMESTAMP),
  ('fallback-guide-germany', 'germany-study-roadmap', 'germany-study-roadmap.pdf', 'germany-study-roadmap.pdf', CURRENT_TIMESTAMP);

ALTER TABLE guides ADD COLUMN r2_key_en TEXT;
ALTER TABLE guides ADD COLUMN r2_key_fr TEXT;
ALTER TABLE guides ADD COLUMN r2_key_ar TEXT;

UPDATE guides SET r2_key_en = storage_object_path WHERE r2_key_en IS NULL;

ALTER TABLE guide_download_leads ADD COLUMN full_name_ciphertext TEXT;
ALTER TABLE guide_download_leads ADD COLUMN guide_id TEXT;
ALTER TABLE guide_download_leads ADD COLUMN guide_language TEXT;
ALTER TABLE guide_download_leads ADD COLUMN target_country TEXT;

UPDATE guide_download_leads
SET full_name_ciphertext = name_ciphertext,
    guide_id = COALESCE((SELECT id FROM guide_assets WHERE guide_assets.slug = guide_download_leads.guide_slug), guide_slug),
    guide_language = 'en'
WHERE full_name_ciphertext IS NULL OR guide_id IS NULL OR guide_language IS NULL;

ALTER TABLE download_grants ADD COLUMN guide_id TEXT;
ALTER TABLE download_grants ADD COLUMN guide_language TEXT;

UPDATE download_grants
SET guide_id = COALESCE((SELECT id FROM guide_assets WHERE guide_assets.slug = download_grants.guide_slug), guide_slug),
    guide_language = 'en'
WHERE guide_id IS NULL OR guide_language IS NULL;

CREATE INDEX IF NOT EXISTS guide_download_leads_guide_idx
  ON guide_download_leads(guide_id, guide_language, created_at DESC);
