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
  if (status === 400) return 'Bad request';
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not found';
  if (status === 405) return 'Method not allowed';
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
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'payload_too_large');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new HttpError(413, 'payload_too_large');
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
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
