import type { Env } from '../env';

export type OutboundEventType = 'guide_lead.created' | 'contact.created' | 'newsletter.subscribed';

export interface OutboundEvent {
  id: string;
  event_type: OutboundEventType;
  aggregate_id: string;
}

type OutboundEnv = Pick<Env, 'OUTBOUND_WEBHOOK_URL' | 'OUTBOUND_WEBHOOK_ALLOWED_HOSTS'>;
const SITE_ORIGIN = 'https://a-step-immigration-space.belabbesbadibac.workers.dev';

export function outboundDestination(env: OutboundEnv): URL {
  const url = new URL(env.OUTBOUND_WEBHOOK_URL);
  const allowed = new Set(env.OUTBOUND_WEBHOOK_ALLOWED_HOSTS.split(',')
    .map((host) => host.trim().toLowerCase()).filter(Boolean));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.has(url.hostname.toLowerCase())) {
    throw new Error('webhook_destination_denied');
  }
  // FormSubmit documents both AJAX and standard form endpoints. The standard
  // endpoint avoids the AJAX-specific bot throttle while A-Step enforces its
  // own server-validated Turnstile challenge before delivery.
  if (url.hostname === 'formsubmit.co' && url.pathname.startsWith('/ajax/')) {
    url.pathname = url.pathname.slice('/ajax'.length);
  }
  return url;
}

export function outboundBody(url: URL, event: OutboundEvent, payload: Record<string, unknown>): string {
  if (url.hostname !== 'formsubmit.co') {
    return JSON.stringify({ id: event.id, type: event.event_type, data: payload });
  }
  const subject = event.event_type === 'contact.created'
    ? 'New A-Step Contact Us message'
    : event.event_type === 'guide_lead.created'
      ? 'New A-Step guide lead'
      : 'New A-Step newsletter subscriber';
  const fields: Record<string, unknown> = {
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    _url: `${SITE_ORIGIN}/contact`,
    submissionType: event.event_type,
    submissionId: event.aggregate_id,
    ...payload,
  };
  return new URLSearchParams(Object.entries(fields).map(([name, value]) => [
    name,
    value === null || value === undefined ? '' : String(value),
  ])).toString();
}

export function outboundHeaders(url: URL, eventId: string, signature: string): Headers {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': url.hostname === 'formsubmit.co'
      ? 'application/x-www-form-urlencoded;charset=UTF-8'
      : 'application/json',
    'X-A-Step-Event-Id': eventId,
    'X-Astep-Signature': signature,
  });
  if (url.hostname === 'formsubmit.co') {
    headers.set('Origin', SITE_ORIGIN);
    headers.set('Referer', `${SITE_ORIGIN}/contact`);
  }
  return headers;
}

export async function requireSuccessfulDelivery(url: URL, response: Response): Promise<void> {
  if (!response.ok) throw new Error(`webhook_http_${response.status}`);
  if (url.hostname !== 'formsubmit.co' || !url.pathname.startsWith('/ajax/')) return;
  const result = await response.json().catch(() => null) as { success?: boolean | string } | null;
  if (result?.success !== true && result?.success !== 'true') throw new Error('contact_email_rejected');
}
