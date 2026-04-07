/**
 * Shared TypeScript Types
 * Central type definitions used across the application
 */

// ============================================
// CONTENT TYPES
// ============================================

/**
 * FAQ item structure used across collections
 */
export interface FAQ {
  question: string;
  answer: string;
}

/**
 * Related service reference
 */
export interface RelatedService {
  slug: string;
  title: string;
}

/**
 * Section content block
 */
export interface ContentSection {
  title: string;
  content: string;
}

// ============================================
// COMPONENT PROPS
// ============================================

/**
 * Common button variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

/**
 * Common button sizes
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Base props for interactive components
 */
export interface InteractiveProps {
  disabled?: boolean;
  loading?: boolean;
}

// ============================================
// SEO TYPES
// ============================================

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

/**
 * Meta tag configuration
 */
export interface MetaConfig {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

// ============================================
// LAYOUT TYPES
// ============================================

/**
 * Page layout variants
 */
export type PageLayout = 'default' | 'full-width' | 'narrow' | 'service' | 'legal';

/**
 * Common spacing values
 */
export type Spacing = 'none' | 'sm' | 'md' | 'lg' | 'xl';

// ============================================
// FORM TYPES
// ============================================

/**
 * Form field state
 */
export interface FieldState {
  value: string;
  error?: string;
  touched: boolean;
}

/**
 * Appointment form data
 */
export interface AppointmentFormData {
  name: string;
  email: string;
  phone: string;
  service: string;
  preferredDate?: string;
  preferredTime?: string;
  message?: string;
}

/**
 * Contact form data
 */
export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extract the element type from an array type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
