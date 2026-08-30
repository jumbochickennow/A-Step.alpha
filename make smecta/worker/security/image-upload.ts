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

/** Streams a size-capped image to R2 after MIME and magic-byte validation. */
export function validatedImageBody(request: Request): ReadableStream<Uint8Array> {
  const type = mediaType(request);
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) throw new HttpError(413, 'payload_too_large');
  if (!request.body) throw new HttpError(400, 'empty_upload');

  let total = 0;
  const header: number[] = [];
  let signatureChecked = false;
  return request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > MAX_UPLOAD_BYTES) throw new HttpError(413, 'payload_too_large');
      for (let index = 0; index < chunk.length && header.length < 12; index += 1) header.push(chunk[index]);
      if (!signatureChecked && header.length === 12) {
        signatureChecked = true;
        if (!hasExpectedSignature(type, header)) throw new HttpError(400, 'invalid_image');
      }
      controller.enqueue(chunk);
    },
    flush() {
      if (!signatureChecked || !hasExpectedSignature(type, header)) throw new HttpError(400, 'invalid_image');
    },
  }));
}
