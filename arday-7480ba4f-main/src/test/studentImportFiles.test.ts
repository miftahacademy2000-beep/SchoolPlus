import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseImportFile } from '../lib/csvUtils';
import { getStudentStatusCounts } from '../lib/studentStatus';

const headers = ['full_name', 'login_id', 'password', 'enrollment_number'];
const dataRow = ['Student Import Test', 'import-test-01', 'test-password-01', 'ENR-IMPORT-01'];

function createWorkbookFile(filename: string, bookType: XLSX.BookType): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, dataRow]), 'Students');
  const buffer = XLSX.write(workbook, { type: 'array', bookType });
  return new File([buffer], filename);
}

describe('student import files', () => {
  it.each([
    ['students.csv', 'csv'],
    ['students.xlsx', 'xlsx'],
    ['students.xls', 'xls'],
  ])('parses %s using its first worksheet', async (filename, format) => {
    const file = format === 'csv'
      ? new File([`${headers.join(',')}\r\n${dataRow.join(',')}`], filename)
      : createWorkbookFile(filename, format as XLSX.BookType);
    const parsed = await parseImportFile(file);

    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual([dataRow]);
  });

  it('enforces school-scoped total = active + inactive counts, including 292 / 268 / 24', () => {
    const students = [
      ...Array.from({ length: 268 }, (_, index) => ({
        school_id: 'school-a',
        archived_at: null,
      })),
      ...Array.from({ length: 24 }, (_, index) => ({
        school_id: 'school-a',
        archived_at: '2026-10-01T00:00:00.000Z',
      })),
      { school_id: 'school-b', archived_at: null },
      { school_id: 'school-b', archived_at: '2026-10-01T00:00:00.000Z' },
    ];

    expect(getStudentStatusCounts(students, 'school-a')).toEqual({
      total: 292,
      active: 268,
      inactive: 24,
    });
    expect(getStudentStatusCounts(students, 'school-b')).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
    });
  });
});
