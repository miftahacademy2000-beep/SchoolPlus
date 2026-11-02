import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, DollarSign, CheckCircle, Users, ChevronDown, ChevronRight, X, Download, FileText, FileSpreadsheet, Printer, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractStudentIdNum } from '@/lib/studentSorting';
import { getOutstandingBalance } from '@/lib/invoiceFinancials';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import {
  exportClassPaymentsPdf,
  exportClassPaymentsCsv,
  printClassPayments,
  type ClassStudentBalance,
} from '@/lib/classPaymentsExport';

interface Invoice {
  id: string;
  amount: number;
  amount_paid: number;
  amount_waived?: number;
  status: string;
  due_date: string;
  student_id: string;
  student?: {
    id: string;
    grade: string | null;
    enrollment_number: string | null;
    class_name?: string | null;
    section?: string | null;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
}

interface StudentBalance {
  studentId: string;
  name: string;
  enrollmentNumber: string | null;
  grade: string | null;
  className: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  invoiceCount: number;
  unpaidCount: number;
}

interface StudentBalancesSectionProps {
  invoices: Invoice[];
  selectedMonth?: Date;
  periodMode?: 'monthly' | 'yearly';
}

export function StudentBalancesSection({ invoices, selectedMonth, periodMode = 'monthly' }: StudentBalancesSectionProps) {
  const [search, setSearch] = useState('');
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});
  const [classSearches, setClassSearches] = useState<Record<string, string>>({});
  const [exportDateRange, setExportDateRange] = useState<Record<string, { from?: Date; to?: Date }>>({});
  const [exportPopoverOpen, setExportPopoverOpen] = useState<Record<string, boolean>>({});

  const periodInvoices = useMemo(() => {
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

  const periodLabel = selectedMonth
    ? periodMode === 'yearly'
      ? format(selectedMonth, 'yyyy')
      : format(startOfMonth(selectedMonth), 'MMMM yyyy')
    : 'All Time';

  const resolveClassName = (inv: Invoice): string => {
    if (inv.student?.class_name) return inv.student.class_name;
    if (inv.student?.section) return inv.student.section;
    return 'Unassigned';
  };

  const studentBalances = useMemo(() => {
    const map = new Map<string, StudentBalance>();

    for (const inv of periodInvoices) {
      if (!inv.student_id) continue;

      if (!map.has(inv.student_id)) {
        map.set(inv.student_id, {
          studentId: inv.student_id,
          name: inv.student?.profile?.full_name || 'Unknown',
          enrollmentNumber: inv.student?.enrollment_number || null,
          grade: inv.student?.grade || null,
          className: resolveClassName(inv),
          totalAmount: 0,
          paidAmount: 0,
          outstanding: 0,
          invoiceCount: 0,
          unpaidCount: 0,
        });
      }

      const entry = map.get(inv.student_id)!;
      entry.totalAmount += Number(inv.amount);
      entry.invoiceCount += 1;
      const paid = Number(inv.amount_paid || 0);
      entry.paidAmount += paid;
      const remaining = getOutstandingBalance(inv);
      if (remaining > 0) {
        entry.outstanding += remaining;
        entry.unpaidCount += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const numA = extractStudentIdNum(a.enrollmentNumber);
      const numB = extractStudentIdNum(b.enrollmentNumber);
      return numA - numB;
    });
  }, [periodInvoices]);

  const globalFiltered = studentBalances.filter((s) => {
    if (showOutstandingOnly && s.outstanding <= 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.enrollmentNumber?.toLowerCase().includes(q)
    );
  });

  // Group by class
  const classGroups = useMemo(() => {
    const groups = new Map<string, StudentBalance[]>();
    for (const s of globalFiltered) {
      const key = s.className;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [globalFiltered]);

  const filterByClassSearch = (students: StudentBalance[], className: string) => {
    const q = (classSearches[className] || '').toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.enrollmentNumber?.toLowerCase().includes(q)
    );
  };

  const toggleClass = (className: string) => {
    setOpenClasses((prev) => ({ ...prev, [className]: !prev[className] }));
  };

  const handleClassExport = (className: string, students: StudentBalance[], type: 'pdf' | 'csv' | 'print') => {
    const range = exportDateRange[className];
    let label = periodLabel;

    // If a custom date range is set, re-filter invoices for this class's students
    let exportStudentData: ClassStudentBalance[];
    if (range?.from || range?.to) {
      const studentIds = new Set(students.map(s => s.studentId));
      const rangeInvoices = invoices.filter(inv => {
        if (!studentIds.has(inv.student_id)) return false;
        const due = new Date(inv.due_date + 'T00:00:00');
        if (range.from && due < range.from) return false;
        if (range.to && due > range.to) return false;
        return true;
      });

      // Rebuild balances from filtered invoices
      const map = new Map<string, ClassStudentBalance>();
      for (const s of students) {
        map.set(s.studentId, { name: s.name, enrollmentNumber: s.enrollmentNumber, totalAmount: 0, paidAmount: 0, outstanding: 0, unpaidCount: 0 });
      }
      for (const inv of rangeInvoices) {
        const entry = map.get(inv.student_id);
        if (!entry) continue;
        entry.totalAmount += Number(inv.amount);
        const paid = Number(inv.amount_paid || 0);
        entry.paidAmount += paid;
        const rem = getOutstandingBalance(inv);
        if (rem > 0) { entry.outstanding += rem; entry.unpaidCount += 1; }
      }
      exportStudentData = Array.from(map.values());
      const fromStr = range.from ? format(range.from, 'dd/MM/yyyy') : '...';
      const toStr = range.to ? format(range.to, 'dd/MM/yyyy') : '...';
      label = `${fromStr} – ${toStr}`;
    } else {
      exportStudentData = students.map((s) => ({
        name: s.name,
        enrollmentNumber: s.enrollmentNumber,
        totalAmount: s.totalAmount,
        paidAmount: s.paidAmount,
        outstanding: s.outstanding,
        unpaidCount: s.unpaidCount,
      }));
    }

    const data = { className, students: exportStudentData, periodLabel: label };
    if (type === 'pdf') exportClassPaymentsPdf(data);
    else if (type === 'csv') exportClassPaymentsCsv(data);
    else printClassPayments(data);
  };

  const totalOutstanding = studentBalances.reduce((s, b) => s + b.outstanding, 0);
  const studentsWithBalance = studentBalances.filter((b) => b.outstanding > 0).length;

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="mb-6">
      <button
        onClick={() => setSectionOpen((o) => !o)}
        className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors mb-3"
      >
        <div className="flex items-center gap-2">
          {sectionOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Users className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Student Balances</h2>
          <Badge variant="outline" className="text-xs font-normal ml-1">
            {periodLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            ${totalOutstanding.toLocaleString()} total outstanding
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {studentsWithBalance} with balance
          </Badge>
        </div>
      </button>

      {!sectionOpen ? null : (<>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="outstanding-filter"
              checked={showOutstandingOnly}
              onCheckedChange={setShowOutstandingOnly}
            />
            <Label htmlFor="outstanding-filter" className="text-sm text-muted-foreground cursor-pointer">
              Outstanding only
            </Label>
          </div>
        </div>

        {classGroups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No student balances found{selectedMonth ? ` for ${periodLabel}` : ''}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {classGroups.map(([className, students]) => {
              const isOpen = openClasses[className] ?? false;
              const classFiltered = filterByClassSearch(students, className);
              const classOutstanding = classFiltered.reduce((s, b) => s + b.outstanding, 0);
              const classWithBalance = classFiltered.filter((b) => b.outstanding > 0).length;
              const classSearch = classSearches[className] || '';

              return (
                <Card key={className} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-muted/30">
                    <button
                      onClick={() => toggleClass(className)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-foreground">{className}</span>
                      <Badge variant="outline" className="text-xs">
                        {students.length} student{students.length !== 1 ? 's' : ''}
                      </Badge>
                    </button>
                    <div className="flex items-center gap-2">
                      {classWithBalance > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${classOutstanding.toLocaleString()}
                        </Badge>
                      )}
                      {classWithBalance === 0 && (
                        <Badge className="bg-success/10 text-success border-success/20 text-xs gap-1">
                          <CheckCircle className="h-3 w-3" />
                          All Paid
                        </Badge>
                      )}
                      <Popover
                        open={exportPopoverOpen[className] ?? false}
                        onOpenChange={(open) => setExportPopoverOpen(prev => ({ ...prev, [className]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
                            <Download className="h-3 w-3" />
                            Export
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-auto p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-3">
                            <p className="text-xs font-medium text-foreground">Date Range (optional)</p>
                            <div className="flex items-center gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 min-w-[110px] justify-start">
                                    <CalendarIcon className="h-3 w-3" />
                                    {exportDateRange[className]?.from
                                      ? format(exportDateRange[className].from!, 'dd/MM/yyyy')
                                      : 'From'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={exportDateRange[className]?.from}
                                    onSelect={(d) => setExportDateRange(prev => ({
                                      ...prev,
                                      [className]: { ...prev[className], from: d || undefined }
                                    }))}
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              <span className="text-xs text-muted-foreground">–</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 min-w-[110px] justify-start">
                                    <CalendarIcon className="h-3 w-3" />
                                    {exportDateRange[className]?.to
                                      ? format(exportDateRange[className].to!, 'dd/MM/yyyy')
                                      : 'To'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={exportDateRange[className]?.to}
                                    onSelect={(d) => setExportDateRange(prev => ({
                                      ...prev,
                                      [className]: { ...prev[className], to: d || undefined }
                                    }))}
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              {(exportDateRange[className]?.from || exportDateRange[className]?.to) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setExportDateRange(prev => ({ ...prev, [className]: {} }))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="border-t pt-2 space-y-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs"
                                onClick={() => { handleClassExport(className, classFiltered, 'csv'); setExportPopoverOpen(prev => ({ ...prev, [className]: false })); }}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                Excel (CSV)
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs"
                                onClick={() => { handleClassExport(className, classFiltered, 'pdf'); setExportPopoverOpen(prev => ({ ...prev, [className]: false })); }}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                PDF
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs"
                                onClick={() => { handleClassExport(className, classFiltered, 'print'); setExportPopoverOpen(prev => ({ ...prev, [className]: false })); }}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                Print
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {isOpen && (
                    <CardContent className="p-3 pt-2">
                      {/* Per-class search */}
                      <div className="relative max-w-xs mb-3">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search in this class..."
                          value={classSearch}
                          onChange={(e) =>
                            setClassSearches((prev) => ({ ...prev, [className]: e.target.value }))
                          }
                          className="pl-9 h-8 text-sm"
                        />
                        {classSearch && (
                          <button
                            onClick={() => setClassSearches((prev) => ({ ...prev, [className]: '' }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {classSearch && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Found {classFiltered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                        </p>
                      )}

                      {classFiltered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No matching students found in {className}.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {classFiltered.map((student) => {
                            const isPaid = student.outstanding <= 0;
                            return (
                              <Card
                                key={student.studentId}
                                className={cn(
                                  'transition-all hover:shadow-md border',
                                  isPaid && 'opacity-75'
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-border">
                                      <AvatarFallback
                                        className={cn(
                                          'text-xs font-medium',
                                          isPaid
                                            ? 'bg-success/10 text-success'
                                            : 'bg-destructive/10 text-destructive'
                                        )}
                                      >
                                        {getInitials(student.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium text-foreground truncate text-sm">
                                          {student.enrollmentNumber && (
                                            <span className="font-mono text-primary mr-1">
                                              {student.enrollmentNumber}
                                            </span>
                                          )}
                                          {student.name}
                                        </p>
                                      </div>
                                      {student.grade && (
                                        <p className="text-xs text-muted-foreground">
                                          Grade {student.grade}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0">
                                      {isPaid ? (
                                        <Badge className="bg-success/10 text-success border-success/20 gap-1">
                                          <CheckCircle className="h-3 w-3" />
                                          Paid
                                        </Badge>
                                      ) : (
                                        <div>
                                          <p className="text-sm font-bold text-destructive">
                                            ${student.outstanding.toLocaleString()}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {student.unpaidCount} unpaid
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {student.totalAmount > 0 && (
                                    <div className="mt-3">
                                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                        <span>Paid: ${student.paidAmount.toLocaleString()}</span>
                                        <span>Total: ${student.totalAmount.toLocaleString()}</span>
                                      </div>
                                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            'h-full rounded-full transition-all',
                                            isPaid ? 'bg-success' : 'bg-primary'
                                          )}
                                          style={{
                                            width: `${Math.min((student.paidAmount / student.totalAmount) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </>)}
    </div>
  );
}
