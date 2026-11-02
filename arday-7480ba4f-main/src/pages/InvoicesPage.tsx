import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  DollarSign,
  Download,
  CalendarIcon,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { DataTable } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { extractStudentIdNum } from '@/lib/studentSorting';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { generateTemplatedInvoicePdf } from '@/lib/generateTemplatedInvoicePdf';
import { generatePaymentReportPdf } from '@/lib/generatePaymentReportPdf';
import { generatePaymentHistoryPdf } from '@/lib/generatePaymentHistoryPdf';
import { InvoiceTemplateLayout, DEFAULT_BLOCKS, DEFAULT_STYLES } from '@/types/invoiceTemplate';
import { Progress } from '@/components/ui/progress';
import { StudentBalancesSection } from '@/components/invoices/StudentBalancesSection';
import { OutstandingPaymentsSection } from '@/components/invoices/OutstandingPaymentsSection';
import { CarryForwardReport } from '@/components/invoices/CarryForwardReport';
import { getNetAmountRetained, getOutstandingBalance, toCents } from '@/lib/invoiceFinancials';

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  description: string | null;
  amount: number;
  amount_paid: number;
  amount_refunded: number;
  amount_waived: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  student_id: string;
  school_id: string;
  created_at: string;
  cancellation_type: 'refund_issued' | 'fee_waived' | 'created_in_error' | null;
  cancellation_reason: string | null;
  cancellation_note: string | null;
  cancelled_at: string | null;
  cancellation_author?: { full_name: string | null } | null;
  related_invoice_id: string | null;
  related_invoice?: { id: string; invoice_number: string } | null;
  student?: {
    id: string;
    grade: string | null;
    enrollment_number: string | null;
    class_name: string | null;
    section: string | null;
    archived_at?: string | null;
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

interface Student {
  id: string;
  grade: string | null;
  enrollment_number: string | null;
  archived_at?: string | null;
  profile: {
    full_name: string | null;
  } | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  amount_refunded: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  recorder?: { full_name: string | null } | null;
}

interface RefundRecord {
  id: string;
  payment_history_id: string;
  amount: number;
  refund_date: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  payment?: { id: string; amount: number; created_at: string } | null;
  recorder?: { full_name: string | null } | null;
}

function toDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value.toISOString() : value;
  return date.slice(0, 10);
}

function normalizePerson(person: any) {
  if (!person) return null;
  const value = Array.isArray(person) ? person[0] : person;
  return { full_name: value?.full_name ?? value?.fullName ?? null };
}

function normalizeInvoice(rawInvoice: any): Invoice {
  const rawStudent = Array.isArray(rawInvoice.student) ? rawInvoice.student[0] : rawInvoice.student;
  const rawProfile = rawStudent
    ? Array.isArray(rawStudent.profile) ? rawStudent.profile[0] : rawStudent.profile
    : null;
  const rawAuthor = rawInvoice.cancellationAuthor ?? rawInvoice.cancellation_author;
  const rawRelatedInvoice = rawInvoice.relatedInvoice ?? rawInvoice.related_invoice;
  return {
    ...rawInvoice,
    invoice_number: rawInvoice.invoice_number ?? rawInvoice.invoiceNumber,
    amount: Number(rawInvoice.amount || 0),
    amount_paid: Number(rawInvoice.amount_paid ?? rawInvoice.amountPaid ?? 0),
    amount_refunded: Number(rawInvoice.amount_refunded ?? rawInvoice.amountRefunded ?? 0),
    amount_waived: Number(rawInvoice.amount_waived ?? rawInvoice.amountWaived ?? 0),
    due_date: toDateOnly(rawInvoice.due_date ?? rawInvoice.dueDate),
    paid_date: toDateOnly(rawInvoice.paid_date ?? rawInvoice.paidDate) || null,
    payment_method: rawInvoice.payment_method ?? rawInvoice.paymentMethod ?? null,
    student_id: rawInvoice.student_id ?? rawInvoice.studentId,
    school_id: rawInvoice.school_id ?? rawInvoice.schoolId,
    created_at: rawInvoice.created_at ?? rawInvoice.createdAt,
    cancellation_type: rawInvoice.cancellation_type ?? rawInvoice.cancellationType ?? null,
    cancellation_reason: rawInvoice.cancellation_reason ?? rawInvoice.cancellationReason ?? null,
    cancellation_note: rawInvoice.cancellation_note ?? rawInvoice.cancellationNote ?? null,
    cancelled_at: rawInvoice.cancelled_at ?? rawInvoice.cancelledAt ?? null,
    cancellation_author: rawAuthor ? { full_name: rawAuthor.full_name ?? rawAuthor.fullName ?? null } : null,
    related_invoice_id: rawInvoice.related_invoice_id ?? rawInvoice.relatedInvoiceId ?? null,
    related_invoice: rawRelatedInvoice
      ? {
          id: rawRelatedInvoice.id,
          invoice_number: rawRelatedInvoice.invoice_number ?? rawRelatedInvoice.invoiceNumber,
        }
      : null,
    student: rawStudent
      ? {
          ...rawStudent,
          enrollment_number: rawStudent.enrollment_number ?? rawStudent.enrollmentNumber,
          archived_at: rawStudent.archived_at ?? rawStudent.archivedAt,
          class_name: rawStudent.class_name ?? rawStudent.className ?? null,
          section: rawStudent.section ?? null,
          profile: rawProfile
            ? { ...rawProfile, full_name: rawProfile.full_name ?? rawProfile.fullName ?? null }
            : null,
        }
      : null,
    school: Array.isArray(rawInvoice.school) ? rawInvoice.school[0] : rawInvoice.school,
  };
}

function normalizePayment(raw: any): PaymentRecord {
  return {
    id: raw.id,
    amount: Number(raw.amount || 0),
    amount_refunded: Number(raw.amount_refunded ?? raw.amountRefunded ?? 0),
    payment_method: raw.payment_method ?? raw.paymentMethod ?? null,
    notes: raw.notes ?? null,
    created_at: raw.created_at ?? raw.createdAt,
    recorder: normalizePerson(raw.recorder),
  };
}

function normalizeRefund(raw: any): RefundRecord {
  return {
    id: raw.id,
    payment_history_id: raw.payment_history_id ?? raw.paymentHistoryId,
    amount: Number(raw.amount || 0),
    refund_date: toDateOnly(raw.refund_date ?? raw.refundDate),
    reason: raw.reason,
    note: raw.note ?? null,
    status: raw.status,
    created_at: raw.created_at ?? raw.createdAt,
    payment: raw.payment
      ? {
          id: raw.payment.id,
          amount: Number(raw.payment.amount || 0),
          created_at: raw.payment.created_at ?? raw.payment.createdAt,
        }
      : null,
    recorder: normalizePerson(raw.recorder),
  };
}

function cancellationTypeLabel(type: Invoice['cancellation_type']): string {
  switch (type) {
    case 'refund_issued': return 'Refund Issued';
    case 'fee_waived': return 'Fee Waived';
    case 'created_in_error': return 'Invoice Created in Error';
    default: return 'Cancelled';
  }
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  paid: { label: 'Paid', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' },
  overdue: { label: 'Overdue', icon: AlertCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-muted text-muted-foreground' },
};

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();
  const { primaryRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<Invoice | null>(null);
  const [recordRefundInvoice, setRecordRefundInvoice] = useState<Invoice | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined);
  const [periodMode, setPeriodMode] = useState<'monthly' | 'yearly'>('monthly');
  const [invoicesSectionOpen, setInvoicesSectionOpen] = useState(false);

  const isReadOnly = primaryRole === 'student' || primaryRole === 'parent';
  const canCancelInvoices = primaryRole === 'school_admin' || isSuperAdmin;

  // Schools list no longer needed here — school switching is handled globally in the sidebar

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', currentSchoolId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!currentSchoolId) return [];

      const { data } = await api.get<Invoice[]>('/invoices', { params: { school_id: currentSchoolId, limit: 1000 } });

      return (data || []).map(inv => {
        const normalized = normalizeInvoice(inv);
        const rawStudent = Array.isArray(inv.student) ? inv.student[0] : inv.student;
        const classInfo = rawStudent?.class_students?.[0]?.class;
        return {
          ...normalized,
          student: rawStudent ? {
            ...normalized.student,
            id: rawStudent.id,
            grade: rawStudent.grade,
            enrollment_number: rawStudent.enrollment_number ?? rawStudent.enrollmentNumber,
            class_name: classInfo?.name || null,
            section: classInfo?.section || null,
            archived_at: rawStudent.archived_at ?? rawStudent.archivedAt,
          } : null,
        } as Invoice;
      }).filter(inv => !inv.student?.archived_at);
    },
    enabled: !!currentSchoolId,
  });

  // Fetch default invoice template
  const { data: defaultTemplate } = useQuery({
    queryKey: ['default-invoice-template', currentSchoolId],
    queryFn: async (): Promise<InvoiceTemplateLayout | null> => {
      if (!currentSchoolId) return null;

      const { data } = await api.get<{ layout: any }>('/invoices/templates', { params: { school_id: currentSchoolId, is_default: true } });

      if (!data?.layout) return null;

      const layout = typeof data.layout === 'string' 
        ? JSON.parse(data.layout) 
        : data.layout;

      return {
        blocks: layout.blocks ?? DEFAULT_BLOCKS,
        styles: { ...DEFAULT_STYLES, ...(layout.styles ?? {}) },
      };
    },
    enabled: !!currentSchoolId,
  });

  // Handler for downloading PDF with template
  const handleDownloadPdf = useCallback((invoice: Invoice) => {
    generateTemplatedInvoicePdf(invoice, defaultTemplate);
  }, [defaultTemplate]);

  // Fetch students for dropdown
  const { data: students = [] } = useQuery({
    queryKey: ['students-list', currentSchoolId],
    queryFn: async (): Promise<Student[]> => {
      if (!currentSchoolId) return [];

      const { data } = await api.get<Student[]>('/students', { params: { school_id: currentSchoolId } });

      return (data || []).filter(s => !s.archived_at).map(s => ({
        ...s,
        profile: Array.isArray(s.profile) ? s.profile[0] : s.profile,
      }));
    },
    enabled: !!currentSchoolId && !isReadOnly,
  });

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      amount: number;
      due_date: string;
      student_id: string;
      payment_method?: string;
    }) => {
      if (!currentSchoolId) throw new Error('No school selected');

      await api.post('/invoices', {
        invoice_number: 'auto',
        title: data.title,
        description: data.description || null,
        amount: data.amount,
        due_date: data.due_date,
        student_id: data.student_id,
        school_id: currentSchoolId,
        status: 'pending',
        payment_method: data.payment_method || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      setIsAddModalOpen(false);
      toast({
        title: 'Invoice created',
        description: 'The invoice has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating invoice',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ invoice, status }: { invoice: Invoice; status: 'pending' | 'overdue' }) => {
      await api.put(`/invoices/${invoice.id}/status`, {
        school_id: invoice.school_id,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast({
        title: 'Invoice updated',
        description: 'The invoice status has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating invoice',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      amount: number;
      due_date: string;
      student_id: string;
      school_id: string;
      payment_method?: string;
    }) => {
      const updateData = {
        school_id: data.school_id,
        title: data.title,
        amount: data.amount,
        due_date: data.due_date,
        student_id: data.student_id,
        payment_method: data.payment_method || null,
      };
      await api.put(`/invoices/${data.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      setEditingInvoice(null);
      toast({ title: 'Invoice updated', description: 'The invoice has been updated successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating invoice', description: error.message, variant: 'destructive' });
    },
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ invoice, paymentAmount, paymentMethod, notes }: { invoice: Invoice; paymentAmount: number; paymentMethod?: string; notes?: string }) => {
      await api.post(`/invoices/${invoice.id}/payments`, {
        school_id: invoice.school_id,
        amount: paymentAmount,
        payment_method: paymentMethod || null,
        notes: notes || null,
      });

      return {
        newAmountPaid: Number(invoice.amount_paid || 0) + paymentAmount,
        totalAmount: Number(invoice.amount),
        amountWaived: Number(invoice.amount_waived || 0),
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      setRecordPaymentInvoice(null);
      const remaining = Math.max(0, result.totalAmount - result.newAmountPaid - result.amountWaived);
      toast({
        title: remaining <= 0 ? 'Fully paid!' : 'Payment recorded',
        description: remaining <= 0
          ? 'The invoice has been fully paid.'
          : `Payment recorded. Remaining balance: $${remaining.toLocaleString()}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error recording payment', description: error.message, variant: 'destructive' });
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (data: {
      invoice: Invoice;
      cancellation_type: 'refund_issued' | 'fee_waived' | 'created_in_error';
      reason: string;
      note?: string;
      amount?: number;
      payment_history_id?: string;
      refund_date?: string;
      refund_confirmed?: true;
      duplicate?: boolean;
      related_invoice_id?: string;
    }) => {
      const { invoice, ...cancellation } = data;
      await api.post(`/invoices/${invoice.id}/cancel`, {
        school_id: invoice.school_id,
        ...cancellation,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-refunds'] });
      setCancellingInvoice(null);
      toast({ title: 'Invoice cancelled', description: 'Cancellation details and financial records have been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error cancelling invoice', description: error.message, variant: 'destructive' });
    },
  });

  const recordRefundMutation = useMutation({
    mutationFn: async (data: {
      invoice: Invoice;
      payment_history_id: string;
      amount: number;
      refund_date: string;
      reason: string;
      note?: string;
    }) => {
      const { invoice, ...refund } = data;
      await api.post(`/invoices/${invoice.id}/refunds`, {
        school_id: invoice.school_id,
        ...refund,
        refund_confirmed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-refunds'] });
      setRecordRefundInvoice(null);
      toast({ title: 'Refund recorded', description: 'The processed refund has been added to the invoice history.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error recording refund', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentSchoolId) throw new Error('No school selected');
      await api.delete(`/invoices/${id}`, { params: { school_id: currentSchoolId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast({
        title: 'Invoice deleted',
        description: 'The invoice has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting invoice',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle invoice deletion with confirmation dialog
  const handleDeleteInvoice = useCallback(async (invoice: Invoice) => {
    const hasPayments = Number(invoice.amount_paid || 0) > 0;

    if (hasPayments || invoice.status === 'cancelled') {
      toast({
        title: 'Invoice retained',
        description: 'Invoices with payment or cancellation history cannot be deleted. Cancelled invoices remain available for audit.',
        variant: 'destructive',
      });
      return;
    }

    const isSchoolAdmin = primaryRole === 'school_admin';
    if (isSchoolAdmin && currentSchoolId && invoice.school_id !== currentSchoolId) {
      toast({
        title: 'Access denied',
        description: 'You do not have permission to delete invoices from another school.',
        variant: 'destructive',
      });
      return;
    }

    await deleteMutation.mutateAsync(invoice.id);
  }, [deleteMutation, currentSchoolId, primaryRole, toast]);

  // Period-filtered invoices for stats cards
  const periodFilteredInvoices = useMemo(() => {
    if (!selectedMonth) return invoices;
    if (periodMode === 'yearly') {
      const yStart = startOfYear(selectedMonth);
      const yEnd = endOfYear(selectedMonth);
      return invoices.filter(i => {
        const due = new Date(i.due_date + 'T00:00:00');
        return isWithinInterval(due, { start: yStart, end: yEnd });
      });
    }
    const mStart = startOfMonth(selectedMonth);
    const mEnd = endOfMonth(selectedMonth);
    return invoices.filter(i => {
      const due = new Date(i.due_date + 'T00:00:00');
      return isWithinInterval(due, { start: mStart, end: mEnd });
    });
  }, [invoices, selectedMonth, periodMode]);

  // Calculate stats based on period
  const stats = {
    total: periodFilteredInvoices.length,
    pending: periodFilteredInvoices.filter(i => i.status === 'pending').length,
    paid: periodFilteredInvoices.filter(i => i.status === 'paid').length,
    overdue: periodFilteredInvoices.filter(i => i.status === 'overdue').length,
    totalAmount: periodFilteredInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
    paidAmount: periodFilteredInvoices.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0),
  };

  // Monthly paid summary
  const monthlyPaidStats = useMemo(() => {
    const now = selectedMonth || new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const monthInvoices = invoices.filter(i => {
      const due = new Date(i.due_date + 'T00:00:00');
      return isWithinInterval(due, { start: mStart, end: mEnd });
    });
    return {
      label: format(mStart, 'MMMM yyyy'),
      total: monthInvoices.length,
      paid: monthInvoices.filter(i => i.status === 'paid').length,
      paidAmount: monthInvoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
      pendingAmount: monthInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + getOutstandingBalance(i), 0),
      overdueAmount: monthInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + getOutstandingBalance(i), 0),
      totalAmount: monthInvoices.reduce((s, i) => s + Number(i.amount), 0),
    };
  }, [invoices, selectedMonth]);

  // Yearly paid summary
  const yearlyPaidStats = useMemo(() => {
    const now = selectedMonth || new Date();
    const yStart = startOfYear(now);
    const yEnd = endOfYear(now);
    const yearInvoices = invoices.filter(i => {
      const due = new Date(i.due_date + 'T00:00:00');
      return isWithinInterval(due, { start: yStart, end: yEnd });
    });
    return {
      label: format(yStart, 'yyyy'),
      total: yearInvoices.length,
      paid: yearInvoices.filter(i => i.status === 'paid').length,
      paidAmount: yearInvoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
      pendingAmount: yearInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + getOutstandingBalance(i), 0),
      overdueAmount: yearInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + getOutstandingBalance(i), 0),
      totalAmount: yearInvoices.reduce((s, i) => s + Number(i.amount), 0),
    };
  }, [invoices, selectedMonth]);

  const invoiceColumns = [
    {
      key: 'invoice_number',
      header: 'Invoice No.',
      cell: (invoice: Invoice) => (
        <div>
          <span className="font-mono font-medium text-primary">{invoice.invoice_number}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {format(new Date(invoice.created_at), 'dd MMM yyyy')}
          </p>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      cell: (invoice: Invoice) => {
        const classSection = invoice.student?.class_name
          ? invoice.student.section
            ? `${invoice.student.class_name} (${invoice.student.section})`
            : invoice.student.class_name
          : null;
        return (
          <div>
            <p className="font-medium">
              <span className="text-primary font-mono mr-1">{invoice.student?.enrollment_number || '—'}</span>
              {invoice.student?.profile?.full_name || 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">
              {classSection ? `${classSection} · ` : ''}Grade {invoice.student?.grade || 'N/A'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'title',
      header: 'Title',
      cell: (invoice: Invoice) => {
        const hasCarryForward = invoice.description?.includes('Previous balance');
        return (
          <div>
            <span className="text-foreground">{invoice.title}</span>
            {hasCarryForward && (
              <p className="text-[10px] text-warning font-medium mt-0.5">
                ⚠ Has previous balance
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Total Fee',
      cell: (invoice: Invoice) => (
        <span className="font-semibold">${Number(invoice.amount).toLocaleString()}</span>
      ),
    },
    {
      key: 'amount_paid',
      header: 'Paid',
      cell: (invoice: Invoice) => (
        <span className="font-medium text-success">${Number(invoice.amount_paid || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'remaining',
      header: 'Outstanding',
      cell: (invoice: Invoice) => {
        const remaining = getOutstandingBalance(invoice);
        if (remaining <= 0) {
          return (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              {invoice.status === 'paid' ? 'Paid' : 'No balance'}
            </Badge>
          );
        }
        return (
          <span className="font-semibold text-destructive">${remaining.toLocaleString()} due</span>
        );
      },
    },
    {
      key: 'due_date',
      header: 'Due Date',
      cell: (invoice: Invoice) => (
        <span className="text-muted-foreground">
          {format(new Date(invoice.due_date + 'T00:00:00'), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Payment',
      cell: (invoice: Invoice) => (
        invoice.payment_method ? (
          <Badge variant="outline" className="capitalize text-xs">
            {invoice.payment_method.replace('_', ' ')}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (invoice: Invoice) => {
        const config = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pending;
        const Icon = config.icon;
        return (
          <Badge className={config.className}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        );
      },
    },
    ...(!isReadOnly ? [{
      key: 'actions',
      header: '',
      cell: (invoice: Invoice) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            {invoice.status === 'cancelled' && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {cancellationTypeLabel(invoice.cancellation_type)}
                </DropdownMenuLabel>
                <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                  <Eye className="h-4 w-4" /> Cancellation Details
                </DropdownMenuItem>
              </>
            )}
            {canCancelInvoices && invoice.status === 'cancelled' && invoice.cancellation_type === 'refund_issued' && (
              <DropdownMenuItem className="gap-2" onClick={() => setRecordRefundInvoice(invoice)}>
                <DollarSign className="h-4 w-4" /> Record Additional Refund
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2" onClick={() => handleDownloadPdf(invoice)}>
              <Download className="h-4 w-4" /> Download PDF
            </DropdownMenuItem>
            {invoice.status !== 'cancelled' && (
              <DropdownMenuItem className="gap-2" onClick={() => setEditingInvoice(invoice)}>
                <Edit className="h-4 w-4" /> Edit Invoice
              </DropdownMenuItem>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <DropdownMenuItem
                className="gap-2 text-primary"
                onClick={() => setRecordPaymentInvoice(invoice)}
              >
                <DollarSign className="h-4 w-4" /> Record Payment
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {invoice.status === 'pending' && (
              <DropdownMenuItem
                className="gap-2 text-destructive"
                onClick={() => updateStatusMutation.mutate({ invoice, status: 'overdue' })}
              >
                <AlertCircle className="h-4 w-4" /> Mark as Overdue
              </DropdownMenuItem>
            )}
            {canCancelInvoices && invoice.status !== 'cancelled' && (
              <DropdownMenuItem
                className="gap-2"
                onClick={() => setCancellingInvoice(invoice)}
              >
                <XCircle className="h-4 w-4" /> Cancel Invoice
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive"
              onClick={() => handleDeleteInvoice(invoice)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'w-12',
    }] : []),
  ];

  const filteredInvoices = useMemo(() => {
    // First apply period filter
    let base = periodFilteredInvoices;

    return base.filter((invoice) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        invoice.invoice_number.toLowerCase().includes(q) ||
        invoice.title.toLowerCase().includes(q) ||
        invoice.student?.profile?.full_name?.toLowerCase().includes(q) ||
        invoice.student?.enrollment_number?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const numA = extractStudentIdNum(a.student?.enrollment_number);
      const numB = extractStudentIdNum(b.student?.enrollment_number);
      return numA - numB;
    });
  }, [periodFilteredInvoices, searchQuery, statusFilter]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Invoices"
        description="Manage student fees and payment tracking"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Invoices' }]}
        actions={
          !isReadOnly && (
            <Button className="gap-2" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          )
        }
      />


      {/* Stats Cards */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {selectedMonth
            ? periodMode === 'yearly'
              ? `Year ${format(selectedMonth, 'yyyy')}`
              : format(startOfMonth(selectedMonth), 'MMMM yyyy')
            : 'All Time'}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${stats.paidAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Month/Year Payment Summary */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Payment Summary
          </h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !selectedMonth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedMonth ? format(selectedMonth, 'dd/MM/yyyy') : 'Select month'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={setSelectedMonth}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {selectedMonth && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(undefined)}>
              Reset to current
            </Button>
          )}
        </div>

        <Tabs value={periodMode} onValueChange={(v) => setPeriodMode(v as 'monthly' | 'yearly')} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{monthlyPaidStats.label} — Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">${monthlyPaidStats.totalAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{monthlyPaidStats.total} invoices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-success">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-success">${monthlyPaidStats.paidAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{monthlyPaidStats.paid} paid</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-warning">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-warning">${monthlyPaidStats.pendingAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-destructive">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-destructive">${monthlyPaidStats.overdueAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
            {/* Collection Progress Bar */}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Collection Rate</span>
                  <span className="text-sm font-bold text-primary">
                    {monthlyPaidStats.totalAmount > 0
                      ? ((monthlyPaidStats.paidAmount / monthlyPaidStats.totalAmount) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <Progress
                  value={monthlyPaidStats.totalAmount > 0 ? (monthlyPaidStats.paidAmount / monthlyPaidStats.totalAmount) * 100 : 0}
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ${monthlyPaidStats.paidAmount.toLocaleString()} collected out of ${monthlyPaidStats.totalAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const rate = monthlyPaidStats.totalAmount > 0
                  ? (monthlyPaidStats.paidAmount / monthlyPaidStats.totalAmount) * 100
                  : 0;
                generatePaymentReportPdf({
                  period: monthlyPaidStats.label,
                  type: 'monthly',
                  totalAmount: monthlyPaidStats.totalAmount,
                  paidAmount: monthlyPaidStats.paidAmount,
                  pendingAmount: monthlyPaidStats.pendingAmount,
                  overdueAmount: monthlyPaidStats.overdueAmount,
                  totalInvoices: monthlyPaidStats.total,
                  paidCount: monthlyPaidStats.paid,
                  collectionRate: rate,
                  schoolName: invoices[0]?.school?.name,
                });
              }}
            >
              <Download className="h-4 w-4" />
              Export Monthly Report PDF
            </Button>
          </TabsContent>
          <TabsContent value="yearly">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Year {yearlyPaidStats.label} — Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">${yearlyPaidStats.totalAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{yearlyPaidStats.total} invoices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-success">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-success">${yearlyPaidStats.paidAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{yearlyPaidStats.paid} paid</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-warning">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-warning">${yearlyPaidStats.pendingAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-destructive">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-destructive">${yearlyPaidStats.overdueAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
            {/* Collection Progress Bar */}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Collection Rate</span>
                  <span className="text-sm font-bold text-primary">
                    {yearlyPaidStats.totalAmount > 0
                      ? ((yearlyPaidStats.paidAmount / yearlyPaidStats.totalAmount) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <Progress
                  value={yearlyPaidStats.totalAmount > 0 ? (yearlyPaidStats.paidAmount / yearlyPaidStats.totalAmount) * 100 : 0}
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ${yearlyPaidStats.paidAmount.toLocaleString()} collected out of ${yearlyPaidStats.totalAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const rate = yearlyPaidStats.totalAmount > 0
                  ? (yearlyPaidStats.paidAmount / yearlyPaidStats.totalAmount) * 100
                  : 0;
                generatePaymentReportPdf({
                  period: yearlyPaidStats.label,
                  type: 'yearly',
                  totalAmount: yearlyPaidStats.totalAmount,
                  paidAmount: yearlyPaidStats.paidAmount,
                  pendingAmount: yearlyPaidStats.pendingAmount,
                  overdueAmount: yearlyPaidStats.overdueAmount,
                  totalInvoices: yearlyPaidStats.total,
                  paidCount: yearlyPaidStats.paid,
                  collectionRate: rate,
                  schoolName: invoices[0]?.school?.name,
                });
              }}
            >
              <Download className="h-4 w-4" />
              Export Yearly Report PDF
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Outstanding Payments */}
      {!isReadOnly && <OutstandingPaymentsSection invoices={invoices} />}

      {/* Student Balances */}
      {!isReadOnly && <StudentBalancesSection invoices={invoices} selectedMonth={selectedMonth} periodMode={periodMode} />}

      {/* Carry-Forward History */}
      {!isReadOnly && <CarryForwardReport invoices={invoices} />}

      {/* Invoice Table - Period Filtered */}
      <button
        onClick={() => setInvoicesSectionOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors mb-4"
      >
        <div className="flex items-center gap-2">
          {invoicesSectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          {selectedMonth
            ? periodMode === 'yearly'
              ? format(selectedMonth, 'yyyy')
              : format(startOfMonth(selectedMonth), 'MMMM yyyy')
            : 'All Time'}
          {' · '}{periodFilteredInvoices.length} invoices
        </Badge>
      </button>

      {invoicesSectionOpen && (<>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredInvoices.length > 0 ? (
        <DataTable columns={invoiceColumns} data={filteredInvoices} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {invoices.length === 0
              ? 'No invoices yet'
              : selectedMonth && periodFilteredInvoices.length === 0
                ? 'No invoices for this period'
                : 'No invoices found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {invoices.length === 0
              ? 'Create your first invoice to start tracking payments'
              : selectedMonth && periodFilteredInvoices.length === 0
                ? `No invoices found for ${periodMode === 'yearly' ? format(selectedMonth, 'yyyy') : format(startOfMonth(selectedMonth), 'MMMM yyyy')}. Select a different period or reset the filter.`
                : 'Try adjusting your search or filters'}
          </p>
          {!isReadOnly && invoices.length === 0 && (
            <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          )}
        </motion.div>
      )}
      </>)}

      {/* Add Invoice Modal */}
      <AddInvoiceModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        students={students}
        invoices={invoices}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <ViewInvoiceModal
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {cancellingInvoice && (
        <CancellationDialog
          open={!!cancellingInvoice}
          onOpenChange={(open) => !open && setCancellingInvoice(null)}
          invoice={cancellingInvoice}
          invoices={invoices}
          onSubmit={(data) => cancelInvoiceMutation.mutate(data)}
          isLoading={cancelInvoiceMutation.isPending}
        />
      )}

      {recordRefundInvoice && (
        <RecordRefundDialog
          open={!!recordRefundInvoice}
          onOpenChange={(open) => !open && setRecordRefundInvoice(null)}
          invoice={recordRefundInvoice}
          onSubmit={(data) => recordRefundMutation.mutate(data)}
          isLoading={recordRefundMutation.isPending}
        />
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          invoice={editingInvoice}
          students={students}
          onSubmit={(data) => updateInvoiceMutation.mutate({ ...data, school_id: currentSchoolId || '' })}
          isLoading={updateInvoiceMutation.isPending}
        />
      )}

      {/* Record Payment Dialog */}
      {recordPaymentInvoice && (
        <RecordPaymentDialog
          open={!!recordPaymentInvoice}
          onOpenChange={(open) => !open && setRecordPaymentInvoice(null)}
          invoice={recordPaymentInvoice}
          onSubmit={(data) => recordPaymentMutation.mutate({ ...data, invoice: recordPaymentInvoice })}
          isLoading={recordPaymentMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}

// Add Invoice Modal Component
function AddInvoiceModal({
  open,
  onOpenChange,
  students,
  invoices,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  invoices: Invoice[];
  onSubmit: (data: { title: string; description?: string; amount: number; due_date: string; student_id: string; payment_method?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    student_id: '',
    payment_method: '',
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false);

  const filteredStudents = students.filter((s) => {
    const name = s.profile?.full_name?.toLowerCase() || '';
    const grade = s.grade?.toLowerCase() || '';
    const enrollment = s.enrollment_number?.toLowerCase() || '';
    const q = studentSearch.toLowerCase();
    return name.includes(q) || grade.includes(q) || enrollment.includes(q);
  });

  const selectedStudent = students.find((s) => s.id === formData.student_id);

  // Calculate outstanding balance for selected student
  const studentBalance = useMemo(() => {
    if (!formData.student_id) return null;
    const studentInvoices = invoices.filter((inv) => inv.student_id === formData.student_id);
    const totalAmount = studentInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidAmount = studentInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
    const outstanding = studentInvoices.reduce((sum, inv) => sum + getOutstandingBalance(inv), 0);
    return { totalAmount, paidAmount, outstanding, count: studentInvoices.filter((inv) => getOutstandingBalance(inv) > 0).length };
  }, [formData.student_id, invoices]);

  const paymentMethods = [
    { value: 'zaad', label: 'Zaad' },
    { value: 'sahal', label: 'Sahal' },
    { value: 'evc_plus', label: 'EVC Plus' },
    { value: 'edahab', label: 'eDahab' },
    { value: 'cash', label: 'Cash' },
    { value: 'ebirr', label: 'eBirr' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.due_date) {
      return;
    }
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for a student
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="space-y-2">
            <Label>Invoice Number</Label>
            <p className="text-sm text-muted-foreground italic">Auto-generated on creation</p>
          </div>
          <div className="space-y-2">
            <Label>Student</Label>
            <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={studentPopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedStudent
                    ? `${selectedStudent.enrollment_number || '—'} - ${selectedStudent.profile?.full_name || 'Unknown'} - Grade ${selectedStudent.grade || 'N/A'}`
                    : 'Search and select a student...'}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-[280px] overflow-y-auto p-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No students found</p>
                  ) : (
                    filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between",
                          formData.student_id === student.id && "bg-accent text-accent-foreground"
                        )}
                        onClick={() => {
                          setFormData({ ...formData, student_id: student.id });
                          setStudentPopoverOpen(false);
                          setStudentSearch('');
                        }}
                      >
                        <span><span className="font-mono text-primary mr-1">{student.enrollment_number || '—'}</span>{student.profile?.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">Grade {student.grade || 'N/A'}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {studentBalance && (
            <div className={cn(
              "rounded-lg border p-3 space-y-1",
              studentBalance.outstanding > 0 ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Outstanding Balance</span>
                <span className={cn(
                  "text-sm font-bold",
                  studentBalance.outstanding > 0 ? "text-destructive" : "text-success"
                )}>
                  ${studentBalance.outstanding.toFixed(2)}
                </span>
              </div>
              {studentBalance.outstanding > 0 && (
                <p className="text-xs text-muted-foreground">
                  {studentBalance.count} unpaid invoice{studentBalance.count !== 1 ? 's' : ''} · Total: ${studentBalance.totalAmount.toFixed(2)} · Paid: ${studentBalance.paidAmount.toFixed(2)}
                </p>
              )}
              {studentBalance.outstanding === 0 && (
                <p className="text-xs text-muted-foreground">This student has no outstanding balance</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Tuition Fee - Term 1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date
                      ? format(new Date(formData.due_date + 'T00:00:00'), 'dd/MM/yyyy')
                      : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date ? new Date(formData.due_date + 'T00:00:00') : undefined}
                    onSelect={(date) => setFormData({ ...formData, due_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.student_id}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invoice'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Invoice Modal Component
function EditInvoiceModal({
  open,
  onOpenChange,
  invoice,
  students,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  students: Student[];
  onSubmit: (data: { id: string; title: string; amount: number; due_date: string; student_id: string; payment_method?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: invoice.title,
    amount: String(invoice.amount),
    due_date: invoice.due_date,
    student_id: invoice.student_id,
    payment_method: invoice.payment_method || '',
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false);

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (s.profile?.full_name?.toLowerCase() || '').includes(q) || (s.enrollment_number?.toLowerCase() || '').includes(q);
  });

  const selectedStudent = students.find((s) => s.id === formData.student_id);

  const paymentMethods = [
    { value: 'zaad', label: 'Zaad' },
    { value: 'sahal', label: 'Sahal' },
    { value: 'evc_plus', label: 'EVC Plus' },
    { value: 'edahab', label: 'eDahab' },
    { value: 'cash', label: 'Cash' },
    { value: 'ebirr', label: 'eBirr' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: invoice.id,
      title: formData.title,
      amount: parseFloat(formData.amount),
      due_date: formData.due_date,
      student_id: formData.student_id,
      payment_method: formData.payment_method || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>Update invoice {invoice.invoice_number}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedStudent
                    ? `${selectedStudent.enrollment_number || '—'} - ${selectedStudent.profile?.full_name || 'Unknown'}`
                    : 'Select student...'}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b">
                  <Input placeholder="Search students..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="h-8" />
                </div>
                <div className="max-h-[200px] overflow-y-auto p-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No students found</p>
                  ) : (
                    filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between",
                          formData.student_id === student.id && "bg-accent text-accent-foreground"
                        )}
                        onClick={() => { setFormData({ ...formData, student_id: student.id }); setStudentPopoverOpen(false); setStudentSearch(''); }}
                      >
                        <span><span className="font-mono text-primary mr-1">{student.enrollment_number || '—'}</span>{student.profile?.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">Grade {student.grade || 'N/A'}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Original Invoice Amount ($)</Label>
            <Input id="edit-amount" type="number" step="0.01" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
          </div>
          {(() => {
            const remaining = Math.max(0, Number(formData.amount || 0) - Number(invoice.amount_paid || 0) - Number(invoice.amount_waived || 0));
            return remaining > 0 ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs">
                <span className="text-muted-foreground">Remaining Balance: </span>
                <span className="font-bold text-destructive">${remaining.toLocaleString()}</span>
              </div>
            ) : remaining === 0 && parseFloat(formData.amount || '0') > 0 ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-2 text-xs text-success font-medium">
                ✓ Fully Paid
              </div>
            ) : null;
          })()}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date
                      ? format(new Date(formData.due_date + 'T00:00:00'), 'dd/MM/yyyy')
                      : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date ? new Date(formData.due_date + 'T00:00:00') : undefined}
                    onSelect={(date) => setFormData({ ...formData, due_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
              <SelectTrigger><SelectValue placeholder="Select payment method..." /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !formData.student_id}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CancellationType = 'refund_issued' | 'fee_waived' | 'created_in_error';

function CancellationDialog({
  open,
  onOpenChange,
  invoice,
  invoices,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  invoices: Invoice[];
  onSubmit: (data: {
    invoice: Invoice;
    cancellation_type: CancellationType;
    reason: string;
    note?: string;
    amount?: number;
    payment_history_id?: string;
    refund_date?: string;
    refund_confirmed?: true;
    duplicate?: boolean;
    related_invoice_id?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [type, setType] = useState<CancellationType | ''>('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payment-history', invoice.id],
    queryFn: async () => {
      const response = await api.get<{ data?: any[] }>(`/invoices/${invoice.id}/payments`, {
        params: { school_id: invoice.school_id },
      });
      return (response.data || []).map(normalizePayment);
    },
    enabled: open && type === 'refund_issued',
  });

  const selectedPayment = paymentHistory.find((payment) => payment.id === paymentId);
  const availableRefund = selectedPayment
    ? Math.max(0, toCents(selectedPayment.amount) - toCents(selectedPayment.amount_refunded)) / 100
    : 0;
  const outstanding = getOutstandingBalance(invoice);
  const maxAmount = type === 'fee_waived' ? outstanding : type === 'refund_issued' ? availableRefund : 0;
  const amountCents = toCents(amount);
  const maxAmountCents = toCents(maxAmount);

  useEffect(() => {
    if (type === 'fee_waived') {
      setAmount(outstanding.toFixed(2));
    } else if (type === 'refund_issued' && selectedPayment) {
      setAmount(availableRefund.toFixed(2));
    } else {
      setAmount('');
    }
  }, [type, invoice.id, outstanding, selectedPayment?.id, availableRefund]);

  useEffect(() => {
    if (!paymentId && paymentHistory.length > 0) {
      setPaymentId(paymentHistory[0].id);
    }
  }, [paymentId, paymentHistory]);

  const duplicateInvoices = invoices.filter(
    (candidate) => candidate.id !== invoice.id && candidate.school_id === invoice.school_id,
  );
  const amountIsValid = amountCents > 0 && amountCents <= maxAmountCents;
  const isValid = Boolean(
    type &&
      reason.trim() &&
      (type === 'fee_waived'
        ? amountIsValid
        : type === 'refund_issued'
          ? amountIsValid && selectedPayment && refundDate && refundConfirmed
          : !isDuplicate || relatedInvoiceId),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!type || !isValid) return;
    onSubmit({
      invoice,
      cancellation_type: type,
      reason: reason.trim(),
      note: note.trim() || undefined,
      ...(type === 'fee_waived' && { amount: amountCents / 100 }),
      ...(type === 'refund_issued' && {
        amount: amountCents / 100,
        payment_history_id: paymentId,
        refund_date: refundDate,
        refund_confirmed: true as const,
      }),
      ...(type === 'created_in_error' && {
        duplicate: isDuplicate,
        ...(isDuplicate && { related_invoice_id: relatedInvoiceId }),
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancel Invoice {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Choose how this invoice is being resolved. The original invoice amount and payment history will be preserved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original amount</span>
              <span className="font-medium">${Number(invoice.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actually paid</span>
              <span className="font-medium">${Number(invoice.amount_paid || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding before cancellation</span>
              <span className="font-medium">${outstanding.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cancellation type</Label>
            <Select value={type} onValueChange={(value) => setType(value as CancellationType)}>
              <SelectTrigger><SelectValue placeholder="Select a cancellation type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refund_issued">Refund Issued</SelectItem>
                <SelectItem value="fee_waived">Fee Waived</SelectItem>
                <SelectItem value="created_in_error">Invoice Created in Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'fee_waived' && (
            <div className="space-y-2">
              <Label htmlFor="cancellation-waiver-amount">Amount waived ($)</Label>
              <Input
                id="cancellation-waiver-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={outstanding}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Maximum waiver: ${outstanding.toFixed(2)}. A waiver is not recorded as a payment.
              </p>
            </div>
          )}

          {type === 'refund_issued' && (
            <div className="space-y-3">
              {paymentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading original payments...</p>
              ) : paymentHistory.length === 0 ? (
                <p className="text-sm text-destructive">No recorded payment is available to refund.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Original payment transaction</Label>
                    <Select value={paymentId} onValueChange={setPaymentId}>
                      <SelectTrigger><SelectValue placeholder="Select payment" /></SelectTrigger>
                      <SelectContent>
                        {paymentHistory.map((payment) => {
                          const available = Math.max(
                            0,
                            toCents(payment.amount) - toCents(payment.amount_refunded),
                          ) / 100;
                          return (
                            <SelectItem key={payment.id} value={payment.id} disabled={available <= 0}>
                              ${payment.amount.toFixed(2)} · {format(new Date(payment.created_at), 'dd MMM yyyy')} · ${available.toFixed(2)} available
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cancellation-refund-amount">Amount refunded ($)</Label>
                      <Input
                        id="cancellation-refund-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={availableRefund}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cancellation-refund-date">Refund processing date</Label>
                      <Input
                        id="cancellation-refund-date"
                        type="date"
                        value={refundDate}
                        onChange={(event) => setRefundDate(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={refundConfirmed}
                      onChange={(event) => setRefundConfirmed(event.target.checked)}
                      className="mt-1"
                    />
                    <span>I confirm that this refund has already been processed for the selected payment.</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Refund limit for this payment: ${availableRefund.toFixed(2)}. No refund transaction is recorded until you confirm processing.
                  </p>
                </>
              )}
            </div>
          )}

          {type === 'created_in_error' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDuplicate}
                  onChange={(event) => {
                    setIsDuplicate(event.target.checked);
                    setRelatedInvoiceId('');
                  }}
                />
                This invoice duplicates another invoice
              </label>
              {isDuplicate && (
                <div className="space-y-2">
                  <Label>Original invoice</Label>
                  {duplicateInvoices.length === 0 ? (
                    <p className="text-sm text-destructive">No other invoice is available to reference.</p>
                  ) : (
                    <Select value={relatedInvoiceId} onValueChange={setRelatedInvoiceId}>
                      <SelectTrigger><SelectValue placeholder="Select the original invoice" /></SelectTrigger>
                      <SelectContent>
                        {duplicateInvoices.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.invoice_number} · {candidate.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Reason</Label>
            <Textarea
              id="cancellation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={4000}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellation-note">Additional note (optional)</Label>
            <Textarea
              id="cancellation-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={4000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Keep Invoice
            </Button>
            <Button type="submit" variant="destructive" disabled={isLoading || !isValid}>
              {isLoading ? 'Saving...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordRefundDialog({
  open,
  onOpenChange,
  invoice,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSubmit: (data: {
    invoice: Invoice;
    payment_history_id: string;
    amount: number;
    refund_date: string;
    reason: string;
    note?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payment-history', invoice.id],
    queryFn: async () => {
      const response = await api.get<{ data?: any[] }>(`/invoices/${invoice.id}/payments`, {
        params: { school_id: invoice.school_id },
      });
      return (response.data || []).map(normalizePayment);
    },
    enabled: open,
  });

  const selectedPayment = paymentHistory.find((payment) => payment.id === paymentId);
  const availableRefund = selectedPayment
    ? Math.max(0, toCents(selectedPayment.amount) - toCents(selectedPayment.amount_refunded)) / 100
    : 0;

  useEffect(() => {
    if (!paymentId && paymentHistory.length > 0) {
      setPaymentId(paymentHistory[0].id);
    }
  }, [paymentId, paymentHistory]);

  useEffect(() => {
    setAmount(availableRefund > 0 ? availableRefund.toFixed(2) : '');
  }, [paymentId, availableRefund]);

  const amountCents = toCents(amount);
  const isValid = Boolean(
    selectedPayment &&
    amountCents > 0 &&
    amountCents <= toCents(availableRefund) &&
    refundDate &&
    reason.trim() &&
    refundConfirmed,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || !selectedPayment) return;
    onSubmit({
      invoice,
      payment_history_id: selectedPayment.id,
      amount: amountCents / 100,
      refund_date: refundDate,
      reason: reason.trim(),
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Refund for {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Record only a refund that has already been processed. The original payment remains in the payment history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {paymentsLoading ? (
            <p className="text-sm text-muted-foreground">Loading original payments...</p>
          ) : paymentHistory.length === 0 ? (
            <p className="text-sm text-destructive">No original payment is available to refund.</p>
          ) : (
            <div className="space-y-2">
              <Label>Original payment transaction</Label>
              <Select value={paymentId} onValueChange={setPaymentId}>
                <SelectTrigger><SelectValue placeholder="Select payment" /></SelectTrigger>
                <SelectContent>
                  {paymentHistory.map((payment) => {
                    const available = Math.max(
                      0,
                      toCents(payment.amount) - toCents(payment.amount_refunded),
                    ) / 100;
                    return (
                      <SelectItem key={payment.id} value={payment.id} disabled={available <= 0}>
                        ${payment.amount.toFixed(2)} · {format(new Date(payment.created_at), 'dd MMM yyyy')} · ${available.toFixed(2)} available
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="additional-refund-amount">Amount refunded ($)</Label>
              <Input
                id="additional-refund-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={availableRefund}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additional-refund-date">Refund processing date</Label>
              <Input
                id="additional-refund-date"
                type="date"
                value={refundDate}
                onChange={(event) => setRefundDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="additional-refund-reason">Reason</Label>
            <Textarea
              id="additional-refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={4000}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="additional-refund-note">Additional note (optional)</Label>
            <Textarea
              id="additional-refund-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={4000}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundConfirmed}
              onChange={(event) => setRefundConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I confirm that this refund has already been processed.</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Remaining refundable amount for this payment: ${availableRefund.toFixed(2)}.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading ? 'Saving...' : 'Record Processed Refund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// View Invoice Modal Component
function ViewInvoiceModal({
  invoice,
  open,
  onOpenChange,
  onDownloadPdf,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadPdf: (invoice: Invoice) => void;
}) {
  const config = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  // Fetch payment history for this invoice
  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payment-history', invoice.id],
    queryFn: async () => {
      const response = await api.get<{ data?: any[] }>(`/invoices/${invoice.id}/payments`, {
        params: { school_id: invoice.school_id },
      });
      return (response.data || []).map(normalizePayment);
    },
    enabled: open,
  });
  const { data: refundHistory = [] } = useQuery<RefundRecord[]>({
    queryKey: ['invoice-refunds', invoice.id],
    queryFn: async () => {
      const response = await api.get<{ data?: any[] }>(`/invoices/${invoice.id}/refunds`, {
        params: { school_id: invoice.school_id },
      });
      return (response.data || []).map(normalizeRefund);
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <span>Invoice {invoice.invoice_number}</span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Date: {format(new Date(invoice.created_at), 'dd MMM yyyy')}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <Badge className={config.className}>
              <Icon className="h-3 w-3 mr-1" />
              {invoice.status === 'cancelled'
                ? `Cancelled · ${cancellationTypeLabel(invoice.cancellation_type)}`
                : config.label}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Student ID</span>
            <span className="font-mono font-medium text-primary">{invoice.student?.enrollment_number || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Student Name</span>
            <span className="font-medium">{invoice.student?.profile?.full_name || 'Unknown'}</span>
          </div>
          {invoice.student?.class_name && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Class / Section</span>
              <span className="font-medium">
                {invoice.student.class_name}{invoice.student.section ? ` (${invoice.student.section})` : ''}
              </span>
            </div>
          )}
          {invoice.payment_method && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Payment Method</span>
              <Badge variant="outline" className="capitalize">
                {invoice.payment_method.replace('_', ' ')}
              </Badge>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Title</span>
            <span className="font-medium">{invoice.title}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Original Invoice Amount</span>
            <span className="text-xl font-bold text-primary">${Number(invoice.amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount Actually Paid</span>
            <span className="font-bold text-success">${Number(invoice.amount_paid || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount Actually Refunded</span>
            <span className="font-medium text-destructive">${Number(invoice.amount_refunded || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount Waived</span>
            <span className="font-medium">${Number(invoice.amount_waived || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Net Amount Retained</span>
            <span className="font-medium">${getNetAmountRetained(invoice).toLocaleString()}</span>
          </div>
          {(() => {
            const remaining = getOutstandingBalance(invoice);
            return (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Outstanding Balance</span>
                {remaining <= 0 ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {invoice.status === 'paid' ? 'Fully Paid' : 'No balance due'}
                  </Badge>
                ) : (
                  <span className="text-lg font-bold text-destructive">${remaining.toLocaleString()}</span>
                )}
              </div>
            );
          })()}
          {invoice.status === 'cancelled' && (
            <div className="space-y-2 rounded-lg border border-muted p-3">
              <h4 className="text-sm font-semibold">Cancellation Details</h4>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{cancellationTypeLabel(invoice.cancellation_type)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Reason</span>
                <p className="mt-1 whitespace-pre-wrap">{invoice.cancellation_reason || '—'}</p>
              </div>
              {invoice.cancellation_note && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Note</span>
                  <p className="mt-1 whitespace-pre-wrap">{invoice.cancellation_note}</p>
                </div>
              )}
              {invoice.cancellation_type === 'refund_issued' && (
                <>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Total amount refunded</span>
                    <span className="font-medium">${Number(invoice.amount_refunded || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Refund processing</span>
                    <span className="font-medium">Processed</span>
                  </div>
                </>
              )}
              {invoice.cancellation_type === 'fee_waived' && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Amount waived</span>
                  <span className="font-medium">${Number(invoice.amount_waived || 0).toFixed(2)}</span>
                </div>
              )}
              {invoice.related_invoice && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Original invoice</span>
                  <span className="font-medium">{invoice.related_invoice.invoice_number}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Authorized by</span>
                <span className="font-medium">{invoice.cancellation_author?.full_name || 'Unavailable'}</span>
              </div>
              {invoice.cancelled_at && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Cancelled at</span>
                  <span>{format(new Date(invoice.cancelled_at), 'dd MMM yyyy h:mm a')}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Due Date</span>
            <span>{format(new Date(invoice.due_date + 'T00:00:00'), 'dd MMM yyyy')}</span>
          </div>
          {invoice.paid_date && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Paid Date</span>
              <span>{format(new Date(invoice.paid_date + 'T00:00:00'), 'dd MMM yyyy')}</span>
            </div>
          )}
          {invoice.description?.includes('Carry-forward') && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs font-semibold text-warning flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Includes Previous Balance
              </p>
              <p className="text-xs text-muted-foreground">
                {invoice.description.split('|').map((part, i) => (
                  <span key={i} className={i > 0 ? 'block mt-0.5 font-medium text-warning' : ''}>
                    {part.trim()}
                  </span>
                ))}
              </p>
            </div>
          )}
          {invoice.description && !invoice.description.includes('Carry-forward') && (
            <div>
              <span className="text-muted-foreground text-sm">Description</span>
              <p className="mt-1 text-sm">{invoice.description}</p>
            </div>
          )}

          {/* Payment History Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              Payment History
            </h4>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : paymentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-success">
                          +${Number(payment.amount).toLocaleString()}
                        </span>
                        {payment.payment_method && (
                          <Badge variant="outline" className="capitalize text-[10px] h-5">
                            {payment.payment_method.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {payment.recorder?.full_name && `by ${payment.recorder.full_name} · `}
                        {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {refundHistory.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-destructive" />
                Refund History
              </h4>
              <div className="space-y-2">
                {refundHistory.map((refund) => (
                  <div key={refund.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-destructive">−${refund.amount.toLocaleString()}</span>
                      <Badge variant="outline">Processed</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Payment transaction {refund.payment_history_id} · Processed {format(new Date(`${refund.refund_date}T00:00:00`), 'MMM d, yyyy')}
                    </p>
                    <p className="mt-1 text-sm">{refund.reason}</p>
                    {refund.note && <p className="mt-1 text-sm text-muted-foreground">{refund.note}</p>}
                    {refund.recorder?.full_name && (
                      <p className="text-[11px] text-muted-foreground">
                        Recorded by {refund.recorder.full_name} · {format(new Date(refund.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          {paymentHistory.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const totalPaid = Number(invoice.amount_paid || 0);
                generatePaymentHistoryPdf({
                  invoiceNumber: invoice.invoice_number,
                  invoiceTitle: invoice.title,
                  studentName: invoice.student?.profile?.full_name || 'Unknown',
                  totalAmount: Number(invoice.amount),
                  totalPaid,
                  remaining: getOutstandingBalance(invoice),
                  schoolName: invoice.school?.name,
                  payments: paymentHistory.map((p) => ({
                    amount: Number(p.amount),
                    payment_method: p.payment_method,
                    created_at: p.created_at,
                    recorder_name: p.recorder?.full_name || null,
                    notes: p.notes || null,
                  })),
                });
              }}
            >
              <FileText className="h-4 w-4" />
              Export History PDF
            </Button>
          )}
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => onDownloadPdf(invoice)}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Record Payment Dialog Component
function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSubmit: (data: { id: string; paymentAmount: number; paymentMethod?: string; notes?: string }) => void;
  isLoading: boolean;
}) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || '');
  const [notes, setNotes] = useState('');

  const currentPaid = Number(invoice.amount_paid || 0);
  const totalAmount = Number(invoice.amount);
  const currentRemaining = totalAmount - currentPaid;
  const enteredAmount = parseFloat(paymentAmount || '0');
  const newRemaining = currentRemaining - enteredAmount;

  const paymentMethods = [
    { value: 'zaad', label: 'Zaad' },
    { value: 'sahal', label: 'Sahal' },
    { value: 'evc_plus', label: 'EVC Plus' },
    { value: 'edahab', label: 'eDahab' },
    { value: 'cash', label: 'Cash' },
    { value: 'ebirr', label: 'eBirr' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredAmount <= 0) return;
    onSubmit({
      id: invoice.id,
      paymentAmount: enteredAmount,
      paymentMethod: paymentMethod || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Invoice #{invoice.invoice_number} · {invoice.student?.profile?.full_name || 'Unknown'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current balance summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Fee</span>
              <span className="font-semibold">${totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-medium text-success">${currentPaid.toLocaleString()}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between">
              <span className="text-muted-foreground font-medium">Outstanding</span>
              <span className="font-bold text-destructive">${currentRemaining.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount ($)</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={currentRemaining}
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              placeholder="e.g. Receipt #1234, partial payment for term 2..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="resize-none h-16 text-sm"
            />
          </div>

          {/* New balance preview */}
          {enteredAmount > 0 && (
            <div className={cn(
              "rounded-lg border p-2 text-xs",
              newRemaining <= 0
                ? "border-success/30 bg-success/5 text-success"
                : "border-warning/30 bg-warning/5"
            )}>
              {newRemaining <= 0 ? (
                <span className="font-medium">✓ This payment will fully settle the invoice</span>
              ) : (
                <>
                  <span className="text-muted-foreground">After payment, remaining: </span>
                  <span className="font-bold text-destructive">${newRemaining.toLocaleString()}</span>
                </>
              )}
            </div>
          )}

          {enteredAmount > currentRemaining && (
            <p className="text-xs text-destructive">Amount exceeds outstanding balance</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isLoading || enteredAmount <= 0 || enteredAmount > currentRemaining}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
