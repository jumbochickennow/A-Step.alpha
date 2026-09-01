# A-Step Immigration Space

Production-oriented, mobile-first website for A-Step. The app uses React, TypeScript, Vite, React Router, Tailwind, Radix primitives, TanStack Query, react-i18next, react-hook-form and zod, deployed as a Cloudflare Worker with static assets.

The repository includes the public site in English, French and Arabic, an authenticated content dashboard, bundled content datasets, client-side lead capture and deployment assets.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Cloudflare account for deployment (`wrangler`)

## Install and run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Public content is bootstrapped from the typed datasets in `src/data/content.json` and `src/data/fallback.ts`. The Worker BFF stores encrypted submissions and admin edits in Cloudflare D1, streams gated documents and images from private R2 buckets, and authenticates administrators with the server-side password/session flow.

Useful checks:

```bash
npm run check:i18n
npm run check
npm run check:worker
npm run test:security
npm run test:workers
npx wrangler d1 migrations apply astep-production-db --local
npm run verify:d1
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env.local`. Never commit the populated file.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SITE_URL` | Browser/build | Canonical production origin, with no trailing slash |
| `VITE_WHATSAPP_NUMBER` | Browser | Digits only; no plus sign |
| `VITE_ANALYTICS_DOMAIN` | Browser | Plausible domain. Blank disables analytics. |

Every `VITE_` value is public in the compiled JavaScript. Never put passwords, tokens or salts in a `VITE_` variable.

## Content management

The bundled catalog lives in `src/data/content.json` (guide slots Q1-Q20, opportunity slots C1-C10), with additional fallback entries in `src/data/fallback.ts`. The public password-only sign-in page is `/admin`; `/admin/dashboard` and every `/api/v1/admin/*` request are authenticated server-side. Password verification uses a secret-keyed, non-reversible verifier, globally atomic lockouts, short-lived opaque sessions, hashed session tokens, and `HttpOnly; Secure; SameSite=Strict` cookies. Never place admin secrets in browser code or `VITE_` variables.

MFA is the remaining authentication enhancement: add a WebAuthn credential table keyed to the master admin, issue a short-lived pre-authentication challenge after password verification, and create the admin session only after server-side WebAuthn assertion verification. The current coordinator already centralizes session issuance and revocation for that second step.

## Add or edit a guide

1. Sign in at `/admin`.
2. Open **Guides**, then add or edit a record.
3. Enter a lowercase hyphenated slug, category, update date, sort order and all three translations.
4. Upload a structurally valid PDF (maximum 50 MiB) in the editor. The Worker validates and stores it in private R2; public downloads use short-lived grants.
5. Publish only after all information and the document are ready.

Keep the bundled public catalog synchronized when a dashboard change should ship as static fallback content.

## Add or edit an opportunity

In `/admin/dashboard`, open **Opportunities**. Provide the slug, country, comma-separated categories, dates, official application URL, image, translations and publish state. Images upload directly from the editor to private R2. A missing application URL produces a real disabled **Coming soon** control—never a dead `#` link.

## Contact delivery

The browser submits contact messages only to `/api/v1/contact`. The Worker validates Turnstile, encrypts personal data before D1 persistence, creates an outbox event, and sends email through the restricted `CONTACT_EMAIL` binding. Only the queue consumer may mark an event delivered, and it records the provider message ID. The browser never sends personal data to a third-party relay and never claims provider delivery.

Expired opportunities move out of the default grid automatically. Items closing within seven days receive the closing-soon badge. Dates are stored as ISO dates and formatted with `Intl` for each locale.

## Translations and categories

Interface text lives in:

- `src/locales/en.json`
- `src/locales/fr.json`
- `src/locales/ar.json`

Run `npm run check:i18n` after every translation change. It fails when key sets drift.

Guide and opportunity translations are data entries and can be edited in the admin tabs without touching component code. To add a new site language, extend the URL routes, translation resources and locale types together.

Countries and topics used by filters and admin inputs live once in `src/lib/constants.ts`. Add a string there rather than writing country-specific conditions in components.

## Fonts and images

Temporary self-hosted fonts live in `public/fonts`. `src/styles/fonts.css` defines a Latin variable face and Cairo for Arabic with separate unicode ranges. When licensed Gilroy webfonts are supplied, replace the Latin files and update that single CSS file; retain `font-display: swap` and the weight range.

Optimized supplied artwork lives under `public/assets`. Keep each raster under 200 KB, preserve transparency, add explicit dimensions, and use WebP or AVIF for future assets. Opportunity images reference bundled paths under `/assets/opportunities`; guide PDFs remain private in R2 and are streamed only after a single-use D1 grant is consumed.

The default 1200×630 sharing image is `public/og/default.png`. Update `VITE_SITE_URL`, `index.html`, `robots.txt` and `sitemap.xml` from the placeholder domain before production.

## SEO and social previews

The app provides unique client-side titles, descriptions, canonicals, hreflang links, Organization JSON-LD and FAQPage JSON-LD. Because social crawlers do not execute Vite SPA JavaScript, strong default Open Graph tags are also present directly in `index.html`; every WhatsApp/Facebook share therefore gets a branded preview.

This is the brief's minimum acceptable social implementation, not per-route crawler rendering. Add build-time prerendering before relying on different OG copy or imagery for individual routes.

## Deployment

Create the D1 database and R2 bucket, replace `YOUR_D1_DATABASE_ID` in `wrangler.json`, apply `migrations/0001_initial_schema.sql`, and upload the guide PDFs to R2. Build with `npm run build` and deploy with `npm run deploy`. The root Worker serves the SPA and handles `/api/v1/*` through the BFF.

Before launch:

- verify canonical URLs use `https://www.astepimmigration.space`;
- configure Worker secrets and non-secret policy variables;
- configure all secrets listed in `wrangler.json` and enable Email Sending for the verified sender domain;
- verify `contact@astepimmigration.space` as the Email Sending destination and keep its Email Routing rule enabled;
- enable the Google Sheets API for a dedicated service account, share `A-Step user Data` with that account as Editor, and configure `GOOGLE_SHEETS_CLIENT_EMAIL` plus `GOOGLE_SHEETS_PRIVATE_KEY` as Worker secrets;
- apply D1 migrations and verify the private R2 bucket;
- test keyboard navigation and Arabic RTL at 390 px;
- run a production Lighthouse test on simulated mobile 4G.

### Lead archive and contact delivery

Cloudflare D1 is the encrypted source of truth. The outbox Queue copies contacts, guide-download leads, and newsletter subscriptions to the private `A-Step user Data` Google Sheet. Stable event IDs prevent duplicate rows during retries. Only Contact Us submissions trigger email; Cloudflare Email Sending delivers them to `contact@astepimmigration.space`. Failed email or Sheet writes stay retryable in D1 and are never marked delivered early.

Operational records are reviewed after 24 months and removed when they are no longer required. The Sheet must remain private and shared only with authorized A-Step operators and its dedicated service account.

## Troubleshooting

**A gated guide returns not found:** confirm its seeded object key exists in the private `a-step-guides` R2 bucket.

**D1 tables are missing:** apply the local or remote Wrangler migrations, then run `npm run verify:d1` or `npm run verify:d1:remote`.

**A translated route shows the wrong language after refresh:** ensure the host serves `index.html` for unknown routes (Workers static assets handle this via `not_found_handling: "single-page-application"`); the URL prefix remains the source of truth after the app loads.
