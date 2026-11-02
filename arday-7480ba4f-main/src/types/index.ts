export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  studentCount: number;
  teacherCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Class {
  id: string;
  name: string;
  grade: string;
  section?: string;
  schoolId: string;
  teacherId?: string;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  userId: string;
  schoolId: string;
  classId?: string;
  enrollmentNumber: string;
  dateOfBirth?: Date;
  parentId?: string;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  employeeId: string;
  department?: string;
  subjects?: string[];
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  schoolId: string;
  teacherId?: string;
  credits?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  read: boolean;
  userId: string;
  createdAt: Date;
}

export interface StatCardData {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
