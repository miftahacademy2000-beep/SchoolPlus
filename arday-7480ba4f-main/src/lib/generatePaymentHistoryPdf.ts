import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface PaymentEntry {
  amount: number;
  payment_method: string | null;
  created_at: string;
  recorder_name: string | null;
  notes: string | null;
}

interface PaymentHistoryPdfData {
  invoiceNumber: string;
  invoiceTitle: string;
  studentName: string;
  totalAmount: number;
  totalPaid: number;
  remaining: number;
  schoolName?: string;
  payments: PaymentEntry[];
}

export function generatePaymentHistoryPdf(data: PaymentHistoryPdfData): void {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  const primary: [number, number, number] = [59, 130, 246];
  const txt: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const green: [number, number, number] = [34, 197, 94];
  const red: [number, number, number] = [239, 68, 68];
  const lightBg: [number, number, number] = [249, 250, 251];
  const headerBg: [number, number, number] = [243, 244, 246];

  let y = 20;

  // Header
  doc.setTextColor(...primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName || 'Payment History', cx, y, { align: 'center' });

  y += 10;
  doc.setTextColor(...txt);
  doc.setFontSize(14);
  doc.text('Payment History Report', cx, y, { align: 'center' });

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, cx, y, { align: 'center' });

  // Divider
  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(20, y, pw - 20, y);

  // Invoice info
  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...txt);
  doc.text('Invoice Details', 20, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const info = [
    ['Invoice #', data.invoiceNumber],
    ['Title', data.invoiceTitle],
    ['Student', data.studentName],
    ['Total Amount', `$${data.totalAmount.toLocaleString()}`],
    ['Total Paid', `$${data.totalPaid.toLocaleString()}`],
    ['Remaining', `$${data.remaining.toLocaleString()}`],
  ];
  info.forEach(([label, value]) => {
    doc.setTextColor(...muted);
    doc.text(`${label}:`, 24, y);
    doc.setTextColor(...txt);
    if (label === 'Remaining' && data.remaining > 0) doc.setTextColor(...red);
    if (label === 'Remaining' && data.remaining <= 0) doc.setTextColor(...green);
    doc.text(value, 80, y);
    y += 6;
  });

  // Table header
  y += 8;
  const colX = [20, 55, 100, 140, 175];
  const colW = [35, 45, 40, 35, pw - 195];

  doc.setFillColor(...headerBg);
  doc.rect(20, y - 4, pw - 40, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...txt);
  const headers = ['#', 'Date & Time', 'Amount', 'Method', 'Recorded By'];
  headers.forEach((h, i) => doc.text(h, colX[i], y + 2));

  y += 12;

  // Table rows
  doc.setFont('helvetica', 'normal');
  data.payments.forEach((p, idx) => {
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(20, y - 4, pw - 40, 8, 'F');
    }

    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.text(`${idx + 1}`, colX[0], y);

    doc.setTextColor(...txt);
    doc.text(format(new Date(p.created_at), 'MMM d, yyyy h:mm a'), colX[1], y);

    doc.setTextColor(...green);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${p.amount.toLocaleString()}`, colX[2], y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...txt);
    doc.text(p.payment_method?.replace('_', ' ') || '—', colX[3], y);

    doc.setTextColor(...muted);
    doc.text(p.recorder_name || '—', colX[4], y);

    y += 8;
  });

  // Summary
  y += 6;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, y, pw - 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...txt);
  doc.text(`Total Payments: ${data.payments.length}`, 24, y);
  doc.text(`Total Paid: $${data.totalPaid.toLocaleString()}`, pw / 2, y);

  // Footer
  const fy = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice ${data.invoiceNumber} — Payment History Report`, cx, fy, { align: 'center' });

  doc.save(`payment-history-${data.invoiceNumber}.pdf`);
}
