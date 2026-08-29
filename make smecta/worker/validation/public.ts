import { z } from 'zod';

const locale = z.string().trim().pipe(z.enum(['en', 'fr', 'ar']));
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const turnstileToken = z.string().trim().min(1).max(2048);

export const contactInputSchema = z.object({
  name: z.string().trim().min(2).max(70),
  email,
  message: z.string().trim().min(10).max(2000),
  locale,
  turnstileToken,
}).strict();

export const leadInputSchema = z.object({
  fullName: z.string().trim().min(2).max(70),
  email,
  guideId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  guideLanguage: z.enum(['en', 'fr', 'ar']),
  targetCountry: z.string().trim().min(1).max(80).optional(),
  locale,
  turnstileToken,
}).strict();

export const newsletterInputSchema = z.object({
  email,
  locale,
  turnstileToken,
}).strict();

export const downloadTokenSchema = z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/);

export const unsubscribeInputSchema = z.object({
  token: z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
