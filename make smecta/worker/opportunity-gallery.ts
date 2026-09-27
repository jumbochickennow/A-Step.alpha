export interface GalleryRow { opportunity_id: string; slot: number; image_path: string }
export interface GalleryImage { slot: number; imagePath: string }

export async function galleryForOpportunities(db: D1Database, ids: string[]): Promise<Map<string, GalleryImage[]>> {
  const gallery = new Map<string, GalleryImage[]>();
  if (!ids.length) return gallery;
  const placeholders = ids.map(() => '?').join(', ');
  const { results } = await db.prepare(
    `SELECT opportunity_id, slot, image_path FROM opportunity_gallery_images
     WHERE opportunity_id IN (${placeholders}) ORDER BY opportunity_id, slot`,
  ).bind(...ids).all<GalleryRow>();
  for (const row of results) {
    const paths = gallery.get(row.opportunity_id) ?? [];
    paths.push({ slot: row.slot, imagePath: row.image_path });
    gallery.set(row.opportunity_id, paths);
  }
  return gallery;
}
