import { z } from 'zod';

export const schoolInquirySchema = z.object({
  school_name: z
    .string()
    .trim()
    .min(2, 'School name must be at least 2 characters')
    .max(100, 'School name must be less than 100 characters'),
  contact_name: z
    .string()
    .trim()
    .min(2, 'Contact name must be at least 2 characters')
    .max(100, 'Contact name must be less than 100 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
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
  message: z
    .string()
    .trim()
    .max(1000, 'Message must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
});

export type SchoolInquiryFormData = z.infer<typeof schoolInquirySchema>;
