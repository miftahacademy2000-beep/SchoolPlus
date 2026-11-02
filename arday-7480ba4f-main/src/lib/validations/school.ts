import { z } from 'zod';

export const schoolSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'School name must be at least 2 characters')
    .max(100, 'School name must be less than 100 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone must be less than 20 characters')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

export type SchoolFormData = z.infer<typeof schoolSchema>;

// Helper to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}
