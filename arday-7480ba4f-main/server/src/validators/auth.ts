import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  login_id: z.string().min(1, 'Login ID is required').optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.email || data.login_id, {
  message: 'Either email or login_id is required',
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  role: z.enum(['super_admin', 'school_admin', 'teacher', 'student', 'parent']),
  school_id: z.string().uuid().optional(),
  login_id: z.string().min(1).optional(),
  phone: z.string().max(50).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
