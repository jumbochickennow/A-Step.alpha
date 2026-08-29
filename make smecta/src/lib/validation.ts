import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Legacy schema layer (still consumed by Footer newsletter signup)    */
/* ------------------------------------------------------------------ */

const disposableDomains = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
]);
const junkLocalParts = new Set(['test', 'asdf', 'aaa', 'fake', 'abc', 'nom']);

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .refine((value: string) => !disposableDomains.has(value.toLowerCase().split('@')[1] ?? ''), 'disposable')
  .refine((value: string) => {
    const local = value.toLowerCase().split('@')[0] ?? '';
    return local.length > 1 && !/^\d+$/.test(local) && !junkLocalParts.has(local);
  }, 'junk');

export const guideLeadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.boolean().refine((value: boolean) => value),
});

const typoDomains: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
};

export function suggestEmail(value: string) {
  const [local, domain] = value.trim().toLowerCase().split('@');
  return local && domain && typoDomains[domain] ? `${local}@${typoDomains[domain]}` : null;
}

/* ------------------------------------------------------------------ */
/* Sanitization layer                                                  */
/* ------------------------------------------------------------------ */

/**
 * Strips `<script>` blocks, all HTML tags, inline event handlers
 * (`onerror=`, `onclick=`, …) and control characters, trims whitespace and
 * truncates to `maxLength` when provided. Safe for storage and display.
 */
export function sanitizeText(value: string, maxLength?: number): string {
  let out = String(value ?? '');
  out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  out = out.replace(/<[^>]*>/g, '');
  out = out.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\u0000-\u001f\u007f]/g, ' ');
  out = out.trim();
  if (maxLength !== undefined && out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

/** Trims, lower-cases and removes characters that are forbidden in emails. */
export function sanitizeEmail(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._%+@-]/g, '');
}

/**
 * Keeps only a single leading `+` (for E.164) plus numeric digits; removes
 * spaces, dashes, parentheses and dots so numbers can be compared reliably.
 */
export function sanitizePhone(value: string): string {
  const cleaned = String(value ?? '').replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return cleaned;
  return `+${cleaned.slice(1).replace(/\+/g, '')}`;
}

/* ------------------------------------------------------------------ */
/* Validation rules                                                    */
/* ------------------------------------------------------------------ */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const EMAIL_MAX_LENGTH = 254;

/** International E.164: `+[1-9]` followed by 7–14 digits. */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;
/** Algerian national mobile: `05`/`06`/`07` followed by 8 digits. */
const DZ_LOCAL_REGEX = /^0[567]\d{8}$/;
/** Algerian international: `+213…` or `00213…` followed by 9 digits starting 5/6/7. */
const DZ_INTL_REGEX = /^(?:\+213|00213)[567]\d{8}$/;

export function isValidEmail(value: string): boolean {
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) return false;
  if (!EMAIL_REGEX.test(value)) return false;
  // Reject malformed local parts the broad RFC regex lets through,
  // e.g. "test..@gmail.com" or ".user@gmail.com".
  const local = value.split('@')[0] ?? '';
  return !local.includes('..') && !local.startsWith('.') && !local.endsWith('.');
}

export function isValidPhone(value: string): boolean {
  const phone = sanitizePhone(value);
  if (!phone) return false;
  return E164_REGEX.test(phone) || DZ_LOCAL_REGEX.test(phone) || DZ_INTL_REGEX.test(phone);
}

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 70;
/** Raw code markers and path separators are never legitimate in a person's name. */
const FORBIDDEN_NAME_CHARS = /[<>{}\\/]/;

const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

/* ------------------------------------------------------------------ */
/* Type-safe validation contracts                                      */
/* ------------------------------------------------------------------ */

export interface ValidationResult<T> {
  isValid: boolean;
  data: T;
  errors: Partial<Record<keyof T, string>>;
}

export interface ContactFormInputs {
  fullName: string;
  email: string;
  phone: string;
  serviceInterest?: string;
  message: string;
}

export interface GuideDownloadFormInputs {
  fullName: string;
  email: string;
  guideLanguage: 'en' | 'fr' | 'ar';
  targetCountry?: string;
}

/* ------------------------------------------------------------------ */
/* Error message resolution                                            */
/* ------------------------------------------------------------------ */

type Translator = ((key: string) => string) | undefined;

const FALLBACK_MESSAGES: Record<string, string> = {
  'forms.required': 'This field is required.',
  'forms.nameLength': 'Enter your full name between 2 and 70 characters.',
  'forms.emailInvalid': 'Enter a valid email address.',
  'forms.emailDisposable': 'Please use a permanent email address.',
  'forms.phoneRequired': 'Enter your phone number.',
  'forms.phoneInvalid': 'Enter a valid phone number, e.g. +213555123456 or 0661123456.',
  'forms.messageLength': 'Enter a message between 10 and 2000 characters.',
};

function message(key: string, t: Translator): string {
  if (t) {
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return FALLBACK_MESSAGES[key] ?? key;
}

function validateFullName(rawName: string, t: Translator): { value: string; error?: string } {
  const name = sanitizeText(rawName, NAME_MAX_LENGTH);
  if (name.length < NAME_MIN_LENGTH || FORBIDDEN_NAME_CHARS.test(name)) {
    return { value: name, error: message('forms.nameLength', t) };
  }
  return { value: name };
}

function validateEmailField(rawEmail: string, t: Translator): { value: string; error?: string } {
  const email = sanitizeEmail(rawEmail);
  if (!email) return { value: email, error: message('forms.required', t) };
  if (!isValidEmail(email)) return { value: email, error: message('forms.emailInvalid', t) };
  const domain = email.split('@')[1] ?? '';
  if (disposableDomains.has(domain)) return { value: email, error: message('forms.emailDisposable', t) };
  return { value: email };
}

function validatePhoneField(rawPhone: string, t: Translator): { value: string; error?: string } {
  const phone = sanitizePhone(rawPhone);
  if (!phone) return { value: phone, error: message('forms.phoneRequired', t) };
  if (!isValidPhone(phone)) return { value: phone, error: message('forms.phoneInvalid', t) };
  return { value: phone };
}

function validateMessageField(rawMessage: string, t: Translator): { value: string; error?: string } {
  const text = sanitizeText(rawMessage, MESSAGE_MAX_LENGTH);
  if (text.length < MESSAGE_MIN_LENGTH) {
    return { value: text, error: message('forms.messageLength', t) };
  }
  return { value: text };
}

/* ------------------------------------------------------------------ */
/* Exported form validators                                            */
/* ------------------------------------------------------------------ */

export function validateContactForm(
  inputs: ContactFormInputs,
  t?: (key: string) => string,
): ValidationResult<ContactFormInputs> {
  const errors: Partial<Record<keyof ContactFormInputs, string>> = {};

  const fullNameResult = validateFullName(inputs.fullName, t);
  if (fullNameResult.error) errors.fullName = fullNameResult.error;

  const emailResult = validateEmailField(inputs.email, t);
  if (emailResult.error) errors.email = emailResult.error;

  const phoneResult = validatePhoneField(inputs.phone, t);
  if (phoneResult.error) errors.phone = phoneResult.error;

  const serviceInterest = inputs.serviceInterest ? sanitizeText(inputs.serviceInterest, 120) : undefined;

  const messageResult = validateMessageField(inputs.message, t);
  if (messageResult.error) errors.message = messageResult.error;

  return {
    isValid: Object.keys(errors).length === 0,
    data: {
      fullName: fullNameResult.value,
      email: emailResult.value,
      phone: phoneResult.value,
      serviceInterest: serviceInterest || undefined,
      message: messageResult.value,
    },
    errors,
  };
}

export function validateGuideDownloadForm(
  inputs: GuideDownloadFormInputs,
  t?: (key: string) => string,
): ValidationResult<GuideDownloadFormInputs> {
  const errors: Partial<Record<keyof GuideDownloadFormInputs, string>> = {};

  const fullNameResult = validateFullName(inputs.fullName, t);
  if (fullNameResult.error) errors.fullName = fullNameResult.error;

  const emailResult = validateEmailField(inputs.email, t);
  if (emailResult.error) errors.email = emailResult.error;

  const targetCountry = inputs.targetCountry ? sanitizeText(inputs.targetCountry, 80) : undefined;

  return {
    isValid: Object.keys(errors).length === 0,
    data: {
      fullName: fullNameResult.value,
      email: emailResult.value,
      guideLanguage: inputs.guideLanguage,
      targetCountry: targetCountry || undefined,
    },
    errors,
  };
}
