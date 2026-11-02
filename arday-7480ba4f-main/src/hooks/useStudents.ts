import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTeacher } from './useCurrentTeacher';

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === 'object' ? value as ApiRecord : {};
}

function asRecords(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function firstValue(record: ApiRecord, ...keys: string[]): unknown {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);
}

export interface StudentWithProfile {
  id: string;
  user_id: string;
  school_id: string;
  enrollment_number: string | null;
  grade: string | null;
  date_of_birth: string | null;
  parent_id: string | null;
  created_at: string;
  start_date: string | null;
  gender: string | null;
  archived_at?: string | null;
  studentFeeOverrides?: { monthlyFee: number }[];
  classStudents: { enrolledAt: string | null; class: { id: string; name: string; grade: string | null; section: string | null; monthlyFee: number | null; schoolId: string } }[];
  profile: {
    full_name: string | null;
    email: string | null;
    login_id: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

export function useStudents(includeArchived = false, classId?: string) {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();
  const { primaryRole } = useAuth();
  const { data: currentTeacher } = useCurrentTeacher();
  const isTeacher = primaryRole === 'teacher';

  // Enable the query if:
  // - User is super admin, OR
  // - User has a valid currentSchoolId from their role
  // AND (if teacher, must have currentTeacher data)
  const hasValidSchoolAccess = isSuperAdmin || !!currentSchoolId;
  const teacherHasData = !isTeacher || !!currentTeacher;

  return useQuery({
    queryKey: ['students', currentSchoolId, isTeacher ? currentTeacher?.id : null, includeArchived, classId || null],
    queryFn: async (): Promise<StudentWithProfile[]> => {
      if (!currentSchoolId) return [];

      const records: ApiRecord[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await api.get<{ data?: ApiRecord[]; totalPages?: number }>(
          '/students',
          { params: { school_id: currentSchoolId, page, limit: 500, include_archived: includeArchived || undefined, class_id: classId } },
        );
        const pageRecords = Array.isArray(response) ? response : response.data || [];
        records.push(...pageRecords);
        totalPages = Array.isArray(response) ? 1 : response.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      return records.map((student) => {
        const profile = asRecord(student.profile);
        const classStudents = asRecords(firstValue(student, 'classStudents', 'class_students')).flatMap((enrollment) => {
          const rawClass = firstValue(enrollment, 'class', 'classes');
          if (!rawClass) return [];
          const cls = asRecord(rawClass);
          const classFees = asRecords(cls.class_fees);
          const monthlyFee = firstValue(cls, 'monthlyFee', 'monthly_fee') ?? firstValue(classFees[0] || {}, 'monthly_fee');
          return [{
            enrolledAt: firstValue(enrollment, 'enrolledAt', 'enrolled_at') as string | null ?? null,
            class: {
              id: String(cls.id),
              name: String(cls.name),
              grade: firstValue(cls, 'grade') as string | null ?? null,
              section: firstValue(cls, 'section') as string | null ?? null,
              monthlyFee: monthlyFee == null ? null : Number(monthlyFee),
              schoolId: String(firstValue(cls, 'schoolId', 'school_id')),
            },
          }];
        });
        return {
          ...student,
          id: String(student.id),
          user_id: String(firstValue(student, 'user_id', 'userId')),
          school_id: String(firstValue(student, 'school_id', 'schoolId')),
          enrollment_number: firstValue(student, 'enrollment_number', 'enrollmentNumber') as string | null ?? null,
          date_of_birth: firstValue(student, 'date_of_birth', 'dateOfBirth') as string | null ?? null,
          created_at: String(firstValue(student, 'created_at', 'createdAt')),
          start_date: firstValue(student, 'start_date', 'startDate') as string | null ?? null,
          gender: firstValue(student, 'gender') as string | null ?? null,
          profile: student.profile ? {
            full_name: firstValue(profile, 'full_name', 'fullName') as string | null ?? null,
            email: firstValue(profile, 'email') as string | null ?? null,
            login_id: firstValue(profile, 'login_id', 'loginId') as string | null ?? null,
            avatar_url: firstValue(profile, 'avatar_url', 'avatarUrl') as string | null ?? null,
            phone: firstValue(profile, 'phone') as string | null ?? null,
          } : null,
          classStudents,
          studentFeeOverrides: asRecords(firstValue(student, 'studentFeeOverrides', 'student_fee_overrides')).map((override) => ({
            monthlyFee: Number(firstValue(override, 'monthlyFee', 'monthly_fee') ?? 0),
          })),
        } as StudentWithProfile;
      });
    },
    // Fixed enabled condition: always enable for super admins,
    // enable for others if they have valid school access and teacher data if applicable
    enabled: hasValidSchoolAccess && teacherHasData,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      school_id?: string;
      enrollment_number?: string;
      grade?: string;
      date_of_birth?: string;
      parent_id?: string;
    }) => {
      await api.post('/students', {
        user_id: data.user_id,
        school_id: data.school_id || currentSchoolId,
        enrollment_number: data.enrollment_number || null,
        grade: data.grade || null,
        date_of_birth: data.date_of_birth || null,
        parent_id: data.parent_id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student added',
        description: 'The student has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      user_id?: string;
      full_name?: string;
      email?: string;
      phone?: string;
      enrollment_number?: string;
      grade?: string;
      date_of_birth?: string;
      parent_id?: string;
    }) => {
      await api.put(`/students/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student updated',
        description: 'The student has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export { useArchiveUser as useDeleteStudent } from './useArchivedUsers';
