import { describe, expect, it } from 'vitest';
import { buildBulkAttendanceChanges } from '@/lib/attendanceBulk';

describe('buildBulkAttendanceChanges', () => {
  const students = [
    { student_id: 'student-1' },
    { student_id: 'student-2' },
    { student_id: 'student-3' },
  ];
  const lockedStudentIds = new Set(['student-2']);

  it.each(['present', 'absent', 'excused'] as const)(
    'includes only unlocked students for the %s bulk action',
    status => {
      expect(buildBulkAttendanceChanges(students, lockedStudentIds, status)).toEqual({
        'student-1': status,
        'student-3': status,
      });
    },
  );
});
