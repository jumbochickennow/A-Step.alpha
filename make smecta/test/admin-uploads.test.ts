import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminApi } from '../worker/admin-api';
import type { AdminIdentity } from '../worker/auth/auth-api';
import { HttpError } from '../worker/http';

const ORIGIN = 'https://www.astepimmigration.space';
const RESOURCE_REF_SECRET = 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM'; // secret-scan: allow-test-fixture
const identity: AdminIdentity = { id: 'upload-test-admin', role: 'superadmin' };
const translations = {
  en: { title: 'Test', description: 'Test description' },
  fr: { title: 'Test', description: 'Description de test' },
  ar: { title: 'اختبار', description: 'وصف الاختبار' },
};
const emptyTranslations = {
  en: { title: '', description: '' },
  fr: { title: '', description: '' },
  ar: { title: '', description: '' },
};

function request(path: string, method: string, body: BodyInit, contentType: string, key = crypto.randomUUID()) {
  const contentLength = typeof body === 'string' ? new TextEncoder().encode(body).byteLength
    : body instanceof Uint8Array ? body.byteLength : undefined;
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      'Content-Type': contentType,
      'Idempotency-Key': key,
      ...(contentLength === undefined ? {} : { 'Content-Length': String(contentLength) }),
    },
    body,
  });
}

async function createGuide(slug: string): Promise<string> {
  const response = await adminApi(request('/api/v1/admin/guides', 'POST', JSON.stringify({
    slug,
    category: 'France',
    filePath: 'client-supplied/not-verified.pdf',
    r2KeyEn: 'client-supplied/not-verified.pdf',
    r2KeyFr: null,
    r2KeyAr: null,
    fileType: 'PDF',
    pageCount: 1,
    coverPath: null,
    published: false,
    sortOrder: 1,
    contentUpdatedAt: '2026-08-31',
    translations,
  }), 'application/json'), env, identity);
  return (await response.json<{ resourceId: string }>()).resourceId;
}

function opportunityPayload(slug: string) {
  return {
    slug,
    country: 'France',
    categories: ['Scholarships'],
    applyUrl: null,
    opensAt: null,
    deadline: null,
    featured: false,
    published: false,
    translations,
  };
}

async function createOpportunity(slug: string): Promise<string> {
  const response = await adminApi(request('/api/v1/admin/opportunities', 'POST', JSON.stringify({
    ...opportunityPayload(slug),
    imagePath: 'client-controlled/legacy-image-reference.svg',
  }), 'application/json'), env, identity);
  return (await response.json<{ resourceId: string }>()).resourceId;
}

async function benignPdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage();
  return document.save();
}

async function realWorldPdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage();
  const linkAction = document.context.obj({
    S: PDFName.of('URI'),
    URI: PDFString.of('https://www.astepimmigration.space/guides'),
  });
  const link = document.context.register(document.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: [20, 20, 240, 50],
    Border: [0, 0, 0],
    A: linkAction,
  }));
  page.node.set(PDFName.of('Annots'), document.context.obj([link]));

  const outlines = document.context.obj({ Type: PDFName.of('Outlines'), Count: 1 });
  const outlinesRef = document.context.register(outlines);
  const outlineItem = document.context.register(document.context.obj({
    Title: PDFString.of('Guide start'),
    Parent: outlinesRef,
    Dest: [page.ref, PDFName.of('Fit')],
  }));
  outlines.set(PDFName.of('First'), outlineItem);
  outlines.set(PDFName.of('Last'), outlineItem);
  document.catalog.set(PDFName.of('Outlines'), outlinesRef);
  document.catalog.set(PDFName.of('Names'), document.context.obj({
    Dests: document.context.obj({
      Names: [PDFString.of('guide-start'), [page.ref, PDFName.of('XYZ'), 0, 0, 1]],
    }),
  }));
  document.catalog.set(PDFName.of('OpenAction'), document.context.obj([page.ref, PDFName.of('Fit')]));
  document.catalog.set(PDFName.of('Metadata'), document.context.flateStream('<metadata/>', {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  }));

  const bytes = await document.save({ useObjectStreams: true });
  expect(new TextDecoder().decode(bytes)).toContain('/ObjStm');
  return bytes;
}

type DangerousPdfKind = 'JavaScript' | 'Launch' | 'XFA' | 'EmbeddedFiles';

async function dangerousPdf(kind: DangerousPdfKind): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage();
  if (kind === 'JavaScript' || kind === 'Launch') {
    const action = document.context.register(document.context.obj({ S: PDFName.of(kind) }));
    const annotation = document.context.register(document.context.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Link'),
      Rect: [20, 20, 240, 50],
      A: action,
    }));
    page.node.set(PDFName.of('Annots'), document.context.obj([annotation]));
  } else if (kind === 'XFA') {
    document.catalog.set(PDFName.of('AcroForm'), document.context.obj({
      XFA: document.context.flateStream('<xfa/>'),
    }));
  } else {
    document.catalog.set(PDFName.of('Names'), document.context.obj({
      EmbeddedFiles: document.context.obj({ Names: [] }),
    }));
  }
  return document.save({ useObjectStreams: true });
}

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO admin_users (id, email, role, created_at, last_authenticated_at)
     VALUES (?1, ?2, 'owner', ?3, ?3)`,
  ).bind(identity.id, 'upload-test@internal.invalid', now).run();
});

describe('admin guide uploads', () => {
  it('accepts PDF 1.5+ object streams with HTTPS links, bookmarks, and named destinations', async () => {
    const ref = await createGuide(`guide-real-world-${crypto.randomUUID()}`);
    const path = `/api/v1/admin/guides/${encodeURIComponent(ref)}/pdf/en`;
    const response = await adminApi(request(path, 'PUT', await realWorldPdf(), 'application/pdf'), env, identity);
    expect(response.status).toBe(200);
    await adminApi(
      request(`/api/v1/admin/guides/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'),
      env,
      identity,
    );
  });

  it.each<DangerousPdfKind>(['JavaScript', 'Launch', 'XFA', 'EmbeddedFiles'])(
    'rejects PDFs containing %s active content',
    async (kind) => {
      const ref = await createGuide(`guide-dangerous-${kind.toLowerCase()}-${crypto.randomUUID()}`);
      const path = `/api/v1/admin/guides/${encodeURIComponent(ref)}/pdf/en`;
      await expect(adminApi(
        request(path, 'PUT', await dangerousPdf(kind), 'application/pdf'),
        env,
        identity,
      )).rejects.toMatchObject({ status: 400, code: 'unsafe_pdf' } satisfies Partial<HttpError>);
    },
  );

  it('ignores client storage pointers and attaches one idempotent validated R2 object', async () => {
    const ref = await createGuide(`guide-${crypto.randomUUID()}`);
    const initial = await env.DB.prepare(
      'SELECT id, storage_object_path, r2_key_en FROM guides WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1',
    ).bind(identity.id).first<{ id: string; storage_object_path: string | null; r2_key_en: string | null }>();
    expect(initial).toMatchObject({ storage_object_path: null, r2_key_en: null });

    const bytes = await benignPdf();
    const key = crypto.randomUUID();
    const path = `/api/v1/admin/guides/${encodeURIComponent(ref)}/pdf/en`;
    const first = await adminApi(request(path, 'PUT', bytes, 'application/pdf', key), env, identity);
    const firstKey = (await first.json<{ objectKey: string }>()).objectKey;
    const second = await adminApi(request(path, 'PUT', bytes, 'application/pdf', key), env, identity);
    expect((await second.json<{ objectKey: string }>()).objectKey).toBe(firstKey);
    expect((await env.GUIDES_BUCKET.list({ prefix: `a-step-guides/${initial!.id}/en/` })).objects).toHaveLength(1);
    expect((await env.DB.prepare('SELECT r2_key_en FROM guides WHERE id = ?1').bind(initial!.id)
      .first<{ r2_key_en: string }>())?.r2_key_en).toBe(firstKey);

    await adminApi(request(`/api/v1/admin/guides/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
    expect(await env.GUIDES_BUCKET.head(firstKey)).toBeNull();
  });

  it('removes the R2 object when the metadata transaction fails', async () => {
    const ref = await createGuide(`guide-rollback-${crypto.randomUUID()}`);
    await env.DB.prepare(`CREATE TRIGGER fail_guide_upload BEFORE UPDATE OF r2_key_en ON guides
      BEGIN SELECT RAISE(FAIL, 'forced guide metadata failure'); END`).run();
    const path = `/api/v1/admin/guides/${encodeURIComponent(ref)}/pdf/en`;
    await expect(adminApi(request(path, 'PUT', await benignPdf(), 'application/pdf'), env, identity))
      .rejects.toMatchObject({ code: 'upload_metadata_failed' } satisfies Partial<HttpError>);
    expect((await env.GUIDES_BUCKET.list({ prefix: 'a-step-guides/' })).objects).toHaveLength(0);
  });
});

describe('admin opportunity image uploads', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it('creates an unpublished draft, preserves uploaded bytes, and publishes after translations are completed', async () => {
    const slug = `opportunity-draft-${crypto.randomUUID()}`;
    const draft = await adminApi(request('/api/v1/admin/opportunities', 'POST', JSON.stringify({
      ...opportunityPayload(slug),
      published: false,
      translations: emptyTranslations,
    }), 'application/json'), env, identity);
    expect(draft.status).toBe(201);
    const ref = (await draft.json<{ resourceId: string }>()).resourceId;

    const upload = await adminApi(request(
      `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`,
      'PUT',
      png,
      'image/png',
    ), env, identity);
    const imagePath = (await upload.json<{ imagePath: string }>()).imagePath;
    const stored = await env.OPPORTUNITY_IMAGES_BUCKET.get(`opportunity-images/${imagePath.split('/').at(-1)}`);
    expect(Array.from(new Uint8Array(await stored!.arrayBuffer()))).toEqual(Array.from(png));

    await expect(adminApi(request(
      `/api/v1/admin/opportunities/${encodeURIComponent(ref)}`,
      'PUT',
      JSON.stringify({ ...opportunityPayload(slug), id: ref, published: true, translations: emptyTranslations }),
      'application/json',
    ), env, identity)).rejects.toMatchObject({ status: 400, code: 'translation_required' } satisfies Partial<HttpError>);

    const published = await adminApi(request(
      `/api/v1/admin/opportunities/${encodeURIComponent(ref)}`,
      'PUT',
      JSON.stringify({ ...opportunityPayload(slug), id: ref, published: true }),
      'application/json',
    ), env, identity);
    expect(published.status).toBe(200);
    const row = await env.DB.prepare('SELECT published, image_path FROM opportunities WHERE slug = ?1')
      .bind(slug).first<{ published: number; image_path: string }>();
    expect(row).toEqual({ published: 1, image_path: imagePath });
    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
  });

  it.each([
    ['JPEG', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9])],
    ['WebP', 'image/webp', Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
    ['AVIF', 'image/avif', Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])],
  ])('accepts supported %s signatures without changing the file type', async (_label, contentType, bytes) => {
    const ref = await createOpportunity(`opportunity-format-${crypto.randomUUID()}`);
    const response = await adminApi(request(
      `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`,
      'PUT',
      bytes,
      contentType,
    ), env, identity);
    expect(response.status).toBe(200);
    const imagePath = (await response.json<{ imagePath: string }>()).imagePath;
    expect(imagePath.endsWith(contentType === 'image/jpeg' ? '.jpg' : `.${contentType.split('/')[1]}`)).toBe(true);
    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
  });

  it('ignores client storage pointers and preserves the image on metadata-only updates', async () => {
    const slug = `opportunity-${crypto.randomUUID()}`;
    const ref = await createOpportunity(slug);
    const initial = await env.DB.prepare(
      'SELECT id, image_path FROM opportunities WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1',
    ).bind(identity.id).first<{ id: string; image_path: string | null }>();
    expect(initial?.image_path).toBeNull();

    const key = crypto.randomUUID();
    const path = `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`;
    const first = await adminApi(request(path, 'PUT', png, 'image/png', key), env, identity);
    const imagePath = (await first.json<{ imagePath: string }>()).imagePath;
    const second = await adminApi(request(path, 'PUT', png, 'image/png', key), env, identity);
    expect((await second.json<{ imagePath: string }>()).imagePath).toBe(imagePath);
    expect((await env.OPPORTUNITY_IMAGES_BUCKET.list({ prefix: 'opportunity-images/' })).objects).toHaveLength(1);
    expect((await env.DB.prepare('SELECT image_path FROM opportunities WHERE id = ?1').bind(initial!.id)
      .first<{ image_path: string }>())?.image_path).toBe(imagePath);

    const update = await adminApi(request(
      `/api/v1/admin/opportunities/${encodeURIComponent(ref)}`,
      'PUT',
      JSON.stringify({ ...opportunityPayload(slug), id: ref, featured: true }),
      'application/json',
    ), env, identity);
    expect(update.status).toBe(200);
    expect((await env.DB.prepare('SELECT image_path FROM opportunities WHERE id = ?1').bind(initial!.id)
      .first<{ image_path: string }>())?.image_path).toBe(imagePath);

    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
    expect((await env.OPPORTUNITY_IMAGES_BUCKET.list({ prefix: 'opportunity-images/' })).objects).toHaveLength(0);
  });

  it('replaces an image only after persistence and removes the obsolete object', async () => {
    const ref = await createOpportunity(`opportunity-replace-${crypto.randomUUID()}`);
    const path = `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`;
    const first = await adminApi(request(path, 'PUT', png, 'image/png'), env, identity);
    const firstPath = (await first.json<{ imagePath: string }>()).imagePath;
    const second = await adminApi(request(path, 'PUT', png, 'image/png'), env, identity);
    const secondPath = (await second.json<{ imagePath: string }>()).imagePath;

    expect(secondPath).not.toBe(firstPath);
    expect((await env.OPPORTUNITY_IMAGES_BUCKET.list({ prefix: 'opportunity-images/' })).objects).toHaveLength(1);
    expect(await env.OPPORTUNITY_IMAGES_BUCKET.head(`opportunity-images/${firstPath.split('/').at(-1)}`)).toBeNull();
    expect((await env.DB.prepare('SELECT image_path FROM opportunities WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1')
      .bind(identity.id).first<{ image_path: string }>())?.image_path).toBe(secondPath);
    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
  });

  it('rejects an invalid image without changing the existing reference', async () => {
    const ref = await createOpportunity(`opportunity-invalid-${crypto.randomUUID()}`);
    const path = `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`;
    const first = await adminApi(request(path, 'PUT', png, 'image/png'), env, identity);
    const firstPath = (await first.json<{ imagePath: string }>()).imagePath;

    await expect(adminApi(request(path, 'PUT', Uint8Array.from({ length: 12 }, () => 0), 'image/png'), env, identity))
      .rejects.toMatchObject({ status: 400, code: 'invalid_image' } satisfies Partial<HttpError>);
    expect((await env.DB.prepare('SELECT image_path FROM opportunities WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1')
      .bind(identity.id).first<{ image_path: string }>())?.image_path).toBe(firstPath);
    expect((await env.OPPORTUNITY_IMAGES_BUCKET.list({ prefix: 'opportunity-images/' })).objects).toHaveLength(1);
    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
  });

  it('removes only the new R2 object when the metadata update fails', async () => {
    const ref = await createOpportunity(`opportunity-rollback-${crypto.randomUUID()}`);
    const path = `/api/v1/admin/opportunities/${encodeURIComponent(ref)}/image`;
    const first = await adminApi(request(path, 'PUT', png, 'image/png'), env, identity);
    const firstPath = (await first.json<{ imagePath: string }>()).imagePath;
    await env.DB.prepare(`CREATE TRIGGER fail_opportunity_upload BEFORE UPDATE OF image_path ON opportunities
      BEGIN SELECT RAISE(FAIL, 'forced opportunity metadata failure'); END`).run();
    await expect(adminApi(request(path, 'PUT', png, 'image/png'), env, identity))
      .rejects.toMatchObject({ code: 'upload_metadata_failed' } satisfies Partial<HttpError>);
    expect((await env.DB.prepare('SELECT image_path FROM opportunities WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1')
      .bind(identity.id).first<{ image_path: string }>())?.image_path).toBe(firstPath);
    expect((await env.OPPORTUNITY_IMAGES_BUCKET.list({ prefix: 'opportunity-images/' })).objects).toHaveLength(1);
    await adminApi(request(`/api/v1/admin/opportunities/${encodeURIComponent(ref)}`, 'DELETE', '{}', 'application/json'), env, identity);
  });
});

describe('admin role enforcement', () => {
  it('rejects content mutation by data-only roles', async () => {
    const analyst: AdminIdentity = { id: identity.id, role: 'analyst' };
    await expect(adminApi(request('/api/v1/admin/guides', 'POST', '{}', 'application/json'), env, analyst))
      .rejects.toMatchObject({ status: 403, code: 'forbidden' } satisfies Partial<HttpError>);
  });
});
