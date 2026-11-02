// Invoice Template Types

export type BlockType = 
  | 'logo' 
  | 'school_name' 
  | 'school_contact' 
  | 'student_info' 
  | 'invoice_details' 
  | 'amount' 
  | 'footer';

export interface TemplateBlock {
  id: string;
  type: BlockType;
  label: string;
  x: number; // percentage 0-100
  y: number; // pixels from top
  width: number; // percentage 0-100
  textAlign: 'left' | 'center' | 'right';
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export interface TemplateStyles {
  primaryColor: string; // HSL value
  secondaryColor: string;
  textColor: string;
  mutedColor: string;
  backgroundColor: string;
  fontFamily: 'inter' | 'roboto' | 'poppins' | 'playfair' | 'montserrat';
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  borderWidth: 'none' | 'thin' | 'medium' | 'thick';
  shadow: 'none' | 'sm' | 'md' | 'lg';
}

export interface InvoiceTemplateLayout {
  blocks: TemplateBlock[];
  styles: TemplateStyles;
}

export interface InvoiceTemplate {
  id: string;
  school_id: string;
  name: string;
  is_default: boolean;
  layout: InvoiceTemplateLayout;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_STYLES: TemplateStyles = {
  primaryColor: '217 91% 60%', // Blue
  secondaryColor: '210 40% 96%',
  textColor: '222 47% 11%',
  mutedColor: '215 16% 47%',
  backgroundColor: '0 0% 100%',
  fontFamily: 'inter',
  borderRadius: 'md',
  borderWidth: 'thin',
  shadow: 'md',
};

export const DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: 'logo', type: 'logo', label: 'School Logo', x: 35, y: 20, width: 30, textAlign: 'center', fontSize: 'md' },
  { id: 'school_name', type: 'school_name', label: 'School Name', x: 0, y: 80, width: 100, textAlign: 'center', fontSize: '2xl' },
  { id: 'school_contact', type: 'school_contact', label: 'Contact Info', x: 0, y: 120, width: 100, textAlign: 'center', fontSize: 'sm' },
  { id: 'student_info', type: 'student_info', label: 'Student Info', x: 10, y: 180, width: 80, textAlign: 'left', fontSize: 'md' },
  { id: 'invoice_details', type: 'invoice_details', label: 'Invoice Details', x: 10, y: 280, width: 80, textAlign: 'left', fontSize: 'md' },
  { id: 'amount', type: 'amount', label: 'Amount Due', x: 0, y: 420, width: 100, textAlign: 'center', fontSize: 'xl' },
  { id: 'footer', type: 'footer', label: 'Footer Message', x: 0, y: 500, width: 100, textAlign: 'center', fontSize: 'sm' },
];

export const BLOCK_LABELS: Record<BlockType, string> = {
  logo: 'School Logo',
  school_name: 'School Name',
  school_contact: 'Contact Information',
  student_info: 'Student Information',
  invoice_details: 'Invoice Details',
  amount: 'Amount Due',
  footer: 'Footer Message',
};

export const FONT_FAMILIES: { value: TemplateStyles['fontFamily']; label: string }[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'playfair', label: 'Playfair Display' },
  { value: 'montserrat', label: 'Montserrat' },
];

export const FONT_SIZES: { value: TemplateBlock['fontSize']; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
  { value: '2xl', label: '2X Large' },
];
