import jsPDF from 'jspdf';

interface InvoiceData {
  invoice_number: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  student?: {
    grade: string | null;
    enrollment_number: string | null;
    class_name: string | null;
    section: string | null;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  school?: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logo_url: string | null;
  } | null;
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const mutedColor: [number, number, number] = [107, 114, 128]; // Gray
  const lightBg: [number, number, number] = [249, 250, 251]; // Light gray bg
  
  let yPos = 20;
  
  // ========== LOGO (if exists) ==========
  if (invoice.school?.logo_url) {
    try {
      const logoData = await loadImageAsBase64(invoice.school.logo_url);
      if (logoData) {
        const logoSize = 30;
        doc.addImage(logoData, 'PNG', centerX - logoSize / 2, yPos, logoSize, logoSize);
        yPos += logoSize + 8;
      }
    } catch (error) {
      console.warn('Failed to load logo:', error);
      yPos += 5;
    }
  } else {
    yPos += 5;
  }
  
  // ========== SCHOOL HEADER ==========
  doc.setTextColor(...primaryColor);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.school?.name || 'School Name', centerX, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setTextColor(...mutedColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (invoice.school?.address) {
    doc.text(invoice.school.address, centerX, yPos, { align: 'center' });
    yPos += 5;
  }
  
  if (invoice.school?.phone) {
    doc.text(`Tel: ${invoice.school.phone}`, centerX, yPos, { align: 'center' });
    yPos += 5;
  }
  
  if (invoice.school?.email) {
    doc.text(invoice.school.email, centerX, yPos, { align: 'center' });
    yPos += 5;
  }
  
  // ========== DIVIDER LINE ==========
  yPos += 8;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(30, yPos, pageWidth - 30, yPos);
  
  // ========== INVOICE TITLE ==========
  yPos += 15;
  doc.setTextColor(...textColor);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', centerX, yPos, { align: 'center' });
  
  // Invoice number and date
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text(`Invoice No: ${invoice.invoice_number}`, centerX, yPos, { align: 'center' });
  
  yPos += 6;
  doc.text(`Date: ${formatDate(invoice.created_at)}`, centerX, yPos, { align: 'center' });
  
  // ========== DIVIDER LINE ==========
  yPos += 10;
  doc.line(30, yPos, pageWidth - 30, yPos);
  
  // ========== BILL TO SECTION ==========
  yPos += 12;
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', centerX, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(14);
  doc.text(invoice.student?.profile?.full_name || 'Student Name', centerX, yPos, { align: 'center' });

  if (invoice.student?.enrollment_number) {
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Student ID: ${invoice.student.enrollment_number}`, centerX, yPos, { align: 'center' });
  }

  if (invoice.student?.class_name) {
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const classText = invoice.student.section 
      ? `Class: ${invoice.student.class_name} (${invoice.student.section})`
      : `Class: ${invoice.student.class_name}`;
    doc.text(classText, centerX, yPos, { align: 'center' });
  }

  if (invoice.student?.grade) {
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Grade: ${invoice.student.grade}`, centerX, yPos, { align: 'center' });
  }
  
  // ========== DIVIDER LINE ==========
  yPos += 12;
  doc.setDrawColor(229, 231, 235);
  doc.line(30, yPos, pageWidth - 30, yPos);
  
  // ========== INVOICE DETAILS SECTION ==========
  yPos += 12;
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', centerX, yPos, { align: 'center' });
  
  // Details box
  yPos += 10;
  const boxX = 40;
  const boxWidth = pageWidth - 80;
  const boxHeight = 50 + (invoice.description ? 10 : 0);
  
  doc.setFillColor(...lightBg);
  doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 3, 3, 'F');
  
  yPos += 12;
  const labelX = 50;
  const valueX = 110;
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Title:', labelX, yPos);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.title, valueX, yPos);
  
  // Description (if exists)
  if (invoice.description) {
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Description:', labelX, yPos);
    doc.setTextColor(...textColor);
    const descLines = doc.splitTextToSize(invoice.description, boxWidth - 80);
    doc.text(descLines, valueX, yPos);
    yPos += descLines.length * 4;
  }
  
  // Due Date
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Due Date:', labelX, yPos);
  doc.setTextColor(...textColor);
  doc.text(formatDate(invoice.due_date), valueX, yPos);
  
  // Status
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Status:', labelX, yPos);
  
  // Status color
  if (invoice.status === 'paid') {
    doc.setTextColor(34, 197, 94); // Green
  } else if (invoice.status === 'overdue') {
    doc.setTextColor(239, 68, 68); // Red
  } else if (invoice.status === 'pending') {
    doc.setTextColor(234, 179, 8); // Yellow/Orange
  } else {
    doc.setTextColor(...mutedColor);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), valueX, yPos);
  
  // Paid date (if applicable)
  if (invoice.paid_date) {
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Paid Date:', labelX, yPos);
    doc.setTextColor(34, 197, 94);
    doc.text(formatDate(invoice.paid_date), valueX, yPos);
  }
  
  // ========== DIVIDER LINE ==========
  yPos += 20;
  doc.setDrawColor(229, 231, 235);
  doc.line(30, yPos, pageWidth - 30, yPos);
  
  // ========== AMOUNT SECTION ==========
  yPos += 15;
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT DUE:', centerX, yPos, { align: 'center' });
  
  yPos += 12;
  doc.setFontSize(28);
  doc.setTextColor(...primaryColor);
  doc.text(`$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, centerX, yPos, { align: 'center' });
  
  // ========== DIVIDER LINE ==========
  yPos += 15;
  doc.setDrawColor(229, 231, 235);
  doc.line(30, yPos, pageWidth - 30, yPos);
  
  // ========== THANK YOU MESSAGE ==========
  yPos += 15;
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you!', centerX, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Please retain this invoice for your records.', centerX, yPos, { align: 'center' });
  
  // ========== FOOTER ==========
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, centerX, footerY, { align: 'center' });
  
  // Save the PDF
  doc.save(`${invoice.invoice_number}.pdf`);
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch {
        resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = url;
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
