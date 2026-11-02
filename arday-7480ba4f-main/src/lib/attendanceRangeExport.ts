import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { DailyTrend, StudentSummary } from '@/hooks/useAttendanceRange';

interface ClassInfo {
  name: string;
  grade: string | null;
  section: string | null;
}

export function exportAttendanceRangeReportPdf(
  classInfo: ClassInfo,
  startDate: Date,
  endDate: Date,
  stats: { total: number; present: number; absent: number; late: number; excused: number; rate: number },
  dailyTrends: DailyTrend[],
  studentSummaries: StudentSummary[],
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Attendance Range Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Class info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const className = `${classInfo.name}${classInfo.grade ? ` - ${classInfo.grade}` : ''}${classInfo.section ? ` (${classInfo.section})` : ''}`;
  doc.text(className, pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(10);
  doc.text(`Period: ${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Summary box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, 'F');
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const cols = [
    { label: 'Rate', value: `${stats.rate}%` },
    { label: 'Total', value: `${stats.total}` },
    { label: 'Present', value: `${stats.present}` },
    { label: 'Absent', value: `${stats.absent}` },
    { label: 'Late', value: `${stats.late}` },
    { label: 'Excused', value: `${stats.excused}` },
  ];
  const colW = (pageWidth - 28) / cols.length;
  cols.forEach((c, i) => {
    const x = 14 + colW * i + colW / 2;
    doc.text(c.label, x, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(c.value, x, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
  });
  y += 24;

  // Daily trends table
  if (dailyTrends.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Trends', 14, y);
    y += 6;

    const headers = ['Date', 'Present', 'Absent', 'Late', 'Excused', 'Rate'];
    const colWidths = [35, 25, 25, 25, 25, 25];
    doc.setFontSize(8);
    doc.setFillColor(230, 230, 230);
    doc.rect(14, y - 4, pageWidth - 28, 7, 'F');
    let x = 14;
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y);
      x += colWidths[i];
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    dailyTrends.forEach((d, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
      }
      x = 14;
      const row = [
        format(new Date(d.date + 'T00:00:00'), 'dd/MM/yyyy'),
        `${d.present}`,
        `${d.absent}`,
        `${d.late}`,
        `${d.excused}`,
        `${d.rate}%`,
      ];
      row.forEach((val, i) => {
        doc.text(val, x + 2, y);
        x += colWidths[i];
      });
      y += 6;
    });
    y += 8;
  }

  // Student summary
  if (studentSummaries.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Summary', 14, y);
    y += 6;

    const sHeaders = ['#', 'Student', 'Present', 'Absent', 'Late', 'Excused', 'Rate'];
    const sWidths = [12, 55, 22, 22, 22, 22, 22];
    doc.setFontSize(8);
    doc.setFillColor(230, 230, 230);
    doc.rect(14, y - 4, pageWidth - 28, 7, 'F');
    let x = 14;
    sHeaders.forEach((h, i) => {
      doc.text(h, x + 2, y);
      x += sWidths[i];
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    studentSummaries.forEach((s, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
      }
      x = 14;
      const row = [`${idx + 1}`, s.student_name, `${s.present}`, `${s.absent}`, `${s.late}`, `${s.excused}`, `${s.rate}%`];
      row.forEach((val, i) => {
        doc.text(val.substring(0, sWidths[i] / 2.2), x + 2, y);
        x += sWidths[i];
      });
      y += 6;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, 290, { align: 'right' });
  }

  doc.save(`attendance-report-${classInfo.name}-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}.pdf`);
}
