-- Explicit destination per guide so the Guides page filters by data, not by slug substring.
ALTER TABLE guides ADD COLUMN country TEXT;

UPDATE guides SET country = 'france'  WHERE country IS NULL AND slug IN ('campus-france-guide', 'study-in-france-starter-guide');
UPDATE guides SET country = 'italy'   WHERE country IS NULL AND slug IN ('list-of-italian-universities', 'italy-scholarship-process', 'italy-scholarship-guide');
UPDATE guides SET country = 'canada'  WHERE country IS NULL AND slug IN ('canada-student-visa', 'canada-student-visa-checklist');
UPDATE guides SET country = 'china'   WHERE country IS NULL AND slug IN ('china-student-visa', 'china-list-of-universities', 'china-student-visa-guide');
UPDATE guides SET country = 'germany' WHERE country IS NULL AND slug IN ('germany-student-visa', 'list-of-german-institutions', 'germany-study-roadmap');
UPDATE guides SET country = 'poland'  WHERE country IS NULL AND slug IN ('poland-student-visa');
UPDATE guides SET country = 'europe'  WHERE country IS NULL AND slug IN ('list-of-european-universities');
