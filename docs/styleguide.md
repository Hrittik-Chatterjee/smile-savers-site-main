# Smile Savers Design System Style Guide

> **Stack**: Astro 6 + Tailwind 4 + DaisyUI 5

This guide documents the design tokens and implementation patterns used in the Smile Savers project. We use a **CSS-First** approach with Tailwind 4, meaning all tokens are defined in `src/styles/global.css`.

## Color System (OKLCH)

We use the OKLCH color space for perceptually uniform colors and better accessibility.

### Primary Palette

- **Primary (Navy)**: `oklch(22% 0.05 230)` - Headings, Navigation, Primary Branded UI.
- **Secondary (Mint)**: `oklch(65% 0.15 175)` - Accent elements, secondary buttons.
- **Accent (Cyan)**: `oklch(65% 0.15 225)` - CTAs, high-priority icons.

### Section Backgrounds

- **Clinical (Mint Whisper)**: `oklch(96% 0.02 145)` - Services, Technology.
- **Human (Warm Sand)**: `oklch(93% 0.04 85)` - Hero, Testimonials.

## Typography

### Font Families

- **Sans (Body)**: `Inter Variable`
- **Heading (Display)**: `Plus Jakarta Sans Variable`
- **Mono**: `JetBrains Mono Variable`

### Fluid Sizes

Typography scales automatically using `clamp()` based on viewport width.

- `base`: `clamp(0.9375rem, 0.9rem + 0.25vw, 1rem)`
- `5xl`: `clamp(2.75rem, 2.2rem + 2vw, 3.5rem)`

## Spacing & Layout

### Standard Spacing

- `--spacing-section`: Large vertical padding for sections.
- `--spacing-block`: Medium padding for component groups.
- `--spacing-element`: Padding within cards and elements.

### Container Max-Widths

- `prose`: `65ch` (Optimal reading width)
- `xl`: `80rem` (Default site width)

## Implementation Rules

1. **Use Variables**: Never use hardcoded hex/oklch values in `.astro` files. Use `var(--color-primary)`.
2. **Mobile First**: Use `min-width` media queries for responsive overrides.
3. **DaisyUI Sync**: All custom tokens match DaisyUI's internal variable structure where possible.

## Glassmorphism Patterns

Used for premium UI effects (Header, Bento Cards).

```css
background: oklch(from var(--color-surface-elevated) l c h / 0.85);
backdrop-filter: blur(20px);
border: 1px solid oklch(from var(--color-border) l c h / 0.6);
```
