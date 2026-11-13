function requestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // LAN HTTP previews lack randomUUID; getRandomValues remains cryptographically secure.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

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
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('Idempotency-Key', requestId());

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

/** XHR is used only for authenticated uploads so the dashboard can report progress. */
export function apiUpload<T>(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', path);
    request.withCredentials = true;
    request.timeout = 120_000;
    request.setRequestHeader('Content-Type', contentType);
    request.setRequestHeader('Idempotency-Key', requestId());
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener('load', () => {
      let parsed: unknown = null;
      try { parsed = JSON.parse(request.responseText) as unknown; } catch { /* handled below */ }
      const data = parsed && typeof parsed === 'object'
        ? parsed as { error?: string | { code?: string; message?: string }; requestId?: string } & T
        : null;
      if (request.status < 200 || request.status >= 300 || data === null) {
        const detail = data && typeof data.error === 'object' ? data.error : undefined;
        reject(new ApiError(request.status, detail?.code ?? 'upload_failed', data?.requestId, detail?.message));
        return;
      }
      onProgress?.(100);
      resolve(data);
    });
    request.addEventListener('error', () => reject(new ApiError(0, 'network_error')));
    request.addEventListener('timeout', () => reject(new ApiError(0, 'upload_timeout')));
    request.send(file);
  });
}
