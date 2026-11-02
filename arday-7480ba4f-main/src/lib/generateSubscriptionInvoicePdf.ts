import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface SubscriptionPaymentData {
  invoice_number: string;
  plan: string;
  amount: number;
  billing_period_start: string;
  billing_period_end: string;
  status: string;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  school?: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
}

const planFeatures: Record<string, string[]> = {
  free: ['Up to 50 students', 'Basic attendance tracking', 'Email support'],
  pro: ['Up to 500 students', 'Advanced analytics', 'Invoice templates', 'Priority support', 'Learning materials'],
  enterprise: ['Unlimited students', 'Custom branding', 'API access', 'Dedicated support', 'Audit logs', 'Multi-campus'],
};

export function generateSubscriptionInvoicePdf(payment: SubscriptionPaymentData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const primary: [number, number, number] = [59, 130, 246];
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const lightBg: [number, number, number] = [249, 250, 251];

  let y = 20;

  // Platform header
  doc.setTextColor(...primary);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('EduFlow', centerX, y, { align: 'center' });
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text('School Management Platform', centerX, y, { align: 'center' });

  // Divider
  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(30, y, pageWidth - 30, y);

  // SUBSCRIPTION INVOICE title
  y += 14;
  doc.setTextColor(...text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBSCRIPTION INVOICE', centerX, y, { align: 'center' });

  y += 9;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Invoice No: ${payment.invoice_number}`, centerX, y, { align: 'center' });
  y += 6;
  doc.text(`Date: ${format(new Date(payment.created_at), 'MMM dd, yyyy')}`, centerX, y, { align: 'center' });

  // Divider
  y += 10;
  doc.line(30, y, pageWidth - 30, y);

  // BILL TO
  y += 12;
  doc.setTextColor(...text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 30, y);

  y += 8;
  doc.setFontSize(14);
  doc.text(payment.school?.name || 'School', 30, y);

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  if (payment.school?.address) { doc.text(payment.school.address, 30, y); y += 5; }
  if (payment.school?.email) { doc.text(payment.school.email, 30, y); y += 5; }
  if (payment.school?.phone) { doc.text(`Tel: ${payment.school.phone}`, 30, y); y += 5; }

  // Divider
  y += 8;
  doc.line(30, y, pageWidth - 30, y);

  // Subscription details box
  y += 10;
  doc.setTextColor(...text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBSCRIPTION DETAILS', 30, y);

  y += 8;
  const boxX = 30;
  const boxW = pageWidth - 60;
  const features = planFeatures[payment.plan] || planFeatures.free;
  const boxH = 58 + features.length * 6;

  doc.setFillColor(...lightBg);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F');

  y += 12;
  const lx = 40;
  const vx = 100;

  const row = (label: string, value: string, bold = false) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.text(label, lx, y);
    doc.setTextColor(...text);
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(value, vx, y);
    y += 8;
  };

  row('Plan:', payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1), true);
  row('Billing Period:', `${format(new Date(payment.billing_period_start), 'MMM dd, yyyy')} — ${format(new Date(payment.billing_period_end), 'MMM dd, yyyy')}`);
  row('Status:', payment.status.toUpperCase(), true);
  if (payment.payment_method) row('Payment Method:', payment.payment_method);
  if (payment.paid_date) row('Paid Date:', format(new Date(payment.paid_date), 'MMM dd, yyyy'));

  // Plan features
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...muted);
  doc.text('Plan includes:', lx, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  features.forEach((f) => {
    doc.text(`• ${f}`, lx + 4, y);
    y += 6;
  });

  // Divider
  y += 8;
  doc.setDrawColor(229, 231, 235);
  doc.line(30, y, pageWidth - 30, y);

  // Amount
  y += 14;
  doc.setTextColor(...text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT:', centerX, y, { align: 'center' });

  y += 12;
  doc.setFontSize(28);
  doc.setTextColor(...primary);
  doc.text(`$${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, centerX, y, { align: 'center' });

  if (payment.notes) {
    y += 14;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.text(`Notes: ${payment.notes}`, centerX, y, { align: 'center' });
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`, centerX, footerY, { align: 'center' });

  doc.save(`${payment.invoice_number}.pdf`);
}
