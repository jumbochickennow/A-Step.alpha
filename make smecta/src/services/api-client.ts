export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
    message = code,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('Idempotency-Key', crypto.randomUUID());

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as { error?: string | { code?: string; message?: string }; requestId?: string } & T;
  if (!response.ok) {
    const code = typeof data.error === 'object' ? data.error?.code : undefined;
    const message = typeof data.error === 'object' ? data.error?.message : undefined;
    throw new ApiError(response.status, code ?? 'request_failed', data.requestId, message);
  }
  return data;
}

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('Idempotency-Key', crypto.randomUUID());
  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string | { code?: string }; requestId?: string };
    const code = typeof data.error === 'object' ? data.error?.code : undefined;
    throw new ApiError(response.status, code ?? 'request_failed', data.requestId);
  }
  return response.blob();
}
