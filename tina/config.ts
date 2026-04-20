import { defineConfig } from "tinacms";

// Branch is auto-detected from CI env vars; falls back to "main"
const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,

  // TinaCloud credentials — set these in .env (local) and GitHub Secrets (CI)
  clientId: process.env.TINA_CLIENT_ID!,
  token: process.env.TINA_TOKEN!,

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "images",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [

      // ─── 1. SERVICES ──────────────────────────────────────────────────────
      {
        name: "services",
        label: "Services",
        path: "src/content/services",
        format: "md",
        fields: [
          { type: "string",   name: "title",            label: "Title",             isTitle: true, required: true },
          { type: "string",   name: "slug",             label: "Slug",              required: true },
          { type: "string",   name: "description",      label: "Description (SEO)", required: true, ui: { component: "textarea" } },
          { type: "string",   name: "shortDescription", label: "Short Description", required: true },
          { type: "string",   name: "icon",             label: "Icon (emoji or name)" },
          {
            type: "string",
            name: "category",
            label: "Category",
            required: true,
            options: ["preventive", "cosmetic", "restorative", "emergency"],
          },
          { type: "boolean",  name: "featured",         label: "Featured?",         default: false },
          { type: "number",   name: "order",            label: "Display Order" },
          { type: "string",   name: "duration",         label: "Duration (e.g. 60 min)" },
          {
            type: "object",
            name: "benefits",
            label: "Benefits",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.benefit }) },
            fields: [
              { type: "string", name: "benefit", label: "Benefit" },
            ],
          },
          {
            type: "object",
            name: "faq",
            label: "FAQs",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.question }) },
            fields: [
              { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
              { type: "string", name: "answer",   label: "Answer",   ui: { component: "textarea" } },
            ],
          },
          { type: "rich-text", name: "body", label: "Body Content", isBody: true },
        ],
      },

      // ─── 2. TEAM ──────────────────────────────────────────────────────────
      {
        name: "team",
        label: "Team Members",
        path: "src/content/team",
        format: "md",
        fields: [
          { type: "string",  name: "name",        label: "Full Name",     isTitle: true, required: true },
          { type: "string",  name: "slug",        label: "Slug",          required: true },
          { type: "string",  name: "role",        label: "Role / Title",  required: true },
          { type: "string",  name: "shortBio",    label: "Short Bio",     ui: { component: "textarea" } },
          { type: "image",   name: "image",       label: "Photo" },
          { type: "number",  name: "order",       label: "Display Order" },
          {
            type: "object",
            name: "credentials",
            label: "Credentials",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.credential }) },
            fields: [{ type: "string", name: "credential", label: "Credential" }],
          },
          {
            type: "object",
            name: "specialties",
            label: "Specialties",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.specialty }) },
            fields: [{ type: "string", name: "specialty", label: "Specialty" }],
          },
          {
            type: "object",
            name: "education",
            label: "Education",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.institution }) },
            fields: [
              { type: "string", name: "institution", label: "Institution" },
              { type: "string", name: "degree",      label: "Degree" },
              { type: "number", name: "year",        label: "Year" },
            ],
          },
          { type: "rich-text", name: "body", label: "Full Bio", isBody: true },
        ],
      },

      // ─── 3. TESTIMONIALS ──────────────────────────────────────────────────
      {
        name: "testimonials",
        label: "Testimonials",
        path: "src/content/testimonials",
        format: "md",
        fields: [
          { type: "string",   name: "authorName",     label: "Author Name",     isTitle: true, required: true },
          { type: "string",   name: "authorInitials", label: "Initials (max 3)", required: true },
          { type: "number",   name: "rating",         label: "Rating (1–5)",    required: true },
          { type: "string",   name: "quote",          label: "Quote",           required: true, ui: { component: "textarea" } },
          { type: "string",   name: "service",        label: "Service" },
          { type: "string",   name: "location",       label: "Location" },
          {
            type: "string",
            name: "source",
            label: "Review Source",
            options: ["Google", "Yelp", "Zocdoc", "Healthgrades"],
          },
          { type: "datetime", name: "date",           label: "Date",            required: true },
          { type: "boolean",  name: "featured",       label: "Featured?",       default: false },
        ],
      },

      // ─── 4. LEGAL ─────────────────────────────────────────────────────────
      {
        name: "legal",
        label: "Legal Pages",
        path: "src/content/legal",
        format: "md",
        fields: [
          { type: "string",   name: "title",       label: "Page Title",       isTitle: true, required: true },
          { type: "string",   name: "description", label: "Meta Description", required: true, ui: { component: "textarea" } },
          { type: "datetime", name: "lastUpdated", label: "Last Updated",     required: true },
          { type: "rich-text", name: "body",       label: "Page Content",     isBody: true },
        ],
      },

      // ─── 5. LOCATIONS (Programmatic SEO) ──────────────────────────────────
      {
        name: "locations",
        label: "Locations (SEO)",
        path: "src/content/locations",
        format: "md",
        fields: [
          { type: "string", name: "service",              label: "Service Slug",         isTitle: true, required: true },
          { type: "string", name: "serviceTitle",         label: "Service Display Name", required: true },
          { type: "string", name: "neighborhood",         label: "Neighborhood Slug",    required: true },
          { type: "string", name: "neighborhoodDisplay",  label: "Neighborhood Name",    required: true },
          { type: "string", name: "intro",                label: "Intro Paragraph",      required: true, ui: { component: "textarea" } },
          {
            type: "object",
            name: "sections",
            label: "Content Sections",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.title }) },
            fields: [
              { type: "string", name: "title",   label: "Section Title" },
              { type: "string", name: "content", label: "Section Content", ui: { component: "textarea" } },
            ],
          },
          {
            type: "object",
            name: "faqs",
            label: "FAQs",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.question }) },
            fields: [
              { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
              { type: "string", name: "answer",   label: "Answer",   ui: { component: "textarea" } },
            ],
          },
          {
            type: "object",
            name: "relatedServices",
            label: "Related Services",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.service }) },
            fields: [{ type: "string", name: "service", label: "Service Slug" }],
          },
        ],
      },

      // ─── 6. GLOSSARY ──────────────────────────────────────────────────────
      {
        name: "glossary",
        label: "Glossary (SEO)",
        path: "src/content/glossary",
        format: "md",
        fields: [
          { type: "string", name: "term",        label: "Term Slug",     isTitle: true, required: true },
          { type: "string", name: "termDisplay", label: "Term Display",  required: true },
          { type: "string", name: "definition",  label: "Definition",    required: true, ui: { component: "textarea" } },
          {
            type: "object",
            name: "relatedTerms",
            label: "Related Terms",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.term }) },
            fields: [
              { type: "string", name: "term", label: "Term Name" },
              { type: "string", name: "slug", label: "Term Slug" },
            ],
          },
          {
            type: "object",
            name: "relatedServices",
            label: "Related Services",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.service }) },
            fields: [{ type: "string", name: "service", label: "Service Slug" }],
          },
          {
            type: "object",
            name: "faqs",
            label: "FAQs",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.question }) },
            fields: [
              { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
              { type: "string", name: "answer",   label: "Answer",   ui: { component: "textarea" } },
            ],
          },
          { type: "rich-text", name: "body", label: "Extended Content", isBody: true },
        ],
      },

      // ─── 7. COMPARISONS ───────────────────────────────────────────────────
      {
        name: "comparisons",
        label: "Comparisons (SEO)",
        path: "src/content/comparisons",
        format: "md",
        fields: [
          { type: "string", name: "slug",    label: "Slug",           isTitle: true, required: true },
          { type: "string", name: "intro",   label: "Intro",          required: true, ui: { component: "textarea" } },
          { type: "string", name: "verdict", label: "Verdict",        required: true, ui: { component: "textarea" } },
          {
            type: "object",
            name: "optionA",
            label: "Option A",
            fields: [
              { type: "string", name: "name",        label: "Name",        required: true },
              { type: "string", name: "slug",        label: "Slug",        required: true },
              { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
              { type: "string", name: "cost",        label: "Cost" },
              { type: "string", name: "duration",    label: "Duration" },
              { type: "string", name: "longevity",   label: "Longevity" },
              { type: "string", name: "bestFor",     label: "Best For" },
              {
                type: "object", name: "pros", label: "Pros", list: true,
                ui: { itemProps: (item: any) => ({ label: item?.pro }) },
                fields: [{ type: "string", name: "pro", label: "Pro" }],
              },
              {
                type: "object", name: "cons", label: "Cons", list: true,
                ui: { itemProps: (item: any) => ({ label: item?.con }) },
                fields: [{ type: "string", name: "con", label: "Con" }],
              },
            ],
          },
          {
            type: "object",
            name: "optionB",
            label: "Option B",
            fields: [
              { type: "string", name: "name",        label: "Name",        required: true },
              { type: "string", name: "slug",        label: "Slug",        required: true },
              { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
              { type: "string", name: "cost",        label: "Cost" },
              { type: "string", name: "duration",    label: "Duration" },
              { type: "string", name: "longevity",   label: "Longevity" },
              { type: "string", name: "bestFor",     label: "Best For" },
              {
                type: "object", name: "pros", label: "Pros", list: true,
                ui: { itemProps: (item: any) => ({ label: item?.pro }) },
                fields: [{ type: "string", name: "pro", label: "Pro" }],
              },
              {
                type: "object", name: "cons", label: "Cons", list: true,
                ui: { itemProps: (item: any) => ({ label: item?.con }) },
                fields: [{ type: "string", name: "con", label: "Con" }],
              },
            ],
          },
          {
            type: "object",
            name: "faqs",
            label: "FAQs",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.question }) },
            fields: [
              { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
              { type: "string", name: "answer",   label: "Answer",   ui: { component: "textarea" } },
            ],
          },
          {
            type: "object",
            name: "relatedServices",
            label: "Related Services",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.service }) },
            fields: [{ type: "string", name: "service", label: "Service Slug" }],
          },
        ],
      },

      // ─── 8. PERSONAS ──────────────────────────────────────────────────────
      {
        name: "personas",
        label: "Personas (SEO)",
        path: "src/content/personas",
        format: "md",
        fields: [
          { type: "string", name: "slug",           label: "Slug",           isTitle: true, required: true },
          { type: "string", name: "persona",        label: "Persona Key",    required: true },
          { type: "string", name: "personaDisplay", label: "Persona Name",   required: true },
          { type: "string", name: "tagline",        label: "Tagline",        required: true },
          { type: "string", name: "intro",          label: "Intro",          required: true, ui: { component: "textarea" } },
          {
            type: "object",
            name: "benefits",
            label: "Benefits",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.title }) },
            fields: [
              { type: "string", name: "title",       label: "Title",       required: true },
              { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
              { type: "string", name: "icon",        label: "Icon (emoji)" },
            ],
          },
          {
            type: "object",
            name: "services",
            label: "Featured Services",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.service }) },
            fields: [{ type: "string", name: "service", label: "Service Slug" }],
          },
          {
            type: "object",
            name: "faqs",
            label: "FAQs",
            list: true,
            ui: { itemProps: (item: any) => ({ label: item?.question }) },
            fields: [
              { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
              { type: "string", name: "answer",   label: "Answer",   ui: { component: "textarea" } },
            ],
          },
          { type: "rich-text", name: "body", label: "Page Content", isBody: true },
        ],
      },

    ],
  },
});
