import { HttpError } from '../http';

export const MAX_API_BODY_BYTES = 10 * 1024 * 1024;

const UPLOAD_MEDIA_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-msdownload',
  'image/svg+xml',
  'text/html',
]);

/** Rejects upload-shaped requests before routing; no runtime upload endpoint exists. */
export function enforceUploadBoundary(request: Request): void {
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new HttpError(400, 'invalid_content_length');
    if (bytes > MAX_API_BODY_BYTES) throw new HttpError(413, 'payload_too_large');
  }

  const encoding = request.headers.get('Content-Encoding')?.trim().toLowerCase();
  if (encoding && encoding !== 'identity') throw new HttpError(415, 'unsupported_content_encoding');

  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  const uploadShaped = contentType?.startsWith('multipart/')
    || (contentType ? UPLOAD_MEDIA_TYPES.has(contentType) : false)
    || request.headers.has('Content-Disposition');
  if (uploadShaped) throw new HttpError(415, 'runtime_uploads_disabled');
}
