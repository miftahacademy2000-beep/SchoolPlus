import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type {
  WeeklyTrend,
  MonthlyTrend,
  ClassAttendanceSummary,
  DayOfWeekPattern,
} from '@/hooks/useAttendanceAnalytics';

interface AnalyticsData {
  overallRate: number;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  trends: (WeeklyTrend | MonthlyTrend)[];
  classSummaries: ClassAttendanceSummary[];
  dayOfWeekPatterns?: DayOfWeekPattern[];
}

interface ExportOptions {
  schoolName?: string;
  trendView: 'weekly' | 'monthly';
}

const COLORS = {
  primary: [37, 99, 235] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  destructive: [239, 68, 68] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [15, 23, 42] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

function drawColorBox(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 8, 5, 1, 1, 'F');
}

export function exportAttendanceAnalyticsPdf(data: AnalyticsData, options: ExportOptions) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  let y = 14;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage();
      y = 14;
    }
  };

  // --- Title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('Attendance Analytics Report', marginL, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const subtitle = [
    options.schoolName && `School: ${options.schoolName}`,
    `Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
    `View: ${options.trendView === 'weekly' ? 'Weekly (12 weeks)' : 'Monthly (6 months)'}`,
  ].filter(Boolean).join('  •  ');
  doc.text(subtitle, marginL, y);
  y += 8;

  // Divider
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // --- Summary Cards ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text('Summary', marginL, y);
  y += 6;

  const stats = [
    { label: 'Overall Rate', value: `${data.overallRate}%`, color: data.overallRate >= 90 ? COLORS.success : data.overallRate >= 75 ? COLORS.warning : COLORS.destructive },
    { label: 'Total Records', value: data.totalRecords.toLocaleString(), color: COLORS.black },
    { label: 'Present', value: data.totalPresent.toLocaleString(), color: COLORS.success },
    { label: 'Absent', value: data.totalAbsent.toLocaleString(), color: COLORS.destructive },
    { label: 'Late', value: data.totalLate.toLocaleString(), color: COLORS.warning },
    { label: 'Excused', value: data.totalExcused.toLocaleString(), color: COLORS.muted },
  ];

  const cardW = (contentW - 10) / 3;
  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = marginL + col * (cardW + 5);
    const cy = y + row * 16;

    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, cy, cardW, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(stat.label, cx + 4, cy + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...(stat.color as [number, number, number]));
    doc.text(stat.value, cx + 4, cy + 11);
  });
  y += 36;

  // --- Trend Table ---
  checkPage(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text(`Attendance Rate Trend (${options.trendView === 'weekly' ? 'Weekly' : 'Monthly'})`, marginL, y);
  y += 6;

  if (data.trends.length > 0) {
    const trendCols = ['Period', 'Present', 'Late', 'Absent', 'Excused', 'Total', 'Rate'];
    const colWidths = [30, 22, 18, 22, 22, 20, 18];

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(marginL, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    let hx = marginL + 2;
    trendCols.forEach((col, i) => {
      doc.text(col, hx, y + 5);
      hx += colWidths[i];
    });
    y += 7;

    // Rows
    data.trends.forEach((trend, ri) => {
      checkPage(7);
      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.headerBg);
        doc.rect(marginL, y, contentW, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.black);
      let rx = marginL + 2;
      const vals = [trend.label, `${trend.present}`, `${trend.late}`, `${trend.absent}`, `${trend.excused}`, `${trend.total}`, `${trend.rate}%`];
      vals.forEach((v, i) => {
        if (i === 6) {
          const rate = trend.rate;
          doc.setTextColor(...(rate >= 90 ? COLORS.success : rate >= 75 ? COLORS.warning : COLORS.destructive));
          doc.setFont('helvetica', 'bold');
        }
        doc.text(v, rx, y + 4);
        rx += colWidths[i];
      });
      doc.setTextColor(...COLORS.black);
      doc.setFont('helvetica', 'normal');
      y += 6;
    });
    y += 6;
  }

  // --- Day-of-Week Patterns ---
  if (data.dayOfWeekPatterns && data.dayOfWeekPatterns.length > 0) {
    checkPage(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.black);
    doc.text('Day-of-Week Attendance Patterns', marginL, y);
    y += 6;

    const barMaxW = contentW - 50;
    const barH = 7;
    data.dayOfWeekPatterns.forEach((d) => {
      checkPage(10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.black);
      doc.text(d.label, marginL, y + 5);

      // Bar background
      doc.setFillColor(...COLORS.headerBg);
      doc.roundedRect(marginL + 20, y + 1, barMaxW, barH, 1, 1, 'F');

      // Bar fill
      const fillW = (d.rate / 100) * barMaxW;
      const barColor = d.rate >= 90 ? COLORS.success : d.rate >= 75 ? COLORS.warning : COLORS.destructive;
      doc.setFillColor(...barColor);
      if (fillW > 0) doc.roundedRect(marginL + 20, y + 1, fillW, barH, 1, 1, 'F');

      // Rate text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...barColor);
      doc.text(`${d.rate}%`, marginL + 22 + barMaxW, y + 5.5);

      y += 10;
    });

    // Lowest / Highest
    const lowest = data.dayOfWeekPatterns.reduce((min, d) => d.rate < min.rate ? d : min, data.dayOfWeekPatterns[0]);
    const highest = data.dayOfWeekPatterns.reduce((max, d) => d.rate > max.rate ? d : max, data.dayOfWeekPatterns[0]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.destructive);
    doc.text(`Lowest: ${lowest.label} (${lowest.rate}%)`, marginL, y + 2);
    doc.setTextColor(...COLORS.success);
    doc.text(`Highest: ${highest.label} (${highest.rate}%)`, marginL + 60, y + 2);
    y += 10;
  }

  // --- Class Comparison ---
  if (data.classSummaries.length > 0) {
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.black);
    doc.text('Class Attendance Comparison', marginL, y);
    y += 6;

    const classCols = ['#', 'Class', 'Records', 'Present', 'Absent', 'Rate'];
    const classColW = [10, 55, 22, 22, 22, 20];

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(marginL, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    let chx = marginL + 2;
    classCols.forEach((col, i) => {
      doc.text(col, chx, y + 5);
      chx += classColW[i];
    });
    y += 7;

    // Rows
    data.classSummaries.forEach((cls, ri) => {
      checkPage(7);
      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.headerBg);
        doc.rect(marginL, y, contentW, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.black);

      let crx = marginL + 2;
      const className = [cls.class_name, cls.grade && `- ${cls.grade}`, cls.section && `(${cls.section})`].filter(Boolean).join(' ');
      const vals = [`${ri + 1}`, className, `${cls.total_records}`, `${cls.present}`, `${cls.absent}`, `${cls.rate}%`];
      vals.forEach((v, i) => {
        if (i === 5) {
          doc.setTextColor(...(cls.rate >= 90 ? COLORS.success : cls.rate >= 75 ? COLORS.warning : COLORS.destructive));
          doc.setFont('helvetica', 'bold');
        }
        doc.text(v, crx, y + 4);
        crx += classColW[i];
      });
      doc.setTextColor(...COLORS.black);
      doc.setFont('helvetica', 'normal');
      y += 6;
    });
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginR, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(`attendance-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
