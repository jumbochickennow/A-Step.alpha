import { HttpError } from '../http';
import { MAX_UPLOAD_BYTES } from './upload-limits';

export const IMAGE_MEDIA_TYPES = ['image/avif', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMediaType = typeof IMAGE_MEDIA_TYPES[number];

const EXTENSIONS: Record<ImageMediaType, string> = {
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function mediaType(request: Request): ImageMediaType {
  const value = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (!IMAGE_MEDIA_TYPES.includes(value as ImageMediaType)) throw new HttpError(415, 'unsupported_media_type');
  return value as ImageMediaType;
}

function hasExpectedSignature(type: ImageMediaType, bytes: number[]): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value);
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp'
    && ['avif', 'avis'].includes(String.fromCharCode(...bytes.slice(8, 12)));
}

export function imageExtensionForRequest(request: Request): string {
  return EXTENSIONS[mediaType(request)];
}

export interface ValidatedImageBody {
  body: ReadableStream<Uint8Array>;
  completion: Promise<void>;
}

/** Validates the signature before R2 sees bytes, then streams through a fixed-length size cap. */
export async function validatedImageBody(request: Request): Promise<ValidatedImageBody> {
  const type = mediaType(request);
  const declaredHeader = request.headers.get('Content-Length');
  if (declaredHeader === null) throw new HttpError(411, 'content_length_required');
  const declared = Number(declaredHeader);
  if (!Number.isSafeInteger(declared) || declared < 0) throw new HttpError(400, 'invalid_content_length');
  if (declared > MAX_UPLOAD_BYTES) throw new HttpError(413, 'payload_too_large');
  if (!request.body) throw new HttpError(400, 'empty_upload');

  const reader = request.body.getReader();
  const buffered: Uint8Array[] = [];
  const header: number[] = [];
  let total = 0;
  while (header.length < 12) {
    const result = await reader.read();
    if (result.done) break;
    const chunk = result.value;
    buffered.push(chunk);
    total += chunk.byteLength;
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel('payload_too_large').catch(() => undefined);
      throw new HttpError(413, 'payload_too_large');
    }
    for (let index = 0; index < chunk.length && header.length < 12; index += 1) header.push(chunk[index]);
  }
  if (header.length < 12 || !hasExpectedSignature(type, header)) {
    await reader.cancel('invalid_image').catch(() => undefined);
    throw new HttpError(400, 'invalid_image');
  }

  const validated = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
    },
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        controller.close();
        return;
      }
      const chunk = result.value;
      total += chunk.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        controller.error(new HttpError(413, 'payload_too_large'));
        await reader.cancel('payload_too_large').catch(() => undefined);
        return;
      }
      controller.enqueue(chunk);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  const fixedLength = typeof FixedLengthStream === 'undefined'
    ? new TransformStream<ArrayBuffer | ArrayBufferView, Uint8Array>()
    : new FixedLengthStream(declared);
  return {
    body: fixedLength.readable,
    completion: validated.pipeTo(fixedLength.writable),
  };
}
