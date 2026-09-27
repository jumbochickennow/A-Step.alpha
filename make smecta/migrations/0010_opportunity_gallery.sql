CREATE TABLE opportunity_gallery_images (
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 6),
  image_path TEXT NOT NULL,
  PRIMARY KEY (opportunity_id, slot)
);
