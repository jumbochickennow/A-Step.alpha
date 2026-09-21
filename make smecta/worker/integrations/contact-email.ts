import type { Env } from '../env';

const DELIVERY_TO = 'contact@astepimmigration.space';
const DELIVERY_FROM = 'contact@astepimmigration.space';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return String(value).slice(0, 10_000);
}

/** Delivers decrypted records only through the server-side restricted binding. */
export async function sendContactEmail(
  env: Pick<Env, 'CONTACT_EMAIL'>,
  submissionId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const fields = Object.entries({ submissionId, submissionType: 'contact.created', ...payload });
  const text = fields.map(([name, value]) => `${name}: ${display(value)}`).join('\n');
  const html = `<h2>New A-Step Contact Us message</h2><table>${fields.map(([name, value]) => (
    `<tr><th align="left" valign="top">${escapeHtml(name)}</th><td>${escapeHtml(display(value)).replaceAll('\n', '<br>')}</td></tr>`
  )).join('')}</table>`;
  const replyTo = typeof payload.email === 'string' ? payload.email : undefined;
  const result = await env.CONTACT_EMAIL.send({
    to: DELIVERY_TO,
    from: { email: DELIVERY_FROM, name: 'A-Step website' },
    replyTo,
    subject: 'New A-Step Contact Us message',
    text,
    html,
    headers: {
      'X-A-Step-Submission-Id': submissionId,
      'X-A-Step-Event-Type': 'contact.created',
    },
  });
  if (!result.messageId) throw new Error('email_provider_missing_message_id');
  return result.messageId;
}
