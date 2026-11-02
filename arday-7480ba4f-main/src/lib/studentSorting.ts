/**
 * Extracts the first numeric value from a student enrollment number for sorting.
 * Ignores prefixes, leading zeros, and non-numeric characters.
 * Returns Infinity for null/undefined values to push them to the end.
 */
export function extractStudentIdNum(id: string | null | undefined): number {
  if (!id) return Infinity;
  const match = id.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

/**
 * Comparator function for sorting objects with an enrollment_number field.
 * Usage: array.sort(compareByEnrollmentNumber)
 */
export function compareByEnrollmentNumber(
  a: { enrollment_number?: string | null },
  b: { enrollment_number?: string | null }
): number {
  return extractStudentIdNum(a.enrollment_number) - extractStudentIdNum(b.enrollment_number);
}
