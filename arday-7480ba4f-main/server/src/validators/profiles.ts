import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  preferred_language: z.string().max(10).optional(),
});

export const saveSettingsSchema = z.object({
  settings: z.record(z.unknown()),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SaveSettingsInput = z.infer<typeof saveSettingsSchema>;
