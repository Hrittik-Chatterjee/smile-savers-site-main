import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Services Collection
 * Dental services offered by Smile Savers
 */
const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
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
    faq: z.array(z.object({
      question: z.string().min(10),
      answer: z.string().min(20),
    })).optional(),
  }),
});

// ============================================
// PROGRAMMATIC SEO COLLECTIONS
// ============================================

/**
 * Locations Collection
 * "[service] in [neighborhood]" pages for local SEO
 * URL Pattern: /[service]/[neighborhood]/
 */
const locations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/locations' }),
  schema: z.object({
    service: z.string().regex(/^[a-z0-9-]+$/),
    serviceTitle: z.string(),
    neighborhood: z.string().regex(/^[a-z0-9-]+$/),
    neighborhoodDisplay: z.string(),
    intro: z.string().min(100),
    sections: z.array(z.object({
      title: z.string(),
      content: z.string(),
    })).min(1),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).min(1),
    relatedServices: z.array(z.string()).optional(),
  }),
});

/**
 * Glossary Collection
 * "What is [term]" educational pages
 * URL Pattern: /learn/[term]/
 */
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string().regex(/^[a-z0-9-]+$/),
    termDisplay: z.string(),
    definition: z.string().min(50).max(300),
    relatedTerms: z.array(z.object({
      term: z.string(),
      slug: z.string(),
    })).optional(),
    relatedServices: z.array(z.string()).optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

/**
 * Comparisons Collection
 * "[X] vs [Y]" comparison pages
 * URL Pattern: /compare/[slug]/
 */
const comparisons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/comparisons' }),
  schema: z.object({
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
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    relatedServices: z.array(z.string()).optional(),
  }),
});

/**
 * Personas Collection
 * "[service] for [audience]" persona pages
 * URL Pattern: /for/[persona]/
 */
const personas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/personas' }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    persona: z.string(),
    personaDisplay: z.string(),
    tagline: z.string(),
    intro: z.string(),
    benefits: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string(),
    })).min(3),
    services: z.array(z.string()),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

/**
 * Team Collection
 * Dental professionals at Smile Savers
 */
const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    slug: z.string(),
    role: z.string(),
    credentials: z.array(z.string()),
    shortBio: z.string().max(200),
    specialties: z.array(z.string()),
    education: z.array(z.object({
      institution: z.string(),
      degree: z.string(),
      year: z.number(),
    })),
    order: z.number().default(0),
    image: image().optional(),
  }),
});

/**
 * Testimonials Collection
 * Patient reviews and testimonials
 */
const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: z.object({
    authorName: z.string(),
    authorInitials: z.string().max(3),
    rating: z.number().min(1).max(5),
    quote: z.string().max(500),
    service: z.string().optional(),
    location: z.string().optional(),
    source: z.enum(['Google', 'Yelp', 'Zocdoc', 'Healthgrades']).default('Google'),
    date: z.coerce.date(),
    featured: z.boolean().default(false),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().max(160),
    lastUpdated: z.coerce.date(),
  }),
});

export const collections = {
  services,
  team,
  testimonials,
  legal,
  // Programmatic SEO collections
  locations,
  glossary,
  comparisons,
  personas,
};
