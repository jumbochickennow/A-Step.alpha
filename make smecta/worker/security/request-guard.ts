import { HttpError } from '../http';
import { MAX_UPLOAD_BYTES } from './upload-limits';

export const PUBLIC_BODY_LIMIT = 64 * 1024;
export const ADMIN_BODY_LIMIT = 512 * 1024;
export const ADMIN_PDF_BODY_LIMIT = MAX_UPLOAD_BYTES;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isAdminGuidePdfUpload(request: Request): boolean {
  return request.method === 'PUT'
    && /^\/api\/v1\/admin\/guides\/[^/]+\/pdf\/(?:en|fr|ar)$/.test(new URL(request.url).pathname);
}

export function isAdminOpportunityImageUpload(request: Request): boolean {
  return request.method === 'PUT'
    && /^\/api\/v1\/admin\/opportunities\/[^/]+\/image$/.test(new URL(request.url).pathname);
}

export function enforceRequestEnvelope(request: Request): void {
  if (!MUTATING_METHODS.has(request.method)) return;
  const pathname = new URL(request.url).pathname;
  const pdfUpload = isAdminGuidePdfUpload(request);
  const imageUpload = isAdminOpportunityImageUpload(request);
  const binaryUpload = pdfUpload || imageUpload;
  const passkeySignIn = pathname === '/api/v1/auth/sign-in';
  const maxBytes = binaryUpload ? MAX_UPLOAD_BYTES
    : passkeySignIn ? 2048
      : pathname.startsWith('/api/v1/admin/') ? ADMIN_BODY_LIMIT : PUBLIC_BODY_LIMIT;
  const declared = request.headers.get('Content-Length');
  if (declared) {
    const bytes = Number(declared);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new HttpError(400, 'invalid_content_length');
    if (bytes > maxBytes) throw new HttpError(413, 'payload_too_large');
  }

  const rawContentType = request.headers.get('Content-Type')?.trim().toLowerCase() ?? '';
  if (binaryUpload) {
    const allowed = pdfUpload
      ? rawContentType === 'application/pdf'
      : ['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(rawContentType);
    if (!allowed) throw new HttpError(415, 'unsupported_media_type');
    return;
  }
  const contentTypeParts = rawContentType.split(';').map((part) => part.trim());
  const validCharset = contentTypeParts.length === 1
    || (contentTypeParts.length === 2 && contentTypeParts[1] === 'charset=utf-8');
  if (rawContentType.length > 128 || rawContentType.includes(',')
    || contentTypeParts[0] !== 'application/json' || !validCharset) {
    throw new HttpError(415, 'unsupported_media_type');
  }
}
