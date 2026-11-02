import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { GradeRecord, GradeType } from '@/hooks/useGrades';

const gradeTypeLabels: Record<GradeType, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  project: 'Project',
  participation: 'Participation',
};

// ─── CSV Export ───

export function exportGradesToCsv(grades: GradeRecord[], filename?: string) {
  const headers = ['Student', 'Course', 'Code', 'Assessment', 'Type', 'Score', 'Max Score', 'Percentage', 'Date', 'Notes'];
  const rows = grades.map((g) => [
    g.student?.profile?.full_name || 'Unknown',
    g.course?.name || 'Unknown',
    g.course?.code || '',
    g.title,
    gradeTypeLabels[g.grade_type] || g.grade_type,
    String(g.score),
    String(g.max_score),
    `${Math.round((g.score / g.max_score) * 100)}%`,
    format(new Date(g.graded_at), 'yyyy-MM-dd'),
    g.notes || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `grades-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───

export function exportGradesToPdf(grades: GradeRecord[], filename?: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const primary: [number, number, number] = [59, 130, 246];
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const headerBg: [number, number, number] = [241, 245, 249];

  // Title
  doc.setTextColor(...primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Grades Report', 14, 20);

  doc.setTextColor(...muted);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 28);
  doc.text(`Total records: ${grades.length}`, 14, 34);

  // Summary stats
  const avgScore = grades.length
    ? Math.round(grades.reduce((a, g) => a + (g.score / g.max_score) * 100, 0) / grades.length)
    : 0;
  doc.text(`Average score: ${avgScore}%`, pageWidth / 2, 34);

  // Table
  const colX = [14, 64, 114, 154, 189, 214, 239, 264];
  const colHeaders = ['Student', 'Course', 'Assessment', 'Type', 'Score', '%', 'Date', 'Notes'];
  let y = 44;

  // Header row
  doc.setFillColor(...headerBg);
  doc.rect(12, y - 5, pageWidth - 24, 8, 'F');
  doc.setTextColor(...text);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  colHeaders.forEach((h, i) => doc.text(h, colX[i], y));

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...text);

  grades.forEach((g) => {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
      // Repeat header
      doc.setFillColor(...headerBg);
      doc.rect(12, y - 5, pageWidth - 24, 8, 'F');
      doc.setFont('helvetica', 'bold');
      colHeaders.forEach((h, i) => doc.text(h, colX[i], y));
      y += 8;
      doc.setFont('helvetica', 'normal');
    }

    const pct = Math.round((g.score / g.max_score) * 100);
    const row = [
      (g.student?.profile?.full_name || 'Unknown').substring(0, 25),
      (g.course?.name || 'Unknown').substring(0, 25),
      g.title.substring(0, 20),
      gradeTypeLabels[g.grade_type] || g.grade_type,
      `${g.score}/${g.max_score}`,
      `${pct}%`,
      format(new Date(g.graded_at), 'MM/dd/yy'),
      (g.notes || '').substring(0, 15),
    ];

    // Color score based on percentage
    row.forEach((cell, i) => {
      if (i === 5) {
        if (pct >= 90) doc.setTextColor(34, 197, 94);
        else if (pct >= 70) doc.setTextColor(...primary);
        else if (pct >= 50) doc.setTextColor(234, 179, 8);
        else doc.setTextColor(239, 68, 68);
      }
      doc.text(cell, colX[i], y);
      if (i === 5) doc.setTextColor(...text);
    });

    y += 6;
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Grades Report — Confidential', 14, footerY);

  doc.save(filename || `grades-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ─── CSV Import Template ───

export function downloadImportTemplate() {
  const headers = ['student_name', 'course_code', 'grade_type', 'title', 'score', 'max_score', 'notes'];
  const sampleRow = ['John Doe', 'MATH101', 'exam', 'Midterm Exam', '85', '100', 'Good performance'];
  const csvContent = [headers, sampleRow]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'grades-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export interface ParsedGradeRow {
  student_name: string;
  course_code: string;
  grade_type: string;
  title: string;
  score: number;
  max_score: number;
  notes: string;
  error?: string;
  // Resolved IDs
  student_id?: string;
  course_id?: string;
}

const VALID_GRADE_TYPES = ['assignment', 'quiz', 'exam', 'project', 'participation'];

export function parseCsvContent(content: string): ParsedGradeRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const requiredCols = ['student_name', 'course_code', 'grade_type', 'title', 'score'];
  const missingCols = requiredCols.filter((c) => !header.includes(c));
  if (missingCols.length > 0) {
    return [{ student_name: '', course_code: '', grade_type: '', title: '', score: 0, max_score: 100, notes: '', error: `Missing columns: ${missingCols.join(', ')}` }];
  }

  const rows: ParsedGradeRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

    const scoreNum = parseFloat(row.score || '');
    const maxScoreNum = parseFloat(row.max_score || '100');
    const errors: string[] = [];

    if (!row.student_name) errors.push('Missing student_name');
    if (!row.course_code) errors.push('Missing course_code');
    if (!row.title) errors.push('Missing title');
    if (isNaN(scoreNum)) errors.push('Invalid score');
    if (row.grade_type && !VALID_GRADE_TYPES.includes(row.grade_type)) {
      errors.push(`Invalid grade_type: ${row.grade_type}`);
    }

    rows.push({
      student_name: row.student_name || '',
      course_code: row.course_code || '',
      grade_type: row.grade_type || 'assignment',
      title: row.title || '',
      score: isNaN(scoreNum) ? 0 : scoreNum,
      max_score: isNaN(maxScoreNum) ? 100 : maxScoreNum,
      notes: row.notes || '',
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
