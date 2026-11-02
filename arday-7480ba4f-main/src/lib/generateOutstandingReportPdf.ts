import jsPDF from 'jspdf';

export interface OutstandingStudent {
  name: string;
  enrollmentNumber: string | null;
  grade: string | null;
  className: string;
  amountDue: number;
  dueDate: string;
  status: 'pending' | 'overdue';
  invoiceNumber: string;
  title: string;
}

interface OutstandingReportData {
  students: OutstandingStudent[];
  schoolName?: string;
  totalOutstanding: number;
  overdueCount: number;
  pendingCount: number;
  generatedAt: string;
}

export function generateOutstandingReportPdf(data: OutstandingReportData): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const primary: [number, number, number] = [59, 130, 246];
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const red: [number, number, number] = [239, 68, 68];
  const amber: [number, number, number] = [234, 179, 8];
  const lightBg: [number, number, number] = [249, 250, 251];
  const classBg: [number, number, number] = [238, 242, 255];

  let y = 18;

  // Header
  doc.setTextColor(...primary);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName || 'School', centerX, y, { align: 'center' });

  y += 9;
  doc.setTextColor(...text);
  doc.setFontSize(14);
  doc.text('Outstanding Payments Report', centerX, y, { align: 'center' });

  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Generated: ${data.generatedAt}`, centerX, y, { align: 'center' });

  // Summary cards
  y += 12;
  const cardW = (pageWidth - 80) / 3;
  const cards = [
    { label: 'Total Outstanding', value: `$${data.totalOutstanding.toLocaleString()}`, color: text },
    { label: 'Overdue', value: `${data.overdueCount}`, color: red },
    { label: 'Pending', value: `${data.pendingCount}`, color: amber },
  ];
  cards.forEach((card, i) => {
    const x = 40 + i * cardW;
    doc.setFillColor(...lightBg);
    doc.roundedRect(x + 2, y, cardW - 4, 24, 2, 2, 'F');
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + cardW / 2, y + 9, { align: 'center' });
    doc.setTextColor(...card.color);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + cardW / 2, y + 20, { align: 'center' });
  });

  y += 34;

  // Group students by class
  const classMap = new Map<string, OutstandingStudent[]>();
  data.students.forEach((s) => {
    const list = classMap.get(s.className) || [];
    list.push(s);
    classMap.set(s.className, list);
  });
  const classGroups = Array.from(classMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const colX = [16, 30, 56, 102, 142, 182, 218, 252];
  const drawTableHeader = () => {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 7;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...text);
    doc.text('#', colX[0], y);
    doc.text('Student ID', colX[1], y);
    doc.text('Name', colX[2], y);
    doc.text('Invoice #', colX[3], y);
    doc.text('Title', colX[4], y);
    doc.text('Amount Due', colX[5], y);
    doc.text('Due Date', colX[6], y);
    doc.text('Status', colX[7], y);
    y += 3;
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  let globalIdx = 0;

  classGroups.forEach(([className, students]) => {
    checkPage(25);

    // Class header bar
    doc.setFillColor(...classBg);
    doc.roundedRect(14, y - 1, pageWidth - 28, 10, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.text(`📚 ${className}`, 18, y + 6);
    const classTotal = students.reduce((s, st) => s + st.amountDue, 0);
    const classOverdue = students.filter((s) => s.status === 'overdue').length;
    doc.setTextColor(...text);
    doc.setFontSize(8);
    doc.text(
      `${students.length} invoice${students.length !== 1 ? 's' : ''} · $${classTotal.toLocaleString()}${classOverdue > 0 ? ` · ${classOverdue} overdue` : ''}`,
      pageWidth - 18,
      y + 6,
      { align: 'right' }
    );
    y += 14;

    drawTableHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    students.forEach((student, i) => {
      checkPage(12);
      globalIdx++;

      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(14, y - 4, pageWidth - 28, 9, 'F');
      }

      doc.setTextColor(...text);
      doc.text(`${globalIdx}`, colX[0], y);
      doc.text(student.enrollmentNumber || '—', colX[1], y);
      doc.text(student.name.substring(0, 28), colX[2], y);
      doc.text(student.invoiceNumber, colX[3], y);
      doc.text(student.title.substring(0, 22), colX[4], y);
      doc.text(`$${student.amountDue.toLocaleString()}`, colX[5], y);
      doc.text(student.dueDate, colX[6], y);

      if (student.status === 'overdue') {
        doc.setTextColor(...red);
        doc.text('Overdue', colX[7], y);
      } else {
        doc.setTextColor(...amber);
        doc.text('Pending', colX[7], y);
      }

      y += 9;
    });

    // Class subtotal
    doc.setDrawColor(229, 231, 235);
    doc.line(14, y - 2, pageWidth - 14, y - 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...text);
    doc.text(`Subtotal: ${students.length} invoices`, colX[4], y + 3);
    doc.text(`$${classTotal.toLocaleString()}`, colX[5], y + 3);
    y += 12;
  });

  // Footer
  const footerY = pageHeight - 8;
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`Total: ${data.students.length} outstanding invoices across ${classGroups.length} class(es)`, centerX, footerY, { align: 'center' });

  doc.save(`outstanding-payments-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateOutstandingReportCsv(data: OutstandingReportData): void {
  const header = ['#', 'Class', 'Student ID', 'Name', 'Grade', 'Invoice #', 'Title', 'Amount Due', 'Due Date', 'Status'];

  // Sort by class then by original order
  const sorted = [...data.students].sort((a, b) => a.className.localeCompare(b.className));

  const rows = sorted.map((s, i) => [
    i + 1,
    s.className,
    s.enrollmentNumber || '',
    s.name,
    s.grade || '',
    s.invoiceNumber,
    s.title,
    s.amountDue,
    s.dueDate,
    s.status === 'overdue' ? 'Overdue' : 'Pending',
  ]);

  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `outstanding-payments-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
