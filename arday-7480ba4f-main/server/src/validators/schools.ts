import { z } from 'zod';

export const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required').max(255),
  slug: z.string().min(1).max(255).optional(),
  logo_url: z.string().url().optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  monthly_fee: z.number().min(0).optional(),
});

export const updateSchoolSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logo_url: z.string().url().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  monthly_fee: z.number().min(0).optional().nullable(),
});

export const updateSchoolStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type UpdateSchoolStatusInput = z.infer<typeof updateSchoolStatusSchema>;
