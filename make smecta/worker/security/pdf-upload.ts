import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRef,
  PDFStream,
  PDFString,
} from 'pdf-lib';
import { HttpError } from '../http';
import { MAX_UPLOAD_BYTES } from './upload-limits';

export const MAX_PDF_BYTES = MAX_UPLOAD_BYTES;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const DANGEROUS_KEYS = new Set([
  'EmbeddedFiles', 'EF', 'JavaScript', 'JS', 'Launch', 'RichMedia', 'RichMediaContent',
  'Screen', 'Sound', 'Movie', 'Rendition', 'SubmitForm', 'ResetForm', 'ImportData', 'XFA',
]);
const DANGEROUS_ACTION_TYPES = new Set([
  'ImportData', 'JavaScript', 'Launch', 'Movie', 'Rendition', 'Sound', 'SubmitForm',
  'ResetForm',
]);
const DANGEROUS_OBJECT_TYPES = new Set(['EmbeddedFile', 'RichMedia', 'RichMediaContent']);
const DANGEROUS_ANNOTATION_TYPES = new Set(['RichMedia', 'Screen', 'Sound', 'Movie']);
const PAGE_VIEW_MODES = new Set(['XYZ', 'Fit', 'FitH', 'FitV', 'FitR', 'FitB', 'FitBH', 'FitBV']);
const MAX_PDF_OBJECTS = 100_000;

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) throw new HttpError(400, 'empty_upload');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await reader.cancel('payload_too_large');
        throw new HttpError(413, 'payload_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new HttpError(400, 'empty_upload');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function resolveObject(object: PDFObject | undefined, document: PDFDocument): PDFObject | undefined {
  return object instanceof PDFRef ? document.context.lookup(object) : object;
}

function decodedString(object: PDFObject | undefined): string | undefined {
  return object instanceof PDFString || object instanceof PDFHexString ? object.decodeText() : undefined;
}

function assertSafeUriAction(dict: PDFDict, document: PDFDocument): void {
  const uri = decodedString(resolveObject(dict.get(PDFName.of('URI')), document));
  if (!uri) throw new HttpError(400, 'unsafe_pdf');
  try {
    const parsed = new URL(uri);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      throw new HttpError(400, 'unsafe_pdf');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'unsafe_pdf');
  }
}

function assertPageDestination(object: PDFObject | undefined, document: PDFDocument): void {
  const resolved = resolveObject(object, document);
  if (resolved instanceof PDFName || resolved instanceof PDFString || resolved instanceof PDFHexString) return;
  if (!(resolved instanceof PDFArray) || resolved.size() < 2) throw new HttpError(400, 'unsafe_pdf');
  const page = resolveObject(resolved.get(0), document);
  const mode = resolveObject(resolved.get(1), document);
  if (!(page instanceof PDFDict || page instanceof PDFNumber) || !(mode instanceof PDFName)
    || !PAGE_VIEW_MODES.has(mode.decodeText())) {
    throw new HttpError(400, 'unsafe_pdf');
  }
}

function assertSafeAction(dict: PDFDict, document: PDFDocument): void {
  const actionType = dict.lookupMaybe(PDFName.of('S'), PDFName)?.decodeText();
  if (!actionType) throw new HttpError(400, 'unsafe_pdf');
  if (DANGEROUS_ACTION_TYPES.has(actionType)) throw new HttpError(400, 'unsafe_pdf');
  if (actionType === 'URI') assertSafeUriAction(dict, document);
  if (actionType === 'GoTo') assertPageDestination(dict.get(PDFName.of('D')), document);
}

function assertSafeOpenAction(object: PDFObject | undefined, document: PDFDocument): void {
  const resolved = resolveObject(object, document);
  if (resolved instanceof PDFDict) {
    if (resolved.lookupMaybe(PDFName.of('S'), PDFName)?.decodeText() !== 'GoTo') {
      throw new HttpError(400, 'unsafe_pdf');
    }
    assertPageDestination(resolved.get(PDFName.of('D')), document);
    return;
  }
  assertPageDestination(resolved, document);
}

function assertPassiveDictionary(dict: PDFDict, document: PDFDocument): void {
  for (const key of dict.keys()) {
    const name = key.decodeText();
    if (DANGEROUS_KEYS.has(name)) throw new HttpError(400, 'unsafe_pdf');
  }
  const actionType = dict.lookupMaybe(PDFName.of('S'), PDFName)?.decodeText();
  if (actionType && DANGEROUS_ACTION_TYPES.has(actionType)) throw new HttpError(400, 'unsafe_pdf');
  if (actionType === 'URI') assertSafeUriAction(dict, document);
  if (actionType === 'GoTo') assertPageDestination(dict.get(PDFName.of('D')), document);
  const type = dict.lookupMaybe(PDFName.Type, PDFName)?.decodeText();
  if (type && DANGEROUS_OBJECT_TYPES.has(type)) throw new HttpError(400, 'unsafe_pdf');
  const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText();
  if (subtype && DANGEROUS_ANNOTATION_TYPES.has(subtype)) throw new HttpError(400, 'unsafe_pdf');

  const action = subtype === 'Link' ? dict.get(PDFName.of('A')) : undefined;
  if (action !== undefined) {
    const resolvedAction = resolveObject(action, document);
    if (!(resolvedAction instanceof PDFDict)) throw new HttpError(400, 'unsafe_pdf');
    assertSafeAction(resolvedAction, document);
    const linkActionType = resolvedAction.lookupMaybe(PDFName.of('S'), PDFName)?.decodeText();
    if (linkActionType !== 'URI' && linkActionType !== 'GoTo') throw new HttpError(400, 'unsafe_pdf');
  }

  const openAction = dict.get(PDFName.of('OpenAction'));
  if (openAction !== undefined) assertSafeOpenAction(openAction, document);
}

function assertPassiveObjectGraph(
  object: PDFObject,
  visited: Set<PDFObject>,
  document: PDFDocument,
): void {
  const resolved = object instanceof PDFRef ? document.context.lookup(object) : object;
  if (!resolved || visited.has(resolved)) return;
  visited.add(resolved);
  if (visited.size > MAX_PDF_OBJECTS) throw new HttpError(400, 'invalid_pdf');
  if (resolved instanceof PDFStream) {
    assertPassiveDictionary(resolved.dict, document);
    for (const value of resolved.dict.values()) assertPassiveObjectGraph(value, visited, document);
    return;
  }
  if (resolved instanceof PDFDict) {
    assertPassiveDictionary(resolved, document);
    for (const value of resolved.values()) assertPassiveObjectGraph(value, visited, document);
    return;
  }
  if (resolved instanceof PDFArray) {
    for (const value of resolved.asArray()) assertPassiveObjectGraph(value, visited, document);
  }
}

/** Size-bounds, structurally parses, and rejects active PDF object graphs. */
export async function validatedPdfBytes(request: Request): Promise<Uint8Array> {
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/pdf') {
    throw new HttpError(415, 'unsupported_media_type');
  }
  const declaredHeader = request.headers.get('Content-Length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new HttpError(400, 'invalid_content_length');
    if (declared > MAX_PDF_BYTES) throw new HttpError(413, 'payload_too_large');
  }
  const bytes = await readBoundedBody(request);
  if (bytes.length < PDF_MAGIC.length || PDF_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new HttpError(400, 'invalid_pdf');
  }
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    if (document.isEncrypted || document.getPageCount() < 1) throw new HttpError(400, 'invalid_pdf');
    const visited = new Set<PDFObject>();
    // PDFDocument.load parses and decompresses /ObjStm streams into the context. Enumerating the
    // context therefore inspects compressed inner objects as well as ordinary indirect objects.
    for (const [, object] of document.context.enumerateIndirectObjects()) {
      assertPassiveObjectGraph(object, visited, document);
    }
    return bytes;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_pdf');
  }
}
