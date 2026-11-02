export interface AttendanceStudentRow {
  student_id: string;
}

export function buildBulkAttendanceChanges<Status extends string>(
  students: readonly AttendanceStudentRow[],
  lockedStudentIds: ReadonlySet<string>,
  status: Status,
): Record<string, Status> {
  const changes: Record<string, Status> = {};

  students.forEach(({ student_id }) => {
    if (!lockedStudentIds.has(student_id)) {
      changes[student_id] = status;
    }
  });

  return changes;
}
