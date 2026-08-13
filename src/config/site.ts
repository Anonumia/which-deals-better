export const siteConfig = {
  name: "Which Deal's Better?",
  url: 'https://whichdealsbetter.com',
  tagline: 'Compare prices and sizes. Find the better deal in seconds.',
  socialImage: '/social-card.webp',
  socialImageWidth: 1200,
  socialImageHeight: 630,
  gaMeasurementId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID ?? '',
  adsensePublisherId: '',
} as const;
