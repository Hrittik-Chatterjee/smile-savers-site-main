/**
 * Site Configuration
 * Central source of truth for all site-wide settings
 */

export const siteConfig = {
  // Basic Info
  name: 'Smile Savers Dental',
  tagline: 'Your trusted neighborhood dental practice',
  description:
    'Smile Savers Dental provides comprehensive dental care in Queens, NY. From routine cleanings to dental implants, we offer gentle, personalized care for the whole family.',
  url: 'https://smilesavers.dental',

  // Contact
  phone: '(718) 956-8400',
  email: 'care@smilesavers.dental',

  // Location
  address: {
    street: '3202 53rd Place',
    city: 'Woodside',
    state: 'NY',
    zip: '11377',
    latitude: 40.7549,
    longitude: -73.9059,
  },

  // Business Hours
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], open: '10:00', close: '18:00' },
    { days: ['Friday'], open: 'Closed', close: 'Closed' },
    { days: ['Saturday'], open: '09:00', close: '13:00' },
    { days: ['Sunday'], open: 'Closed', close: 'Closed' },
  ],

  // Social Media
  social: {
    facebook: 'https://facebook.com/smilesavers32',
    instagram: '#', // Placeholder - update when available
    twitter: '',
    linkedin: '',
    yelp: 'https://yelp.com/biz/smile-savers-woodside-2',
  },

  // SEO Defaults
  defaultOgImage: '/images/og-image.jpg',
  twitterHandle: '@smilesavers',

  // Service Areas (for local SEO)
  serviceAreas: [
    'Woodside',
    'Sunnyside',
    'Jackson Heights',
    'Elmhurst',
    'Astoria',
    'Long Island City',
    'Flushing',
    'Corona',
  ],

  // Insurance (example list)
  acceptedInsurance: [
    'Delta Dental',
    'Cigna',
    'Aetna',
    'MetLife',
    'Guardian',
    'United Healthcare',
  ],
} as const;

export type SiteConfig = typeof siteConfig;
