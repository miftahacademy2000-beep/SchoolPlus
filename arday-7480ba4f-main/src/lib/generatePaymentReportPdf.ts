import jsPDF from 'jspdf';

interface PaymentReportData {
  period: string;
  type: 'monthly' | 'yearly';
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  totalInvoices: number;
  paidCount: number;
  collectionRate: number;
  schoolName?: string;
}

export function generatePaymentReportPdf(data: PaymentReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const primary: [number, number, number] = [59, 130, 246];
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const green: [number, number, number] = [34, 197, 94];
  const amber: [number, number, number] = [234, 179, 8];
  const red: [number, number, number] = [239, 68, 68];
  const lightBg: [number, number, number] = [249, 250, 251];

  let y = 20;

  // Header
  doc.setTextColor(...primary);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName || 'School', centerX, y, { align: 'center' });

  y += 12;
  doc.setTextColor(...text);
  doc.setFontSize(16);
  doc.text(`${data.type === 'monthly' ? 'Monthly' : 'Yearly'} Payment Report`, centerX, y, { align: 'center' });

  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Period: ${data.period}`, centerX, y, { align: 'center' });

  // Divider
  y += 12;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(30, y, pageWidth - 30, y);

  // Collection Rate
  y += 18;
  doc.setTextColor(...text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Collection Rate', centerX, y, { align: 'center' });

  y += 12;
  // Progress bar background
  const barX = 40;
  const barW = pageWidth - 80;
  const barH = 12;
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(barX, y, barW, barH, 3, 3, 'F');

  // Progress bar fill
  const fillW = (data.collectionRate / 100) * barW;
  if (fillW > 0) {
    doc.setFillColor(...green);
    doc.roundedRect(barX, y, Math.max(fillW, 6), barH, 3, 3, 'F');
  }

  // Percentage text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (data.collectionRate > 15) {
    doc.text(`${data.collectionRate.toFixed(1)}%`, barX + fillW / 2, y + barH / 2 + 3, { align: 'center' });
  } else {
    doc.setTextColor(...text);
    doc.text(`${data.collectionRate.toFixed(1)}%`, barX + fillW + 8, y + barH / 2 + 3);
  }

  // Summary cards
  y += 28;
  const colW = (pageWidth - 80) / 4;
  const cols = [
    { label: 'Total', value: data.totalAmount, color: text, count: `${data.totalInvoices} invoices` },
    { label: 'Paid', value: data.paidAmount, color: green, count: `${data.paidCount} paid` },
    { label: 'Pending', value: data.pendingAmount, color: amber, count: '' },
    { label: 'Overdue', value: data.overdueAmount, color: red, count: '' },
  ];

  cols.forEach((col, i) => {
    const x = 40 + i * colW;
    doc.setFillColor(...lightBg);
    doc.roundedRect(x + 2, y, colW - 4, 40, 2, 2, 'F');

    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(col.label, x + colW / 2, y + 12, { align: 'center' });

    doc.setTextColor(...col.color);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${col.value.toLocaleString()}`, x + colW / 2, y + 26, { align: 'center' });

    if (col.count) {
      doc.setTextColor(...muted);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(col.count, x + colW / 2, y + 34, { align: 'center' });
    }
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    centerX,
    footerY,
    { align: 'center' }
  );

  const filename = `payment-report-${data.type}-${data.period.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(filename);
}
