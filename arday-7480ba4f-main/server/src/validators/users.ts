import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(38).optional(),
  login_id: z
    .string()
    .trim()
    .min(2, 'Login ID must be at least 2 characters')
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Login ID can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required').max(31),
  role: z.enum(['super_admin', 'school_admin', 'teacher', 'student', 'parent']),
  school_id: z.string().uuid('Invalid school ID'),
  phone: z.string().max(26).optional(),
  // Teacher-specific
  employee_id: z.string().max(50).optional(),
  department: z.string().max(255).optional(),
  subjects: z.array(z.string()).optional(),
  // Student-specific
  enrollment_number: z.string().max(17).optional(),
  date_of_birth: z.string().optional(),
  grade: z.string().max(13).optional(),
  parent_id: z.string().uuid().optional(),
  // Parent-specific
  address: z.string().optional(),
  occupation: z.string().max(255).optional(),
}).refine((data) => data.email || data.login_id, {
  message: 'Either email or login_id is required',
  path: ['login_id'],
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(31).optional(),
  email: z.string().email().max(38).optional(),
  phone: z.string().max(26).optional(),
  avatar_url: z.string().url().optional(),
  must_change_password: z.boolean().optional(),
  preferred_language: z.string().max(10).optional(),
});

export const updateCredentialsSchema = z.object({
  user_id: z.string().uuid('Invalid user ID').optional(),
  userId: z.string().uuid('Invalid user ID').optional(),
  school_id: z.string().uuid('Invalid school ID').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  new_password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  email: z.string().email().max(38).optional(),
  new_email: z.string().email().max(38).optional(),
  login_id: z
    .string()
    .trim()
    .min(3, 'Login ID must be at least 3 characters')
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Login ID can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  new_login_id: z
    .string()
    .trim()
    .min(3, 'Login ID must be at least 3 characters')
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Login ID can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  full_name: z.string().min(1).max(31).optional(),
  fullName: z.string().min(1).max(31).optional(),
  phone: z.string().max(26).optional(),
  enrollment_number: z.string().max(17).optional(),
  grade: z.string().max(13).optional(),
  date_of_birth: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  must_change_password: z.boolean().optional(),
});

export const addRoleSchema = z.object({
  role: z.enum(['super_admin', 'school_admin', 'teacher', 'student', 'parent']),
  school_id: z.string().uuid('Invalid school ID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateCredentialsInput = z.infer<typeof updateCredentialsSchema>;
export type AddRoleInput = z.infer<typeof addRoleSchema>;
