-- Same card contract as opportunities; separate records and admin references.
CREATE TABLE resources (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 country TEXT NOT NULL DEFAULT 'Resource',
 categories TEXT NOT NULL DEFAULT '["Resources"]',
 image_path TEXT,
 apply_url TEXT,
 opens_at TEXT,
 deadline TEXT NOT NULL,
 featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
 published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
 translations TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX resources_public_expiry ON resources(published, deadline);
