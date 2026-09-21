import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { validatedPdfBytes } from '../worker/security/pdf-upload';

describe('passive PDF action boundaries', () => {
  it.each(['AA', 'GoToR', 'GoToE'])('rejects %s automatic or external-document actions', async kind => {
    const document = await PDFDocument.create();
    const page = document.addPage();
    if (kind === 'AA') {
      page.node.set(PDFName.of('AA'), document.context.obj({ O: { S: PDFName.of('URI'), URI: PDFString.of('https://example.org') } }));
    } else {
      const action = document.context.obj({ S: PDFName.of(kind), F: PDFString.of('external.pdf'), D: [0, PDFName.of('Fit')] });
      page.node.set(PDFName.of('A'), action);
    }
    const bytes = await document.save();
    await expect(validatedPdfBytes(new Request('https://example.org/upload', { method: 'PUT', body: bytes, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length) } }))).rejects.toMatchObject({ status: 400, code: 'unsafe_pdf' });
  });
});
