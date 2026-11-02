import * as XLSX from 'xlsx';

/**
 * CSV generation, download, and parsing utilities for student data export/import.
 */

export function escapeCSVField(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCSVField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCSVField).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCSV(content: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (inQuotes) {
        if (line[i] === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (line[i] === '"') {
          inQuotes = false;
        } else {
          current += line[i];
        }
      } else {
        if (line[i] === '"') {
          inQuotes = true;
        } else if (line[i] === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export async function parseImportFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['csv', 'xls', 'xlsx'].includes(extension)) {
    throw new Error('Choose a .csv, .xls, or .xlsx file');
  }

  const content = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read import file'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Import file did not produce binary data'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
  const workbook = XLSX.read(content, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { headers: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  const values = matrix.map((row) => row.map((value) => String(value ?? '').trim()));
  const [headers = [], ...rows] = values;
  return { headers, rows };
}

export const IMPORT_TEMPLATES: Record<string, { headers: string[]; example: string[] }> = {
  students: {
    headers: ['Full Name', 'Email', 'Password', 'Phone', 'Enrollment Number', 'Grade', 'Date of Birth'],
    example: ['John Doe', 'john@example.com', 'Pass123!', '+1234567890', 'STU001', 'Grade 5', '2015-03-15'],
  },
  attendance: {
    headers: ['Enrollment Number', 'Class Name', 'Date', 'Status', 'Notes'],
    example: ['STU001', 'Class 5A', '2025-03-15', 'present', ''],
  },
  grades: {
    headers: ['Enrollment Number', 'Course Code', 'Title', 'Grade Type', 'Score', 'Max Score', 'Weight', 'Notes'],
    example: ['STU001', 'MATH101', 'Midterm Exam', 'exam', '85', '100', '1.0', ''],
  },
  class_enrollments: {
    headers: ['Enrollment Number', 'Class Name'],
    example: ['STU001', 'Class 5A'],
  },
};

export function generateTemplateCSV(type: string): string {
  const template = IMPORT_TEMPLATES[type];
  if (!template) return '';
  return generateCSV(template.headers, [template.example]);
}
