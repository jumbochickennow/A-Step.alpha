import { HttpError } from '../http';

export const PUBLIC_BODY_LIMIT = 64 * 1024;
export const ADMIN_BODY_LIMIT = 512 * 1024;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function enforceRequestEnvelope(request: Request): void {
  if (!MUTATING_METHODS.has(request.method)) return;
  const pathname = new URL(request.url).pathname;
  const maxBytes = pathname.startsWith('/api/v1/admin/') ? ADMIN_BODY_LIMIT : PUBLIC_BODY_LIMIT;
  const declared = request.headers.get('Content-Length');
  if (declared) {
    const bytes = Number(declared);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new HttpError(400, 'invalid_content_length');
    if (bytes > maxBytes) throw new HttpError(413, 'payload_too_large');
  }

  const rawContentType = request.headers.get('Content-Type')?.trim().toLowerCase() ?? '';
  const contentTypeParts = rawContentType.split(';').map((part) => part.trim());
  const validCharset = contentTypeParts.length === 1
    || (contentTypeParts.length === 2 && contentTypeParts[1] === 'charset=utf-8');
  if (rawContentType.length > 128 || rawContentType.includes(',')
    || contentTypeParts[0] !== 'application/json' || !validCharset) {
    throw new HttpError(415, 'unsupported_media_type');
  }
}
