export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

const API_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(API_HEADERS);
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.append(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}

function publicErrorMessage(status: number, code?: string): string {
  if (code === 'invalid_sign_in_request') return 'Admin passkey is required.';
  if (code === 'invalid_passkey') return 'Invalid admin passkey.';
  if (code === 'admin_password_not_configured') return 'Admin passkey authentication is not configured.';
  if (code === 'origin_forbidden') return 'Request origin is not allowed.';
  if (code === 'db_error') return 'Admin authentication store is unavailable.';
  if (code === 'validation_failed') return 'One or more fields are invalid.';
  if (code === 'translation_required') return 'Complete the title and description in English, French, and Arabic before publishing.';
  if (code === 'invalid_opportunity_url') return 'Application URL must be a valid HTTPS address.';
  if (code === 'invalid_opportunity_details') return 'Enter a valid slug, country, category, dates, and opportunity details.';
  if (code === 'invalid_pdf') return 'The selected file is not a valid PDF.';
  if (code === 'invalid_image') return 'The selected file is not a valid PNG, JPEG, WebP, or AVIF image.';
  if (code === 'unsafe_pdf') return 'The selected PDF contains active content and was rejected.';
  if (code === 'empty_upload') return 'Select a file before uploading.';
  if (code === 'invalid_content_length') return 'The upload size header is invalid.';
  if (code === 'content_length_required') return 'The upload size header is required.';
  if (code === 'upload_storage_failed') return 'Unable to persist the uploaded file.';
  if (code === 'upload_metadata_failed') return 'The file was stored but could not be attached to the record.';
  if (code === 'upload_conflict') return 'This record changed during upload. Refresh and try again.';
  if (code === 'conflict') return 'A record with that slug already exists.';
  if (code === 'service_unavailable') return 'The admin data store is temporarily unavailable.';
  if (status === 400) return 'Bad request';
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not found';
  if (status === 405) return 'Method not allowed';
  if (status === 409) return 'Conflict';
  if (status === 413) return 'Payload too large';
  if (status === 415) return 'Unsupported media type';
  if (status === 429) return 'Too many requests';
  if (status === 503) return 'Service unavailable';
  return 'Internal server error';
}

export function errorResponse(error: unknown, requestId: string): Response {
  const status = error instanceof HttpError ? error.status : 500;
  if (error instanceof HttpError) {
    console.warn('API request rejected', { requestId, status, code: error.code });
  } else {
    console.error('Unhandled API error', { requestId, type: error instanceof Error ? error.name : 'unknown' });
  }
  return json({
    error: {
      code: error instanceof HttpError ? error.code : 'internal_error',
      message: publicErrorMessage(status, error instanceof HttpError ? error.code : undefined),
    },
    requestId,
  }, status);
}

export function attachRequestId(response: Response, requestId: string): Response {
  const identified = new Response(response.body, response);
  identified.headers.set('X-Request-ID', requestId);
  return identified;
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new HttpError(415, 'unsupported_media_type');
  const length = request.headers.get('Content-Length');
  if (length !== null && !/^\d+$/.test(length)) throw new HttpError(400, 'invalid_content_length');
  if (length !== null && Number(length) > maxBytes) throw new HttpError(413, 'payload_too_large');
  const reader = request.body?.getReader();
  const bytes = new Uint8Array(maxBytes);
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new HttpError(413, 'payload_too_large');
        }
        bytes.set(value, size - value.byteLength);
      }
    } finally { reader.releaseLock(); }
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size))) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function requireMethod(request: Request, allowed: string[]): void {
  if (!allowed.includes(request.method)) throw new HttpError(405, 'method_not_allowed');
}

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get('Idempotency-Key')?.trim();
  if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new HttpError(400, 'invalid_idempotency_key');
  }
  return key;
}
