import jsPDF from 'jspdf';

export interface ClassStudentBalance {
  name: string;
  enrollmentNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  unpaidCount: number;
}

interface ClassExportData {
  className: string;
  students: ClassStudentBalance[];
  periodLabel: string;
  schoolName?: string;
}

function getSummary(students: ClassStudentBalance[]) {
  const totalFees = students.reduce((s, b) => s + b.totalAmount, 0);
  const totalPaid = students.reduce((s, b) => s + b.paidAmount, 0);
  const totalUnpaid = students.reduce((s, b) => s + b.outstanding, 0);
  return { totalFees, totalPaid, totalUnpaid };
}

export function exportClassPaymentsPdf(data: ClassExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const primary: [number, number, number] = [59, 130, 246];
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const green: [number, number, number] = [34, 197, 94];
  const red: [number, number, number] = [239, 68, 68];
  const lightBg: [number, number, number] = [249, 250, 251];

  const { totalFees, totalPaid, totalUnpaid } = getSummary(data.students);
  let y = 18;

  // Header
  if (data.schoolName) {
    doc.setTextColor(...primary);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.schoolName, centerX, y, { align: 'center' });
    y += 8;
  }

  doc.setTextColor(...text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.className} - Payment Report`, centerX, y, { align: 'center' });
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Period: ${data.periodLabel}  |  Generated: ${new Date().toLocaleDateString()}`, centerX, y, { align: 'center' });
  y += 12;

  // Summary cards
  const cardW = (pageWidth - 40) / 3;
  const cards = [
    { label: 'Total Fees', value: `$${totalFees.toLocaleString()}`, color: text },
    { label: 'Total Paid', value: `$${totalPaid.toLocaleString()}`, color: green },
    { label: 'Total Unpaid', value: `$${totalUnpaid.toLocaleString()}`, color: red },
  ];
  cards.forEach((card, i) => {
    const x = 20 + i * cardW;
    doc.setFillColor(...lightBg);
    doc.roundedRect(x + 2, y, cardW - 4, 22, 2, 2, 'F');
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + cardW / 2, y + 8, { align: 'center' });
    doc.setTextColor(...card.color);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + cardW / 2, y + 18, { align: 'center' });
  });
  y += 32;

  // Table header
  const colX = [16, 28, 58, 108, 140, 168];
  const drawHeader = () => {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...text);
    doc.text('#', colX[0], y);
    doc.text('Student ID', colX[1], y);
    doc.text('Student Name', colX[2], y);
    doc.text('Total Fee', colX[3], y);
    doc.text('Paid', colX[4], y);
    doc.text('Unpaid', colX[5], y);
    y += 3;
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
  };

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  data.students.forEach((student, i) => {
    if (y + 10 > pageHeight - 20) {
      doc.addPage();
      y = 18;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, y - 4, pageWidth - 28, 9, 'F');
    }

    doc.setTextColor(...text);
    doc.text(`${i + 1}`, colX[0], y);
    doc.text(student.enrollmentNumber || '-', colX[1], y);
    doc.text(student.name.substring(0, 30), colX[2], y);
    doc.text(`$${student.totalAmount.toLocaleString()}`, colX[3], y);

    doc.setTextColor(...green);
    doc.text(`$${student.paidAmount.toLocaleString()}`, colX[4], y);

    if (student.outstanding > 0) {
      doc.setTextColor(...red);
      doc.text(`$${student.outstanding.toLocaleString()}`, colX[5], y);
    } else {
      doc.setTextColor(...green);
      doc.text('$0', colX[5], y);
    }

    y += 9;
  });

  // Totals row
  doc.setDrawColor(229, 231, 235);
  doc.line(14, y - 2, pageWidth - 14, y - 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...text);
  doc.text(`Total (${data.students.length} students)`, colX[2], y + 4);
  doc.text(`$${totalFees.toLocaleString()}`, colX[3], y + 4);
  doc.setTextColor(...green);
  doc.text(`$${totalPaid.toLocaleString()}`, colX[4], y + 4);
  doc.setTextColor(...red);
  doc.text(`$${totalUnpaid.toLocaleString()}`, colX[5], y + 4);

  // Footer
  const footerY = pageHeight - 8;
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`${data.className} Payment Report - ${data.periodLabel}`, centerX, footerY, { align: 'center' });

  const safeName = data.className.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${safeName}-payments-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportClassPaymentsCsv(data: ClassExportData): void {
  const { totalFees, totalPaid, totalUnpaid } = getSummary(data.students);
  const header = ['#', 'Student ID', 'Student Name', 'Total Fee', 'Paid', 'Unpaid', 'Unpaid Count'];
  const rows = data.students.map((s, i) => [
    i + 1,
    s.enrollmentNumber || '',
    s.name,
    s.totalAmount,
    s.paidAmount,
    s.outstanding,
    s.unpaidCount,
  ]);

  // Add summary row
  rows.push(['', '', 'TOTAL', totalFees, totalPaid, totalUnpaid, ''] as any);

  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = data.className.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `${safeName}-payments-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printClassPayments(data: ClassExportData): void {
  const { totalFees, totalPaid, totalUnpaid } = getSummary(data.students);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const rows = data.students.map((s, i) => `
    <tr style="${i % 2 === 0 ? 'background:#f9fafb;' : ''}">
      <td>${i + 1}</td>
      <td>${s.enrollmentNumber || '-'}</td>
      <td>${s.name}</td>
      <td>$${s.totalAmount.toLocaleString()}</td>
      <td style="color:#16a34a">$${s.paidAmount.toLocaleString()}</td>
      <td style="color:${s.outstanding > 0 ? '#dc2626' : '#16a34a'}">$${s.outstanding.toLocaleString()}</td>
    </tr>
  `).join('');

  printWindow.document.write(`<!DOCTYPE html><html><head><title>${data.className} - Payments</title>
    <style>
      body{font-family:Arial,sans-serif;margin:20px;color:#1f2937}
      h1{font-size:18px;margin:0}
      h2{font-size:14px;color:#6b7280;margin:4px 0 16px}
      .summary{display:flex;gap:16px;margin-bottom:20px}
      .card{background:#f3f4f6;padding:12px 20px;border-radius:8px;text-align:center;flex:1}
      .card .label{font-size:11px;color:#6b7280}
      .card .value{font-size:18px;font-weight:bold;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f3f4f6;padding:8px;text-align:left;font-size:11px;border-bottom:2px solid #e5e7eb}
      td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
      .total-row{font-weight:bold;background:#f3f4f6}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h1>${data.className} - Payment Report</h1>
    <h2>Period: ${data.periodLabel} | Generated: ${new Date().toLocaleDateString()}</h2>
    <div class="summary">
      <div class="card"><div class="label">Total Fees</div><div class="value">$${totalFees.toLocaleString()}</div></div>
      <div class="card"><div class="label">Paid</div><div class="value" style="color:#16a34a">$${totalPaid.toLocaleString()}</div></div>
      <div class="card"><div class="label">Unpaid</div><div class="value" style="color:#dc2626">$${totalUnpaid.toLocaleString()}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Total Fee</th><th>Paid</th><th>Unpaid</th></tr></thead>
      <tbody>${rows}
        <tr class="total-row">
          <td colspan="3">Total (${data.students.length} students)</td>
          <td>$${totalFees.toLocaleString()}</td>
          <td style="color:#16a34a">$${totalPaid.toLocaleString()}</td>
          <td style="color:#dc2626">$${totalUnpaid.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  printWindow.document.close();
}
