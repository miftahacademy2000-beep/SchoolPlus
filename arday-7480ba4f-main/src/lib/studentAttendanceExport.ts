import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { AttendanceStatus } from '@/hooks/useAttendance';

interface StudentAttendanceRecord {
  date: string;
  status: AttendanceStatus;
}

interface StudentReportData {
  studentName: string;
  enrollmentNumber?: string | null;
  className: string;
  classGrade?: string | null;
  classSection?: string | null;
  teacherName?: string | null;
  dateRange: { start: Date; end: Date };
  records: StudentAttendanceRecord[];
}

function calcStats(records: StudentAttendanceRecord[]) {
  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const excused = records.filter(r => r.status === 'excused').length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { total, present, absent, late, excused, rate };
}

export function generateStudentAttendancePdf(data: StudentReportData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const stats = calcStats(data.records);
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Attendance Report', pageWidth / 2, y, { align: 'center' });
  y += 14;

  // Student info block
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, y - 4, pageWidth - 28, 38, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Student: ${data.studentName}`, 20, y + 2);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.enrollmentNumber) {
    doc.text(`ID: ${data.enrollmentNumber}`, 20, y + 10);
  }
  
  const classLabel = [data.className, data.classGrade, data.classSection && `(${data.classSection})`].filter(Boolean).join(' - ');
  doc.text(`Class: ${classLabel}`, 20, y + 18);
  
  doc.text(`Period: ${format(data.dateRange.start, 'dd/MM/yyyy')} – ${format(data.dateRange.end, 'dd/MM/yyyy')}`, 20, y + 26);
  
  if (data.teacherName) {
    doc.text(`Teacher: ${data.teacherName}`, pageWidth / 2 + 10, y + 10);
  }
  y += 42;

  // Summary stats
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3, 'F');
  
  const statItems = [
    { label: 'Rate', value: `${stats.rate}%`, color: stats.rate >= 90 ? [34, 197, 94] : stats.rate >= 75 ? [234, 179, 8] : [239, 68, 68] },
    { label: 'Present', value: `${stats.present}`, color: [34, 197, 94] },
    { label: 'Absent', value: `${stats.absent}`, color: [239, 68, 68] },
    { label: 'Late', value: `${stats.late}`, color: [234, 179, 8] },
    { label: 'Excused', value: `${stats.excused}`, color: [156, 163, 175] },
    { label: 'Total Days', value: `${stats.total}`, color: [255, 255, 255] },
  ];
  
  const statW = (pageWidth - 28) / statItems.length;
  statItems.forEach((item, i) => {
    const cx = 14 + statW * i + statW / 2;
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, cx, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text(item.label, cx, y + 20, { align: 'center' });
  });
  doc.setTextColor(0, 0, 0);
  y += 36;

  // Attendance records table
  const drawHeader = (yPos: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 18, yPos + 5.5);
    doc.text('Date', 30, yPos + 5.5);
    doc.text('Day', 75, yPos + 5.5);
    doc.text('Status', 110, yPos + 5.5);
    doc.setTextColor(0, 0, 0);
    return yPos + 8;
  };

  y = drawHeader(y);

  // Draw status symbols
  const drawCheckmark = (doc: jsPDF, x: number, cy: number) => {
    doc.setDrawColor(34, 139, 34);
    doc.setLineWidth(0.6);
    doc.line(x, cy - 1, x + 1.2, cy + 0.8);
    doc.line(x + 1.2, cy + 0.8, x + 3.5, cy - 2.5);
  };

  const drawCross = (doc: jsPDF, x: number, cy: number) => {
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    doc.line(x, cy - 2, x + 2.5, cy + 0.5);
    doc.line(x, cy + 0.5, x + 2.5, cy - 2);
  };

  const drawDash = (doc: jsPDF, x: number, cy: number) => {
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.7);
    doc.line(x, cy - 0.8, x + 3, cy - 0.8);
  };

  const statusLabels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
  };

  const statusColors: Record<string, [number, number, number]> = {
    present: [34, 139, 34],
    absent: [220, 38, 38],
    late: [234, 179, 8],
    excused: [107, 114, 128],
  };

  // Sort records by date
  const sortedRecords = [...data.records].sort((a, b) => a.date.localeCompare(b.date));

  sortedRecords.forEach((record, i) => {
    if (y > 272) {
      doc.addPage();
      y = 20;
      y = drawHeader(y);
    }

    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // #
    doc.text(`${i + 1}`, 18, y + 5.5);

    // Date
    const recordDate = new Date(record.date + 'T00:00:00');
    doc.text(format(recordDate, 'dd/MM/yyyy'), 30, y + 5.5);

    // Day
    doc.setTextColor(107, 114, 128);
    doc.text(format(recordDate, 'EEEE'), 75, y + 5.5);

    // Status symbol + label
    const sx = 112;
    switch (record.status) {
      case 'present': drawCheckmark(doc, sx, y + 5.5); break;
      case 'absent': drawCross(doc, sx, y + 5.5); break;
      default: drawDash(doc, sx, y + 5.5); break;
    }

    const color = statusColors[record.status] || [107, 114, 128];
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabels[record.status] || record.status, sx + 8, y + 5.5);

    doc.setTextColor(0, 0, 0);
    y += 8;
  });

  // Legend
  if (y > 255) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, 'F');
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Legend:', 18, y + 3);
  let lx = 42;
  [
    { draw: drawCheckmark, label: 'Present' },
    { draw: drawCross, label: 'Absent' },
    { draw: drawDash, label: 'Late/Excused' },
  ].forEach(item => {
    item.draw(doc, lx, y + 3);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`= ${item.label}`, lx + 5, y + 3);
    lx += 50;
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, 290, { align: 'right' });
  }

  return doc;
}

export function downloadStudentAttendancePdf(data: StudentReportData): string {
  const doc = generateStudentAttendancePdf(data);
  const fileName = `Attendance_${data.studentName.replace(/\s+/g, '_')}_${format(data.dateRange.start, 'yyyyMMdd')}-${format(data.dateRange.end, 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function shareStudentAttendanceViaWhatsApp(data: StudentReportData, parentPhone?: string | null) {
  // First download the PDF
  const fileName = downloadStudentAttendancePdf(data);
  
  const stats = calcStats(data.records);
  const classLabel = [data.className, data.classGrade, data.classSection && `(${data.classSection})`].filter(Boolean).join(' - ');
  
  // Build WhatsApp message
  const message = [
    `📋 *Student Attendance Report*`,
    ``,
    `👤 *Student:* ${data.studentName}`,
    data.enrollmentNumber ? `🆔 *ID:* ${data.enrollmentNumber}` : '',
    `🏫 *Class:* ${classLabel}`,
    `📅 *Period:* ${format(data.dateRange.start, 'dd/MM/yyyy')} – ${format(data.dateRange.end, 'dd/MM/yyyy')}`,
    ``,
    `📊 *Summary:*`,
    `✅ Present: ${stats.present}`,
    `❌ Absent: ${stats.absent}`,
    `⏰ Late: ${stats.late}`,
    `📝 Excused: ${stats.excused}`,
    `📈 Attendance Rate: ${stats.rate}%`,
    ``,
    `📎 _PDF report has been downloaded. Please attach it to this message._`,
  ].filter(Boolean).join('\n');

  const encodedMessage = encodeURIComponent(message);
  
  // Open WhatsApp with pre-filled message
  // If parent phone is provided, open chat with that number
  let whatsappUrl: string;
  if (parentPhone) {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = parentPhone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  } else {
    whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  }

  window.open(whatsappUrl, '_blank');
}
