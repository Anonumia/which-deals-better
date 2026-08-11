# Which Deal's Better?

A fast, mobile-first unit price calculator for comparing product quantities, multipacks, and compatible units. Calculator data stays in the browser; no account is required.

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
- `CONTACT_RECIPIENT_EMAIL`
- `CONTACT_SENDER_EMAIL` (a Brevo-verified sender)

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
