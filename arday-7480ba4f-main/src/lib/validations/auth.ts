import { z } from 'zod';

export const appRoles = ['super_admin', 'school_admin', 'teacher', 'student', 'parent'] as const;
export type AppRole = typeof appRoles[number];

export const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

// Roles that require a school selection
export const rolesRequiringSchool: AppRole[] = ['school_admin', 'teacher', 'student'];

// Login types for ID-based login
export const loginTypes = ['email', 'studentId', 'teacherId'] as const;
export type LoginType = typeof loginTypes[number];

export const loginTypeLabels: Record<LoginType, string> = {
  email: 'Email',
  studentId: 'Student ID',
  teacherId: 'Teacher ID',
};

// Login schema that supports email, student ID, and teacher ID
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { message: 'Email or ID is required' })
    .max(255, { message: 'Must be less than 255 characters' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128, { message: 'Password must be less than 128 characters' }),
  schoolId: z.string().optional(), // Required when logging in with ID
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(100, { message: 'Full name must be less than 100 characters' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128, { message: 'Password must be less than 128 characters' }),
  confirmPassword: z
    .string()
    .min(1, { message: 'Please confirm your password' }),
  role: z.enum(appRoles, { required_error: 'Please select a role' }),
  schoolId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => {
  // If role requires school, schoolId must be provided
  if (rolesRequiringSchool.includes(data.role) && !data.schoolId) {
    return false;
  }
  return true;
}, {
  message: 'Please select a school',
  path: ['schoolId'],
});

// Helper to check if identifier is an email
export function isEmail(identifier: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(identifier);
}

// Generate internal email from login ID, school ID, and role
export function generateInternalEmail(loginId: string, schoolId: string, role: 'student' | 'teacher'): string {
  const sanitizedLoginId = loginId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const shortSchoolId = schoolId.substring(0, 8);
  return `${sanitizedLoginId}.${shortSchoolId}@${role}.internal`;
}

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;