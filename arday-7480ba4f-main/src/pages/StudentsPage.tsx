import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameMonth, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRightLeft,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  EyeOff,
  FileUp,
  GraduationCap,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddStudentModal } from '@/components/users/AddStudentModal';
import { BulkImportStudentsModal } from '@/components/users/BulkImportStudentsModal';
import { EditStudentModal } from '@/components/users/EditStudentModal';
import { ExportStudentDataModal } from '@/components/users/ExportStudentDataModal';
import { ImportStudentDataModal } from '@/components/users/ImportStudentDataModal';
import { TransferStudentsModal } from '@/components/users/TransferStudentsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useArchiveUser } from '@/hooks/useArchivedUsers';
import { useClasses } from '@/hooks/useClasses';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { StudentWithProfile, useStudents } from '@/hooks/useStudents';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getStudentStatusCounts } from '@/lib/studentStatus';
import { getOutstandingBalance } from '@/lib/invoiceFinancials';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';

interface InvoiceRow {
  id: string;
  studentId?: string;
  student_id?: string;
  amount: number | string;
  amountPaid?: number | string;
  amount_paid?: number | string;
  amountWaived?: number | string;
  amount_waived?: number | string;
  dueDate?: string;
  due_date?: string;
  createdAt?: string;
  created_at?: string;
  currency?: string;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function getInitials(name?: string | null, email?: string | null): string {
  const value = name?.trim() || email?.trim() || '';
  return value.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'ST';
}

function getStudentClassName(student: StudentWithProfile): string {
  return student.classStudents.map(({ class: studentClass }) => studentClass.name).join(', ') || '—';
}

function getStudentEnrollmentDate(student: StudentWithProfile): Date | null {
  const date = student.start_date || student.created_at;
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type SortKey = 'student' | 'class' | 'grade' | 'enrollment' | 'start' | 'status' | 'fee' | 'balance';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { currentSchoolId } = useSchoolContext();
  const { primaryRole, isSuperAdmin } = useAuth();
  const isTeacher = primaryRole === 'teacher';
  const canManageStudents = isSuperAdmin || primaryRole === 'school_admin';
  const [classFilter, setClassFilter] = useState('all');
  const { data: students = [], isLoading, error } = useStudents(canManageStudents, classFilter === 'all' ? undefined : classFilter);
  const { data: classes = [], isError: classesError, error: classesLoadError } = useClasses();
  const archiveStudent = useArchiveUser();
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [periodMonth, setPeriodMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'student', direction: 'asc' });
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImportData, setShowImportData] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<StudentWithProfile | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentWithProfile | null>(null);
  const pageSize = 25;

  useEffect(() => {
    setClassFilter('all');
    setPage(1);
  }, [currentSchoolId]);

  useEffect(() => {
    setPage(1);
  }, [search, gradeFilter, genderFilter, statusFilter, classFilter, periodMonth]);

  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError } = useQuery({
    queryKey: ['school-invoices', currentSchoolId],
    queryFn: async () => {
      const { data } = await api.get<{ data?: InvoiceRow[] }>('/invoices', { params: { school_id: currentSchoolId || undefined, limit: 1000 } });
      return data || [];
    },
    enabled: canManageStudents && !!currentSchoolId,
  });

  const periodLabel = format(new Date(`${periodMonth}-01T00:00:00`), 'MMMM yyyy');
  const periodInvoices = invoices.filter((invoice) => {
    const created = invoice.createdAt || invoice.created_at || invoice.dueDate || invoice.due_date;
    if (!created) return false;
    const date = typeof created === 'string' ? parseISO(created) : new Date(created);
    return !Number.isNaN(date.getTime()) && isSameMonth(date, new Date(`${periodMonth}-01T00:00:00`));
  });
  const periodOutstanding = [...new Set(periodInvoices.map((invoice) => {
    const amount = getOutstandingBalance({
      amount: invoice.amount,
      amount_paid: invoice.amountPaid ?? invoice.amount_paid,
      amount_waived: invoice.amountWaived ?? invoice.amount_waived,
    });
    return formatMoney(amount, invoice.currency || 'USD');
  }))];
  const defaultCurrency = invoices[0]?.currency || 'USD';

  const effectiveFeeMap = useMemo(() => Object.fromEntries(students.map((student) => {
    const override = student.studentFeeOverrides?.[0]?.monthlyFee;
    const classFee = student.classStudents.find(({ class: studentClass }) => studentClass.monthlyFee != null)?.class.monthlyFee;
    const amount = override ?? classFee;
    return [student.id, amount == null ? undefined : { amount }];
  })), [students]);
  const balanceMap = useMemo(() => {
    const balances: Record<string, { outstanding: number }> = {};
    for (const invoice of invoices) {
      const studentId = invoice.studentId || invoice.student_id;
      if (!studentId) continue;
      balances[studentId] ??= { outstanding: 0 };
      balances[studentId].outstanding += getOutstandingBalance({
        amount: invoice.amount,
        amount_paid: invoice.amountPaid ?? invoice.amount_paid,
        amount_waived: invoice.amountWaived ?? invoice.amount_waived,
      });
    }
    return balances;
  }, [invoices]);

  const grades = useMemo(() => [...new Set(students.map((student) => student.grade).filter((grade): grade is string => !!grade))].sort(), [students]);
  const genders = useMemo(() => [...new Set(students.map((student) => student.gender).filter((gender): gender is string => !!gender))].sort(), [students]);
  const statusCounts = currentSchoolId ? getStudentStatusCounts(students, currentSchoolId) : { total: 0, active: 0, inactive: 0 };
  const stats = {
    ...statusCounts,
    male: students.filter((student) => student.gender?.toLowerCase() === 'male').length,
    female: students.filter((student) => student.gender?.toLowerCase() === 'female').length,
    newThisMonth: students.filter((student) => {
      const date = getStudentEnrollmentDate(student);
      return date && isSameMonth(date, new Date());
    }).length,
    newInPeriod: students.filter((student) => {
      const date = getStudentEnrollmentDate(student);
      return date && isSameMonth(date, new Date(`${periodMonth}-01T00:00:00`));
    }).length,
    graduated: 'N/A',
  };

  const filteredStudents = useMemo(() => students.filter((student) => {
    const name = student.profile?.full_name || '';
    const email = student.profile?.email || '';
    const matchesSearch = !search || [name, email, student.enrollment_number, getStudentClassName(student)]
      .some((value) => value?.toLowerCase().includes(search.toLowerCase()));
    const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;
    const matchesGender = genderFilter === 'all' || student.gender?.toLowerCase() === genderFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && !student.archived_at)
      || (statusFilter === 'inactive' && !!student.archived_at)
      || (statusFilter === 'new' && !student.archived_at);
    const matchesPeriod = statusFilter !== 'new' || (() => {
      const date = getStudentEnrollmentDate(student);
      return !!date && isSameMonth(date, new Date(`${periodMonth}-01T00:00:00`));
    })();
    return matchesSearch && matchesGrade && matchesGender && matchesStatus && matchesPeriod;
  }), [students, search, gradeFilter, genderFilter, statusFilter, periodMonth]);

  const sortedStudents = useMemo(() => [...filteredStudents].sort((a, b) => {
    const getValue = (student: StudentWithProfile): string | number => {
      switch (sort.key) {
        case 'student': return student.profile?.full_name || '';
        case 'class': return getStudentClassName(student);
        case 'grade': return student.grade || '';
        case 'enrollment': return student.enrollment_number || '';
        case 'start': return getStudentEnrollmentDate(student)?.getTime() || 0;
        case 'status': return student.archived_at ? 0 : 1;
        case 'fee': return effectiveFeeMap[student.id]?.amount || 0;
        case 'balance': return balanceMap[student.id]?.outstanding || 0;
      }
    };
    const left = getValue(a);
    const right = getValue(b);
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [filteredStudents, sort, effectiveFeeMap, balanceMap]);
  const pageCount = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const paginatedStudents = sortedStudents.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  };
  const handleDelete = async () => {
    if (!studentToDelete) return;
    await archiveStudent.mutateAsync({
      originalId: studentToDelete.id,
      userId: studentToDelete.user_id,
      schoolId: studentToDelete.school_id,
      userType: 'student',
      fullName: studentToDelete.profile?.full_name ?? null,
      email: studentToDelete.profile?.email ?? null,
      phone: studentToDelete.profile?.phone ?? null,
      avatarUrl: studentToDelete.profile?.avatar_url ?? null,
      metadata: { enrollmentNumber: studentToDelete.enrollment_number, grade: studentToDelete.grade },
    });
    setStudentToDelete(null);
  };

  const columnWidths = {
    checkbox: 'min-w-[40px] w-[40px]',
    student: 'min-w-[200px] w-[200px]',
    class: 'min-w-[120px] w-[120px]',
    grade: 'min-w-[80px] w-[80px]',
    enrollment: 'min-w-[150px] w-[150px]',
    start: 'min-w-[110px] w-[110px]',
    status: 'min-w-[90px] w-[90px]',
    fee: 'min-w-[120px] w-[120px]',
    balance: 'min-w-[120px] w-[120px]',
    actions: 'min-w-[80px] w-[80px]',
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)]">
        <div className="flex-shrink-0">
          <PageHeader
            title={isTeacher ? "My Students" : "Students"}
            description={isTeacher ? "Students in your classes" : "Manage school students"}
            breadcrumbs={[{ label: isTeacher ? 'My Students' : 'Students' }]}
          />

          <section className="mb-2" aria-label="Student statistics">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Student overview</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={statsCollapsed ? 'Show Statistics' : 'Hide Statistics'}
                      aria-expanded={!statsCollapsed}
                      onClick={() => setStatsCollapsed((collapsed) => !collapsed)}
                      className="h-8 w-8"
                    >
                      {statsCollapsed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center">
                    {statsCollapsed ? 'Show Statistics' : 'Hide Statistics'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className={cn('grid overflow-hidden transition-[max-height,opacity] duration-300', statsCollapsed ? 'max-h-0 opacity-0' : 'max-h-[520px] opacity-100 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1.5')}>
              {([
                { label: 'Total Students', value: stats.total, icon: Users, filter: () => { setSearch(''); setGradeFilter('all'); setStatusFilter('all'); setGenderFilter('all'); setClassFilter('all'); } },
                { label: 'Active', value: stats.active, icon: UserRound, filter: () => { setSearch(''); setGradeFilter('all'); setGenderFilter('all'); setStatusFilter('active'); } },
                { label: 'Inactive', value: stats.inactive, icon: Archive, filter: () => { setSearch(''); setGradeFilter('all'); setGenderFilter('all'); setStatusFilter('inactive'); } },
                { label: 'Male', value: stats.male, icon: UserRound, filter: () => { setSearch(''); setGradeFilter('all'); setStatusFilter('active'); setGenderFilter('male'); } },
                { label: 'Female', value: stats.female, icon: UserRound, filter: () => { setSearch(''); setGradeFilter('all'); setStatusFilter('active'); setGenderFilter('female'); } },
                { label: 'New This Month', value: stats.newThisMonth, icon: UserPlus, filter: () => { setPeriodMonth(format(new Date(), 'yyyy-MM')); setStatusFilter('new'); } },
                { label: 'Graduated', value: stats.graduated, icon: GraduationCap, filter: () => undefined },
              ]).map(({ label, value, icon: Icon, filter }) => (
                <button key={label} type="button" onClick={filter} disabled={label === 'Graduated' && value === 'N/A'} className="text-left rounded-lg border bg-card p-2.5 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70">
                  <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                  <span className="block text-[11px] text-muted-foreground">{label}</span>
                  <span className="block text-base font-semibold leading-tight">{value}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="mb-3 flex flex-col gap-1.5 rounded-lg border bg-muted/20 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Reporting period</span>
              <Input aria-label="Reporting month" type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} className="h-7 w-auto min-w-[140px] text-xs" />
              <span className="hidden text-muted-foreground sm:inline">{periodLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground"><span className="font-medium text-foreground">New in Period:</span> {stats.newInPeriod}</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3.5 w-3.5 text-primary" /><span className="font-medium text-foreground">Outstanding:</span>
                {!canManageStudents || !currentSchoolId ? '—' : invoicesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : invoicesError ? 'Unavailable' : periodOutstanding.length ? periodOutstanding.join(' · ') : formatMoney(0, invoices[0]?.currency || 'USD')}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search students by name, email, enrollment number, or class..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="new">New in Period</SelectItem></SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Filter by gender" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Genders</SelectItem>{genders.map((gender) => <SelectItem key={gender} value={gender}>{gender[0].toUpperCase() + gender.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Filter by grade" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Grades</SelectItem>{grades.map((grade) => <SelectItem key={grade} value={grade!}>{grade}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={(value) => { setClassFilter(value); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Filter by class" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Classes</SelectItem>{(currentSchoolId ? classes : []).map((studentClass) => <SelectItem key={studentClass.id} value={studentClass.id}>{studentClass.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {classesError && <p role="alert" className="text-xs text-destructive">Unable to load classes: {classesLoadError instanceof Error ? classesLoadError.message : 'Please try again.'}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {canManageStudents && (
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" onClick={() => setShowExport(true)} className="gap-1.5 h-8 text-xs px-3">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportData(true)} className="gap-1.5 h-8 text-xs px-3">
                    <FileUp className="h-3.5 w-3.5" />
                    Import
                  </Button>
                  <Button variant="outline" onClick={() => setShowTransfer(true)} className="gap-1.5 h-8 text-xs px-3">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transfer
                  </Button>
                  <Button variant="outline" onClick={() => setShowBulkImport(true)} className="gap-1.5 h-8 text-xs px-3">
                    <Upload className="h-3.5 w-3.5" />
                    Quick Add CSV
                  </Button>
                  <Button onClick={() => setShowAddModal(true)} className="gap-1.5 h-8 text-xs px-3">
                    <Plus className="h-3.5 w-3.5" />
                    Add Student
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><GraduationCap className="h-8 w-8 text-destructive" /></div>
            <h2 className="mb-1 text-lg font-semibold">Error loading students</h2>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : (
          <Card className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              <div ref={headerScrollRef} className="overflow-x-auto overflow-y-hidden border-b bg-muted/30">
                <div className="flex min-w-full [&>*]:px-3 [&>*]:py-2 [&>*]:text-left [&>*]:text-xs [&>*]:font-medium [&>*]:text-muted-foreground [&>*]:whitespace-nowrap">
                  <div className={cn(columnWidths.checkbox)}>
                    <Checkbox aria-label="Select all students on this page" checked={paginatedStudents.length > 0 && paginatedStudents.every((student) => selectedStudentIds.has(student.id))} onCheckedChange={(checked) => setSelectedStudentIds((current) => { const next = new Set(current); for (const student of paginatedStudents) { if (checked === true) next.add(student.id); else next.delete(student.id); } return next; })} />
                  </div>
                  <button type="button" onClick={() => toggleSort('student')} className={cn(columnWidths.student, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Student<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('class')} className={cn(columnWidths.class, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Class<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('grade')} className={cn(columnWidths.grade, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Grade<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('enrollment')} className={cn(columnWidths.enrollment, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Enrollment Number<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('start')} className={cn(columnWidths.start, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Start Date<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('status')} className={cn(columnWidths.status, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Status<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('fee')} className={cn(columnWidths.fee, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Monthly Fee<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleSort('balance')} className={cn(columnWidths.balance, 'inline-flex items-center gap-1 hover:text-foreground')}>
                    Balance<ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <div className={cn(columnWidths.actions, 'text-right')}>
                    Actions
                  </div>
                </div>
              </div>

              <div ref={bodyScrollRef} className="flex-1 overflow-auto">
                {paginatedStudents.map((student) => {
                  const enrollmentDate = getStudentEnrollmentDate(student);
                  const outstanding = balanceMap[student.id]?.outstanding || 0;
                  return (
                    <div key={student.id} className="flex min-w-full border-b hover:bg-muted/50 [&>*]:px-3 [&>*]:py-2 [&>*]:text-sm">
                      <div className={cn(columnWidths.checkbox, 'flex items-center')}>
                        <Checkbox aria-label={`Select ${student.profile?.full_name || 'student'}`} checked={selectedStudentIds.has(student.id)} onCheckedChange={(checked) => setSelectedStudentIds((current) => { const next = new Set(current); if (checked === true) next.add(student.id); else next.delete(student.id); return next; })} />
                      </div>
                      <div className={cn(columnWidths.student)}>
                        <button type="button" onClick={() => navigate(`/students/${student.id}`)} className="flex items-center gap-2 text-left">
                          <Avatar className="h-8 w-8"><AvatarImage src={student.profile?.avatar_url || undefined} /><AvatarFallback className="bg-student/10 text-student text-[10px] font-medium">{getInitials(student.profile?.full_name, student.profile?.email)}</AvatarFallback></Avatar>
                          <span className="min-w-0"><span className="block truncate font-medium text-sm">{student.profile?.full_name || 'Unnamed Student'}</span><span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">{student.profile?.email || '—'}</span></span>
                        </button>
                      </div>
                      <div className={cn(columnWidths.class, 'flex items-center whitespace-nowrap')}>{getStudentClassName(student)}</div>
                      <div className={cn(columnWidths.grade, 'flex items-center whitespace-nowrap')}>{student.grade || '—'}</div>
                      <div className={cn(columnWidths.enrollment, 'flex items-center whitespace-nowrap')}>{student.enrollment_number || '—'}</div>
                      <div className={cn(columnWidths.start, 'flex items-center whitespace-nowrap')}>{enrollmentDate ? format(enrollmentDate, 'dd/MM/yyyy') : '—'}</div>
                      <div className={cn(columnWidths.status, 'flex items-center')}><Badge variant="secondary" className={student.archived_at ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100' : 'bg-success/10 text-success'}>{student.archived_at ? 'Inactive' : 'Active'}</Badge></div>
                      <div className={cn(columnWidths.fee, 'flex items-center whitespace-nowrap')}>{canManageStudents && effectiveFeeMap[student.id] ? formatMoney(effectiveFeeMap[student.id].amount, defaultCurrency) + '/mo' : '—'}</div>
                      <div className={cn(columnWidths.balance, 'flex items-center whitespace-nowrap', outstanding > 0 && 'font-medium text-destructive')}>{canManageStudents ? formatMoney(outstanding, defaultCurrency) : '—'}</div>
                      <div className={cn(columnWidths.actions, 'flex items-center justify-end')}>
                        {canManageStudents && !student.archived_at && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${student.profile?.full_name || 'student'}`}><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="gap-2" onClick={() => navigate(`/students/${student.id}`)}><Search className="h-3.5 w-3.5" />View Profile</DropdownMenuItem><DropdownMenuItem className="gap-2" onClick={() => setStudentToEdit(student)}><Edit className="h-3.5 w-3.5" />Edit</DropdownMenuItem><DropdownMenuItem className="gap-2 text-destructive" onClick={() => setStudentToDelete(student)}><Trash2 className="h-3.5 w-3.5" />Remove</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
                      </div>
                    </div>
                  );
                })}
                {paginatedStudents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No students found</p>
                    <p className="text-sm text-muted-foreground">{search || gradeFilter !== 'all' || genderFilter !== 'all' || statusFilter !== 'all' || classFilter !== 'all' ? 'Try adjusting your filters' : isTeacher ? 'No students are enrolled in your classes yet' : 'Students will appear here once enrolled'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-1.5 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">{filteredStudents.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredStudents.length)} of ${filteredStudents.length} students` : '0 students'}{selectedStudentIds.size > 0 && ` · ${selectedStudentIds.size} selected`}</span>
              <div className="flex items-center gap-1.5"><Button variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-7 px-2"><ChevronLeft className="h-3.5 w-3.5" /></Button><span>Page {page} of {pageCount}</span><Button variant="outline" size="sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="h-7 px-2"><ChevronRight className="h-3.5 w-3.5" /></Button></div>
            </div>
          </Card>
        )}
      </div>

      {canManageStudents && (
        <>
          <AlertDialog open={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove <strong>{studentToDelete?.profile?.full_name}</strong> from the school? Their record will be archived and can be restored later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AddStudentModal open={showAddModal} onOpenChange={setShowAddModal} />
          <BulkImportStudentsModal open={showBulkImport} onOpenChange={setShowBulkImport} />
          <TransferStudentsModal open={showTransfer} onOpenChange={setShowTransfer} students={students || []} />
          <ExportStudentDataModal open={showExport} onOpenChange={setShowExport} />
          <ImportStudentDataModal open={showImportData} onOpenChange={setShowImportData} />

          {studentToEdit && (
            <EditStudentModal
              open={!!studentToEdit}
              onOpenChange={(open) => !open && setStudentToEdit(null)}
              student={studentToEdit}
            />
          )}
        </>
      )}
    </DashboardLayout>
  );
}