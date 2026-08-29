import seedContent from '../src/data/content.json';
import type { Env } from './env';
import { HttpError } from './http';

const CATALOG_SEED_KEY = 'system:admin-catalog:v1';
const MASTER_ADMIN_ID = 'master-password-admin';
const MASTER_ADMIN_EMAIL = 'admin@a-step.org';

export async function seedAdminCatalog(env: Env): Promise<void> {
  const seeded = await env.DB.prepare(
    'SELECT key FROM idempotency_keys WHERE key = ?1 LIMIT 1',
  ).bind(CATALOG_SEED_KEY).first<{ key: string }>();
  if (seeded) return;

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO admin_users (id, email, role, created_at, last_authenticated_at)
       VALUES (?1, ?2, 'owner', ?3, ?3)`,
    ).bind(MASTER_ADMIN_ID, MASTER_ADMIN_EMAIL, now),
  ];

  for (const guide of seedContent.guides) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO guides
        (id, user_id, slug, category, storage_object_path, r2_key_en, r2_key_fr, r2_key_ar,
         file_type, page_count, cover_path, published, sort_order, content_updated_at,
         translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4,
         (SELECT COALESCE(r2_key_en, object_key) FROM guide_assets WHERE slug = ?3),
         (SELECT COALESCE(r2_key_en, object_key) FROM guide_assets WHERE slug = ?3),
         (SELECT r2_key_fr FROM guide_assets WHERE slug = ?3),
         (SELECT r2_key_ar FROM guide_assets WHERE slug = ?3),
         'PDF', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`,
    ).bind(
      guide.id,
      MASTER_ADMIN_ID,
      guide.slug,
      guide.category,
      Math.max(1, guide.pageCount),
      guide.coverPath,
      guide.published ? 1 : 0,
      guide.sortOrder,
      guide.contentUpdatedAt,
      JSON.stringify(guide.translations),
      now,
    ));
  }

  for (const opportunity of seedContent.opportunities) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO opportunities
        (id, user_id, slug, country, categories, image_path, apply_url, opens_at, deadline,
         featured, published, translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
    ).bind(
      opportunity.id,
      MASTER_ADMIN_ID,
      opportunity.slug,
      opportunity.country,
      JSON.stringify(opportunity.categories),
      opportunity.imagePath,
      opportunity.applyUrl,
      opportunity.opensAt,
      opportunity.deadline,
      opportunity.featured ? 1 : 0,
      opportunity.published ? 1 : 0,
      JSON.stringify(opportunity.translations),
      now,
    ));
  }

  statements.push(env.DB.prepare(
    `INSERT INTO idempotency_keys (key, action, response, created_at, expires_at)
     VALUES (?1, 'catalog_seed', NULL, ?2, 4102444800)`,
  ).bind(CATALOG_SEED_KEY, now));

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('[Catalog] D1 seed failed', { type: error instanceof Error ? error.name : 'unknown' });
    throw new HttpError(503, 'catalog_seed_failed');
  }
}
