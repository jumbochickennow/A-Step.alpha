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

Public content is bootstrapped from the typed datasets in `src/data/content.json` and `src/data/fallback.ts`. The Worker BFF stores submissions and admin edits in Cloudflare D1, streams gated guide documents from a private R2 bucket, and verifies administrators with Cloudflare Access.

Useful checks:

```bash
npm run check:i18n
npm run check
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

The bundled catalog lives in `src/data/content.json` (guide slots Q1-Q20, opportunity slots C1-C10), with additional fallback entries in `src/data/fallback.ts`. Protect `/astep-control-vault*` and `/api/v1/admin/*` with a Cloudflare Access application. The Worker verifies every Access JWT against the account JWKS and stores authorized admin activity and content changes in D1.

## Add or edit a guide

1. Sign in at `/astep-control-vault`.
2. Open **Guides**, then add or edit a record.
3. Enter a lowercase hyphenated slug, category, update date, sort order and all three translations.
4. Set `filePath` to the validated private R2 object key. Upload PDFs to the `a-step-guides` bucket outside the runtime; public upload endpoints are disabled.
5. Publish only after all information and the document are ready.

Keep the bundled public catalog synchronized when a dashboard change should ship as static fallback content.

## Add or edit an opportunity

In `/admin`, open **Opportunities**. Provide the slug, country, comma-separated categories, dates, official application URL, image, translations and publish state. A missing application URL produces a real disabled **Coming soon** control—never a dead `#` link.

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

- replace `astep.example` in `index.html`, `robots.txt` and `sitemap.xml`;
- configure Worker secrets and non-secret policy variables;
- configure the Cloudflare Access application audience and team domain;
- apply D1 migrations and verify the private R2 bucket;
- test keyboard navigation and Arabic RTL at 390 px;
- run a production Lighthouse test on simulated mobile 4G.

## Troubleshooting

**A gated guide returns not found:** confirm its seeded object key exists in the private `a-step-guides` R2 bucket.

**D1 tables are missing:** apply the local or remote Wrangler migrations, then run `npm run verify:d1` or `npm run verify:d1:remote`.

**A translated route shows the wrong language after refresh:** ensure the host serves `index.html` for unknown routes (Workers static assets handle this via `not_found_handling: "single-page-application"`); the URL prefix remains the source of truth after the app loads.
