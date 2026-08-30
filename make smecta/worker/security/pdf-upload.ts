import { HttpError } from '../http';
import { MAX_UPLOAD_BYTES } from './upload-limits';

export const MAX_PDF_BYTES = MAX_UPLOAD_BYTES;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ACTIVE_MARKERS = [
  '/javascript', '/js', '/launch', '/openaction', '/aa', '/embeddedfile', '/richmedia',
  '<script', '<!doctype html', '<svg',
];

/** Streams a size-capped, magic-byte checked, passive PDF body to R2. */
export function validatedPdfBody(request: Request): ReadableStream<Uint8Array> {
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/pdf') {
    throw new HttpError(415, 'unsupported_media_type');
  }
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) throw new HttpError(413, 'payload_too_large');
  if (!request.body) throw new HttpError(400, 'empty_upload');

  let total = 0;
  const header: number[] = [];
  let carry = '';
  const decoder = new TextDecoder();

  return request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > MAX_PDF_BYTES) throw new HttpError(413, 'payload_too_large');
      for (let index = 0; index < chunk.length && header.length < PDF_MAGIC.length; index += 1) {
        header.push(chunk[index]);
      }
      if (header.length === PDF_MAGIC.length && header.some((byte, index) => byte !== PDF_MAGIC[index])) {
        throw new HttpError(400, 'invalid_pdf');
      }
      const text = `${carry}${decoder.decode(chunk, { stream: true })}`.toLowerCase();
      if (ACTIVE_MARKERS.some((marker) => text.includes(marker))) throw new HttpError(400, 'unsafe_pdf');
      carry = text.slice(-32);
      controller.enqueue(chunk);
    },
    flush() {
      const tail = `${carry}${decoder.decode()}`.toLowerCase();
      if (header.length !== PDF_MAGIC.length) throw new HttpError(400, 'invalid_pdf');
      if (ACTIVE_MARKERS.some((marker) => tail.includes(marker))) throw new HttpError(400, 'unsafe_pdf');
    },
  }));
}
