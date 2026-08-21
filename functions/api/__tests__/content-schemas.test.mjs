/**
 * DEBT-0012 (functions/api/__tests__ existing tests cover the contact API,
 * chat rate limiter, and domain canonicalization; content-collection
 * frontmatter had zero test coverage before this file). `npm run check`
 * already validates real content/*.md files against the Zod schemas in
 * src/content.config.ts at build time -- this file protects the schemas
 * themselves: a valid/invalid fixture per collection, run fast and without
 * a browser.
 *
 * astro:content isn't resolvable under plain `node --test` (it's a virtual
 * module Astro's Vite plugin provides), so these schemas are independently
 * defined here using the `zod/v4` subpath -- the same API surface
 * astro:content's re-exported `z` actually uses (see
 * node_modules/astro/dist/content/runtime.js), not the zod package's
 * default v3 export. An earlier attempt to extract src/content.config.ts's
 * schemas into a shared, directly-imported file broke Astro's content-type
 * inference for every collection (entry.data became `unknown` in 20+
 * files) -- reverted. These are intentionally a parallel copy: if a field
 * is added, renamed, or its constraint changes in src/content.config.ts,
 * update the matching schema below to match, or this file stops meaning
 * anything.
 *
 * Run: node --test functions/api/__tests__/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod/v4';

const servicesSchema = z.object({
  title: z.string().min(1).max(60),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(50).max(160),
  shortDescription: z.string().min(20).max(100),
  icon: z.string(),
  category: z.enum(['preventive', 'cosmetic', 'restorative', 'emergency']),
  featured: z.boolean().default(false),
  order: z.number().int().min(0).max(100),
  duration: z.string().optional(),
  benefits: z.array(z.string().min(5)).min(1).max(10),
  faq: z
    .array(
      z.object({
        question: z.string().min(10),
        answer: z.string().min(20),
      })
    )
    .optional(),
});

const locationsSchema = z.object({
  service: z.string().regex(/^[a-z0-9-]+$/),
  serviceTitle: z.string(),
  neighborhood: z.string().regex(/^[a-z0-9-]+$/),
  neighborhoodDisplay: z.string(),
  intro: z.string().min(100),
  sections: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
      })
    )
    .min(1),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .min(1),
  relatedServices: z.array(z.string()).optional(),
});

const glossarySchema = z.object({
  term: z.string().regex(/^[a-z0-9-]+$/),
  termDisplay: z.string(),
  definition: z.string().min(50).max(300),
  relatedTerms: z
    .array(
      z.object({
        term: z.string(),
        slug: z.string(),
      })
    )
    .optional(),
  relatedServices: z.array(z.string()).optional(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
});

const comparisonsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  optionA: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    cost: z.string(),
    duration: z.string(),
    longevity: z.string(),
    bestFor: z.string(),
  }),
  optionB: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    cost: z.string(),
    duration: z.string(),
    longevity: z.string(),
    bestFor: z.string(),
  }),
  intro: z.string(),
  verdict: z.string(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  relatedServices: z.array(z.string()).optional(),
});

const personasSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  persona: z.string(),
  personaDisplay: z.string(),
  tagline: z.string(),
  intro: z.string(),
  benefits: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      })
    )
    .min(3),
  services: z.array(z.string()),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
});

// image() is astro:content's per-collection image helper; a permissive
// string schema is enough to exercise this schema's own field shape.
const teamSchema = z.object({
  name: z.string(),
  slug: z.string(),
  role: z.string(),
  credentials: z.array(z.string()),
  shortBio: z.string().max(200),
  specialties: z.array(z.string()),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      year: z.number(),
    })
  ),
  order: z.number().default(0),
  image: z.string().optional(),
});

const testimonialsSchema = z.object({
  authorName: z.string(),
  authorInitials: z.string().max(3),
  rating: z.number().min(1).max(5),
  quote: z.string().max(500),
  service: z.string().optional(),
  location: z.string().optional(),
  source: z.enum(['Google', 'Yelp', 'Zocdoc', 'Healthgrades']).default('Google'),
  date: z.coerce.date(),
  featured: z.boolean().default(false),
});

const VALID_FIXTURES = {
  services: {
    title: 'Teeth Cleaning',
    slug: 'teeth-cleaning',
    description: 'Professional teeth cleaning to keep your smile healthy and bright every visit.',
    shortDescription: 'Gentle, thorough professional cleaning',
    icon: 'sparkle',
    category: 'preventive',
    order: 1,
    benefits: ['Removes plaque and tartar'],
  },
  locations: {
    service: 'teeth-cleaning',
    serviceTitle: 'Teeth Cleaning',
    neighborhood: 'woodside',
    neighborhoodDisplay: 'Woodside',
    intro: 'x'.repeat(120),
    sections: [{ title: 'Why choose us', content: 'Because we care.' }],
    faqs: [{ question: 'How long does it take?', answer: 'About 45 minutes.' }],
  },
  glossary: {
    term: 'root-canal',
    termDisplay: 'Root Canal',
    definition: 'x'.repeat(80),
  },
  comparisons: {
    slug: 'implants-vs-bridges',
    optionA: {
      name: 'Implants',
      slug: 'implants',
      description: 'A titanium post fused to the jawbone.',
      pros: ['Long-lasting'],
      cons: ['Higher upfront cost'],
      cost: '$$$',
      duration: 'Several months',
      longevity: '20+ years',
      bestFor: 'Single missing teeth',
    },
    optionB: {
      name: 'Bridges',
      slug: 'bridges',
      description: 'A fixed prosthetic anchored to adjacent teeth.',
      pros: ['Faster'],
      cons: ['Shorter lifespan'],
      cost: '$$',
      duration: 'A few weeks',
      longevity: '10-15 years',
      bestFor: 'Multiple adjacent teeth',
    },
    intro: 'Choosing between implants and bridges depends on several factors.',
    verdict: 'Implants for longevity, bridges for speed and cost.',
  },
  personas: {
    slug: 'busy-parents',
    persona: 'busy-parents',
    personaDisplay: 'Busy Parents',
    tagline: 'Dental care that fits your schedule',
    intro: 'We know your time is limited.',
    benefits: [
      { title: 'Evening appointments', description: 'We stay open late.', icon: 'clock' },
      { title: 'Family blocks', description: 'Book the whole family at once.', icon: 'family' },
      { title: 'Kid-friendly', description: 'A welcoming space for children.', icon: 'smile' },
    ],
    services: ['teeth-cleaning'],
  },
  team: {
    name: 'Dr. Jane Doe',
    slug: 'dr-jane-doe',
    role: 'Lead Dentist',
    credentials: ['DDS'],
    shortBio: 'Dr. Doe has practiced dentistry in Queens for over a decade.',
    specialties: ['Cosmetic dentistry'],
    education: [{ institution: 'NYU', degree: 'DDS', year: 2010 }],
  },
  testimonials: {
    authorName: 'A. Patient',
    authorInitials: 'AP',
    rating: 5,
    quote: 'Wonderful, caring staff.',
    date: '2026-01-15',
  },
};

// One deliberate violation per collection, targeting a real constraint
// (min/max length, regex, required field, enum) rather than an empty object.
const INVALID_FIXTURES = {
  services: { ...VALID_FIXTURES.services, category: 'orthodontics' }, // not in enum
  locations: { ...VALID_FIXTURES.locations, neighborhood: 'Woodside NY' }, // fails slug regex
  glossary: { ...VALID_FIXTURES.glossary, definition: 'too short' }, // below min(50)
  comparisons: { ...VALID_FIXTURES.comparisons, optionA: undefined }, // missing required object
  personas: { ...VALID_FIXTURES.personas, benefits: VALID_FIXTURES.personas.benefits.slice(0, 1) }, // below min(3)
  team: { ...VALID_FIXTURES.team, shortBio: 'x'.repeat(201) }, // exceeds max(200)
  testimonials: { ...VALID_FIXTURES.testimonials, rating: 6 }, // exceeds max(5)
};

const SCHEMAS = {
  services: servicesSchema,
  locations: locationsSchema,
  glossary: glossarySchema,
  comparisons: comparisonsSchema,
  personas: personasSchema,
  team: teamSchema,
  testimonials: testimonialsSchema,
};

for (const [name, schema] of Object.entries(SCHEMAS)) {
  test(`${name} schema accepts valid frontmatter`, () => {
    const result = schema.safeParse(VALID_FIXTURES[name]);
    assert.equal(result.success, true, result.success ? '' : JSON.stringify(result.error.issues));
  });

  test(`${name} schema rejects invalid frontmatter`, () => {
    const result = schema.safeParse(INVALID_FIXTURES[name]);
    assert.equal(result.success, false, `expected ${name} to reject its invalid fixture but it passed`);
  });
}
