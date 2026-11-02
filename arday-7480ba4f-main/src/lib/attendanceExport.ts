import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { AttendanceStatus } from '@/hooks/useAttendance';

interface StudentAttendanceRow {
  student_id: string;
  enrollment_number?: string | null;
  student_name: string;
  status: AttendanceStatus | undefined;
  marked_by?: string | null;
}

interface ClassInfo {
  name: string;
  grade?: string | null;
  section?: string | null;
  teacherName?: string | null;
  studentCount: number;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
  total: number;
}

function calcSummary(rows: StudentAttendanceRow[]): AttendanceSummary {
  const s: AttendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0, total: rows.length };
  rows.forEach(r => {
    if (!r.status) s.unmarked++;
    else s[r.status]++;
  });
  return s;
}

export function exportAttendancePdf(
  classInfo: ClassInfo,
  date: Date,
  rows: StudentAttendanceRow[],
) {
  const doc = new jsPDF();
  const dateStr = format(date, 'dd/MM/yyyy');
  const summary = calcSummary(rows);
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Attendance Report', 105, y, { align: 'center' });
  y += 12;

  // Class info block
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const classLabel = [classInfo.name, classInfo.grade, classInfo.section && `(${classInfo.section})`].filter(Boolean).join(' - ');
  doc.text(`Class: ${classLabel}`, 14, y);
  y += 7;
  doc.text(`Date: ${dateStr}`, 14, y);
  y += 7;
  if (classInfo.teacherName) {
    doc.text(`Teacher: ${classInfo.teacherName}`, 14, y);
    y += 7;
  }
  doc.text(`Total Students: ${classInfo.studentCount}`, 14, y);
  y += 10;

  // Summary box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const summaryItems = [
    { label: 'Present', val: summary.present, color: [34, 139, 34] as [number, number, number] },
    { label: 'Absent', val: summary.absent, color: [220, 38, 38] as [number, number, number] },
    { label: 'Late', val: summary.late, color: [234, 179, 8] as [number, number, number] },
    { label: 'Excused', val: summary.excused, color: [107, 114, 128] as [number, number, number] },
    { label: 'Unmarked', val: summary.unmarked, color: [156, 163, 175] as [number, number, number] },
  ];
  const boxW = 182 / summaryItems.length;
  summaryItems.forEach((item, i) => {
    const cx = 14 + boxW * i + boxW / 2;
    doc.setTextColor(...item.color);
    doc.text(`${item.val}`, cx, y + 9, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, cx, y + 16, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
  });
  doc.setTextColor(0, 0, 0);
  y += 30;

  // Attendance rate
  const attendanceRate = summary.total > 0 ? ((summary.present + summary.late) / summary.total * 100).toFixed(1) : '0';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Attendance Rate: ${attendanceRate}%`, 14, y);
  y += 10;

  // Table header
  const drawTableHeader = (doc: jsPDF, y: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, y, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 16, y + 5.5);
    doc.text('Student ID', 26, y + 5.5);
    doc.text('Student', 70, y + 5.5);
    doc.text('Status', 130, y + 5.5);
    doc.text('Marked By', 155, y + 5.5);
  };
  drawTableHeader(doc, y);
  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Draw a checkmark (✓) using PDF lines
  const drawCheckmark = (doc: jsPDF, x: number, y: number, color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(x, y - 1, x + 1.2, y + 0.8);
    doc.line(x + 1.2, y + 0.8, x + 3.5, y - 2.5);
  };

  // Draw an X (✗) using PDF lines
  const drawCross = (doc: jsPDF, x: number, y: number, color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(x, y - 2, x + 2.5, y + 0.5);
    doc.line(x, y + 0.5, x + 2.5, y - 2);
  };

  // Draw a dash (for late/excused/unmarked)
  const drawDash = (doc: jsPDF, x: number, y: number, color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    doc.line(x, y - 0.8, x + 3, y - 0.8);
  };

  const drawStatusSymbol = (doc: jsPDF, x: number, y: number, status: AttendanceStatus | undefined) => {
    switch (status) {
      case 'present': drawCheckmark(doc, x, y, [34, 139, 34]); break;
      case 'absent': drawCross(doc, x, y, [220, 38, 38]); break;
      default: drawDash(doc, x, y, [156, 163, 175]); break;
    }
  };

  // Marked By logic: "Absent" for absent, "—" for present/late/excused/unmarked
  const getMarkedByText = (status: AttendanceStatus | undefined): string => {
    if (status === 'absent') return 'Absent';
    return '\u2014';
  };

  const rowHeight = 8;

  rows.forEach((row, i) => {
    if (y > 272) {
      doc.addPage();
      y = 20;
      drawTableHeader(doc, y);
      y += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    // Alternate row bg
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, y, 182, rowHeight, 'F');
    }

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    // #
    doc.setFont('helvetica', 'normal');
    doc.text(`${i + 1}`, 16, y + 5.5);

    // Student ID
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(row.enrollment_number || row.student_id.slice(0, 8), 26, y + 5.5);

    // Student name
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(row.student_name, 70, y + 5.5);

    // Status symbol
    drawStatusSymbol(doc, 132, y + 5.5, row.status);

    // Marked By
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(row.status === 'absent' ? 220 : 107, row.status === 'absent' ? 38 : 114, row.status === 'absent' ? 38 : 128);
    doc.text(getMarkedByText(row.status), 155, y + 5.5);
    doc.setTextColor(0, 0, 0);

    y += rowHeight;
  });

  // Legend
  if (y > 255) { doc.addPage(); y = 20; }
  y += 5;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Legend:', 18, y);
  doc.setFont('helvetica', 'normal');
  const legendDefs: { status: AttendanceStatus | undefined; label: string }[] = [
    { status: 'present', label: 'Present' },
    { status: 'absent', label: 'Absent' },
    { status: undefined, label: 'Not Marked' },
  ];
  let lx = 42;
  legendDefs.forEach(item => {
    drawStatusSymbol(doc, lx, y, item.status);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`= ${item.label}`, lx + 5, y);
    lx += 45;
  });
  doc.setTextColor(0, 0, 0);
  y += 14;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, y);

  const fileName = `Attendance_${classInfo.name.replace(/\s+/g, '_')}_${format(date, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
