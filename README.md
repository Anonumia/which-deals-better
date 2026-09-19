# Which Deal's Better?

A fast, mobile-first shopping decision toolkit. It connects a unit-price comparator, coupon and discount comparison, private household usage history, and stock-up estimates. Calculator data stays in the browser; no account is required.

## Public routes

- `/` — flagship Compare Deals calculator
- `/coupon-comparator/` — sale, percentage-off, and dollar-off comparison
- `/usage-tracker/` — browser-local usage records and weighted history
- `/stock-up-calculator/` — savings and supply-duration estimates
- `/methodology/` — formulas, conversion rules, assumptions, and limitations
- `/shopping-examples/` and `/guides/` — original worked examples and practical guides

The former `/how-we-calculate/` route redirects to `/methodology/`.

## Local development

The expected local path is `D:\Projects\which-deals-better`.

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm test
npm run check
npm run build
```

## Contact form

The endpoint at `functions/api/contact.ts` is a Cloudflare Pages Function that sends mail through Brevo. Configure these Cloudflare Pages environment variables; never commit their values:

- `BREVO_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL` (a Brevo-verified sender)

Visitor email addresses are used only as `Reply-To`. Local builds do not send email.

## Analytics and advertising

Sitewide configuration lives in `src/config/site.ts`. Leave `gaMeasurementId` and `adsensePublisherId` empty until real IDs are available. When set at build time, the shared layout loads each script once on every page. No ad units are currently rendered.

## Production deployment

- Future GitHub repository: `which-deals-better`
- Cloudflare Pages framework preset: Astro
- Build command: `npm run build`
- Output directory: `dist`
- Production domain: `https://whichdealsbetter.com`

The only approved production flow is local repository → GitHub → GitHub-connected Cloudflare Pages → custom domain. Do not use ChatGPT Preview, OpenSite, or a ChatGPT-managed Worker. Deployment is intentionally not automated from this repository.

## Publisher content checks

After npm run build, run node scripts/check-content.mjs to check generated page
titles, descriptions, canonical URLs, H1s, internal links, sitemap coverage, and
the shared ad/analytics inclusion policy. The audit prints approximate guide word
counts. Check both configured and unconfigured services when changing the layout;
use temporary test values locally, never committed service IDs.

AdSense defaults to off in BaseLayout. Only the homepage, substantive individual
guides (through GuideLayout), Methodology, and Worked Shopping Examples opt in with
allowAds. The Guides index, About, Contact (including success/error states), Privacy,
Terms, 404, redirects, and all three utility tools remain ad-free. New utility pages
inherit the ad-free default. Analytics remains independent of allowAds.
Cloudflare-managed analytics injection is configured outside this source tree.

Usage Tracker records use the `whichdealsbetter.usage.v1` local-storage key. The
optional Compare Deals handoff uses session storage so product details are not put
in a URL. No item-level analytics events are emitted.

Guide examples use illustrative prices. Keep methodology aligned with
src/lib/calculator.ts, src/lib/units.ts, and the calculator component when behavior
changes. Article pages reuse the shared design and add no article JavaScript.
