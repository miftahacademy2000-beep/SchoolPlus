export interface StudentStatusRecord {
  school_id: string;
  archived_at?: string | null;
}

export interface StudentStatusCounts {
  total: number;
  active: number;
  inactive: number;
}

export function getStudentStatusCounts(
  students: StudentStatusRecord[],
  schoolId: string,
): StudentStatusCounts {
  const schoolStudents = students.filter((student) => student.school_id === schoolId);
  const inactive = schoolStudents.filter((student) => !!student.archived_at).length;
  const active = schoolStudents.length - inactive;
  return { total: schoolStudents.length, active, inactive };
}
