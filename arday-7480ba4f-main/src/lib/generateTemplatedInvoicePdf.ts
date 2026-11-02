import jsPDF from 'jspdf';
import { InvoiceTemplateLayout, TemplateBlock, TemplateStyles, DEFAULT_BLOCKS, DEFAULT_STYLES } from '@/types/invoiceTemplate';

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

// Convert HSL string to RGB for jsPDF
function hslToRgb(hslString: string): [number, number, number] {
  // Parse "217 91% 60%" format
  const parts = hslString.split(' ').map(p => parseFloat(p.replace('%', '')));
  if (parts.length !== 3) return [0, 0, 0];
  
  const h = parts[0] / 360;
  const s = parts[1] / 100;
  const l = parts[2] / 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Map font family to jsPDF font
function getFontFamily(fontFamily: TemplateStyles['fontFamily']): string {
  // jsPDF only supports helvetica, times, courier by default
  switch (fontFamily) {
    case 'playfair':
      return 'times';
    default:
      return 'helvetica';
  }
}

// Map font size to points
function getFontSize(fontSize: TemplateBlock['fontSize']): number {
  switch (fontSize) {
    case 'sm': return 9;
    case 'md': return 11;
    case 'lg': return 14;
    case 'xl': return 18;
    case '2xl': return 24;
    default: return 11;
  }
}

// Map border radius to corner radius in PDF
function getBorderRadius(borderRadius: TemplateStyles['borderRadius']): number {
  switch (borderRadius) {
    case 'none': return 0;
    case 'sm': return 2;
    case 'md': return 4;
    case 'lg': return 8;
    default: return 4;
  }
}

export async function generateTemplatedInvoicePdf(
  invoice: InvoiceData,
  template?: InvoiceTemplateLayout | null
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Use template or defaults
  const blocks = template?.blocks ?? DEFAULT_BLOCKS;
  const styles = template?.styles ?? DEFAULT_STYLES;
  
  // Convert HSL colors to RGB
  const primaryColor = hslToRgb(styles.primaryColor);
  const textColor = hslToRgb(styles.textColor);
  const mutedColor = hslToRgb(styles.mutedColor);
  const secondaryBg = hslToRgb(styles.secondaryColor);
  
  const fontFamily = getFontFamily(styles.fontFamily);
  const cornerRadius = getBorderRadius(styles.borderRadius);
  
  // Scale factor: canvas is ~600px tall, PDF is ~297mm (A4) but we use ~250mm usable
  const scaleY = 0.4; // pixels to mm
  const scaleX = pageWidth / 100; // percentage to mm

  // Helper to get X position based on alignment and width
  const getXPosition = (block: TemplateBlock, contentWidth: number): number => {
    const blockLeft = block.x * scaleX;
    const blockWidth = block.width * scaleX;
    
    switch (block.textAlign) {
      case 'center':
        return blockLeft + (blockWidth / 2);
      case 'right':
        return blockLeft + blockWidth;
      default:
        return blockLeft;
    }
  };

  const getTextAlign = (block: TemplateBlock): 'left' | 'center' | 'right' => block.textAlign;

  // Sort blocks by Y position
  const sortedBlocks = [...blocks].sort((a, b) => a.y - b.y);

  for (const block of sortedBlocks) {
    const yPos = 15 + (block.y * scaleY);
    const fontSize = getFontSize(block.fontSize);
    doc.setFont(fontFamily);
    doc.setFontSize(fontSize);

    switch (block.type) {
      case 'logo':
        if (invoice.school?.logo_url) {
          try {
            const logoData = await loadImageAsBase64(invoice.school.logo_url);
            if (logoData) {
              const logoSize = 25;
              const xPos = block.x * scaleX + ((block.width * scaleX - logoSize) / 2);
              doc.addImage(logoData, 'PNG', xPos, yPos, logoSize, logoSize);
            }
          } catch (error) {
            console.warn('Failed to load logo:', error);
          }
        }
        break;

      case 'school_name':
        doc.setTextColor(...primaryColor);
        doc.setFont(fontFamily, 'bold');
        doc.text(
          invoice.school?.name || 'School Name',
          getXPosition(block, 0),
          yPos,
          { align: getTextAlign(block) }
        );
        break;

      case 'school_contact':
        doc.setTextColor(...mutedColor);
        doc.setFont(fontFamily, 'normal');
        let contactY = yPos;
        const lineHeight = fontSize * 0.5;
        
        if (invoice.school?.address) {
          doc.text(invoice.school.address, getXPosition(block, 0), contactY, { align: getTextAlign(block) });
          contactY += lineHeight;
        }
        if (invoice.school?.phone) {
          doc.text(`Tel: ${invoice.school.phone}`, getXPosition(block, 0), contactY, { align: getTextAlign(block) });
          contactY += lineHeight;
        }
        if (invoice.school?.email) {
          doc.text(invoice.school.email, getXPosition(block, 0), contactY, { align: getTextAlign(block) });
        }
        break;

      case 'student_info':
        const studentBoxX = block.x * scaleX;
        const studentBoxWidth = block.width * scaleX;
        const studentBoxHeight = 25;
        
        // Background
        doc.setFillColor(...secondaryBg);
        doc.roundedRect(studentBoxX, yPos - 5, studentBoxWidth, studentBoxHeight, cornerRadius, cornerRadius, 'F');
        
        // Content
        doc.setTextColor(...textColor);
        doc.setFont(fontFamily, 'bold');
        doc.text('Bill To:', studentBoxX + 5, yPos + 2);
        
        doc.setFont(fontFamily, 'normal');
        doc.text(invoice.student?.profile?.full_name || 'Student Name', studentBoxX + 5, yPos + 8);
        
        doc.setTextColor(...mutedColor);
        doc.setFontSize(fontSize - 1);
        let nextY = yPos + 14;
        if (invoice.student?.enrollment_number) {
          doc.text(`Student ID: ${invoice.student.enrollment_number}`, studentBoxX + 5, nextY);
          nextY += 6;
        }
        if (invoice.student?.class_name) {
          const classText = invoice.student.section
            ? `Class: ${invoice.student.class_name} (${invoice.student.section})`
            : `Class: ${invoice.student.class_name}`;
          doc.text(classText, studentBoxX + 5, nextY);
          nextY += 6;
        }
        if (invoice.student?.grade) {
          doc.text(`Grade: ${invoice.student.grade}`, studentBoxX + 5, nextY);
        }
        break;

      case 'invoice_details':
        const detailsBoxX = block.x * scaleX;
        const detailsBoxWidth = block.width * scaleX;
        const detailsBoxHeight = 45;
        
        // Background
        doc.setFillColor(...secondaryBg);
        doc.roundedRect(detailsBoxX, yPos - 5, detailsBoxWidth, detailsBoxHeight, cornerRadius, cornerRadius, 'F');
        
        // Title
        doc.setTextColor(...textColor);
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(fontSize);
        doc.text('Invoice Details:', detailsBoxX + 5, yPos + 2);
        
        // Invoice number
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(fontSize - 1);
        doc.setTextColor(...mutedColor);
        doc.text('Invoice #:', detailsBoxX + 5, yPos + 10);
        doc.setTextColor(...textColor);
        doc.text(invoice.invoice_number, detailsBoxX + 35, yPos + 10);
        
        // Title
        doc.setTextColor(...mutedColor);
        doc.text('Title:', detailsBoxX + 5, yPos + 16);
        doc.setTextColor(...textColor);
        doc.text(invoice.title, detailsBoxX + 35, yPos + 16);
        
        // Due Date
        doc.setTextColor(...mutedColor);
        doc.text('Due Date:', detailsBoxX + 5, yPos + 22);
        doc.setTextColor(...textColor);
        doc.text(formatDate(invoice.due_date), detailsBoxX + 35, yPos + 22);
        
        // Status
        doc.setTextColor(...mutedColor);
        doc.text('Status:', detailsBoxX + 5, yPos + 28);
        
        if (invoice.status === 'paid') {
          doc.setTextColor(34, 197, 94);
        } else if (invoice.status === 'overdue') {
          doc.setTextColor(239, 68, 68);
        } else if (invoice.status === 'pending') {
          doc.setTextColor(234, 179, 8);
        } else {
          doc.setTextColor(...mutedColor);
        }
        doc.setFont(fontFamily, 'bold');
        doc.text(invoice.status.toUpperCase(), detailsBoxX + 35, yPos + 28);
        
        // Paid date if applicable
        if (invoice.paid_date) {
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...mutedColor);
          doc.text('Paid Date:', detailsBoxX + 5, yPos + 34);
          doc.setTextColor(34, 197, 94);
          doc.text(formatDate(invoice.paid_date), detailsBoxX + 35, yPos + 34);
        }
        break;

      case 'amount':
        doc.setTextColor(...textColor);
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(fontSize);
        doc.text('Amount Due:', getXPosition(block, 0), yPos, { align: getTextAlign(block) });
        
        doc.setTextColor(...primaryColor);
        doc.setFontSize(fontSize + 10);
        doc.text(
          `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          getXPosition(block, 0),
          yPos + 10,
          { align: getTextAlign(block) }
        );
        break;

      case 'footer':
        doc.setTextColor(...mutedColor);
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(fontSize);
        doc.text('Thank you!', getXPosition(block, 0), yPos, { align: getTextAlign(block) });
        doc.setFontSize(fontSize - 2);
        doc.text(
          'Please retain this invoice for your records.',
          getXPosition(block, 0),
          yPos + 6,
          { align: getTextAlign(block) }
        );
        break;
    }
  }

  // Footer timestamp
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text(
    `Generated: ${formatDateTime(new Date().toISOString())}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

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
