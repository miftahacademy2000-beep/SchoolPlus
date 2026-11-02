import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Search, AlertTriangle, Download, FileSpreadsheet, Clock, AlertCircle, X, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractStudentIdNum } from '@/lib/studentSorting';
import { getOutstandingBalance } from '@/lib/invoiceFinancials';
import {
  generateOutstandingReportPdf,
  generateOutstandingReportCsv,
  OutstandingStudent,
} from '@/lib/generateOutstandingReportPdf';

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  amount: number;
  amount_paid?: number;
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
  school?: {
    name: string;
  } | null;
}

interface ComputedInvoice extends Invoice {
  computedStatus: 'overdue' | 'pending' | 'cancelled';
  className: string;
}

interface ClassGroup {
  className: string;
  invoices: ComputedInvoice[];
  totalAmount: number;
  overdueCount: number;
  pendingCount: number;
  cancelledCount: number;
}

interface OutstandingPaymentsSectionProps {
  invoices: Invoice[];
}

export function OutstandingPaymentsSection({ invoices }: OutstandingPaymentsSectionProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'cancelled'>('all');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [sectionOpen, setSectionOpen] = useState(false);
  const [classSearches, setClassSearches] = useState<Record<string, string>>({});

  const setClassSearch = (className: string, value: string) => {
    setClassSearches((prev) => ({ ...prev, [className]: value }));
  };

  const filterByClassSearch = (invoiceList: ComputedInvoice[], className: string) => {
    const q = (classSearches[className] || '').toLowerCase();
    if (!q) return invoiceList;
    return invoiceList.filter((inv) =>
      inv.student?.profile?.full_name?.toLowerCase().includes(q) ||
      inv.student?.enrollment_number?.toLowerCase().includes(q) ||
      inv.invoice_number.toLowerCase().includes(q)
    );
  };

  const outstandingInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return invoices
      .filter((inv) => getOutstandingBalance(inv) > 0)
      .map((inv): ComputedInvoice => {
        const dueDate = new Date(inv.due_date + 'T00:00:00');
        const isCancelled = inv.status === 'cancelled';
        const isOverdue = !isCancelled && (inv.status === 'overdue' || dueDate < today);
        const className = inv.student?.class_name
          ? inv.student.section
            ? `${inv.student.class_name} (${inv.student.section})`
            : inv.student.class_name
          : 'Unassigned';
        return { ...inv, computedStatus: isCancelled ? 'cancelled' : isOverdue ? 'overdue' : 'pending', className };
      })
      .sort((a, b) => {
        const numA = extractStudentIdNum(a.student?.enrollment_number);
        const numB = extractStudentIdNum(b.student?.enrollment_number);
        if (numA !== numB) return numA - numB;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
  }, [invoices]);

  const filtered = useMemo(() => {
    return outstandingInvoices.filter((inv) => {
      if (filter !== 'all' && inv.computedStatus !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        inv.student?.profile?.full_name?.toLowerCase().includes(q) ||
        inv.student?.enrollment_number?.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.className.toLowerCase().includes(q)
      );
    });
  }, [outstandingInvoices, search, filter]);

  // Group by class
  const classGroups = useMemo((): ClassGroup[] => {
    const map = new Map<string, ComputedInvoice[]>();
    filtered.forEach((inv) => {
      const list = map.get(inv.className) || [];
      list.push(inv);
      map.set(inv.className, list);
    });
    return Array.from(map.entries())
      .map(([className, invs]) => ({
        className,
        invoices: invs,
        totalAmount: invs.reduce((s, i) => s + Number(i.amount), 0),
        overdueCount: invs.filter((i) => i.computedStatus === 'overdue').length,
        pendingCount: invs.filter((i) => i.computedStatus === 'pending').length,
        cancelledCount: invs.filter((i) => i.computedStatus === 'cancelled').length,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [filtered]);

  // Auto-expand all classes on first render or when filter changes
  useMemo(() => {
    setExpandedClasses(new Set(classGroups.map((g) => g.className)));
  }, [classGroups.length, filter, search]);

  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + getOutstandingBalance(i), 0);
  const overdueCount = outstandingInvoices.filter((i) => i.computedStatus === 'overdue').length;
  const pendingCount = outstandingInvoices.filter((i) => i.computedStatus === 'pending').length;
  const cancelledCount = outstandingInvoices.filter((i) => i.computedStatus === 'cancelled').length;
  const overdueAmount = outstandingInvoices.filter((i) => i.computedStatus === 'overdue').reduce((s, i) => s + getOutstandingBalance(i), 0);

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  const expandAll = () => setExpandedClasses(new Set(classGroups.map((g) => g.className)));
  const collapseAll = () => setExpandedClasses(new Set());

  const buildExportData = (): OutstandingStudent[] =>
    filtered.map((inv) => ({
      name: inv.student?.profile?.full_name || 'Unknown',
      enrollmentNumber: inv.student?.enrollment_number || null,
      grade: inv.student?.grade || null,
      className: inv.className,
      amountDue: getOutstandingBalance(inv),
      dueDate: format(new Date(inv.due_date + 'T00:00:00'), 'dd/MM/yyyy'),
      status: inv.computedStatus,
      invoiceNumber: inv.invoice_number,
      title: inv.title,
    }));

  const schoolName = invoices[0]?.school?.name;

  const handleExportPdf = () => {
    generateOutstandingReportPdf({
      students: buildExportData(),
      schoolName,
      totalOutstanding,
      overdueCount,
      pendingCount,
      generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
    });
  };

  const handleExportCsv = () => {
    generateOutstandingReportCsv({
      students: buildExportData(),
      schoolName,
      totalOutstanding,
      overdueCount,
      pendingCount,
      generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
    });
  };

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
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Outstanding Payments</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="destructive" className="text-sm gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {overdueCount} overdue (${overdueAmount.toLocaleString()})
          </Badge>
          <Badge variant="outline" className="text-sm gap-1">
            <Clock className="h-3.5 w-3.5" />
            {pendingCount} pending
          </Badge>
          {cancelledCount > 0 && (
            <Badge variant="outline" className="text-sm gap-1">
              {cancelledCount} cancelled with balance
            </Badge>
          )}
          <Badge className="text-sm bg-foreground/10 text-foreground">
            Total: ${totalOutstanding.toLocaleString()}
          </Badge>
        </div>
      </button>

      {!sectionOpen ? null : (<>

      {/* Search, filter, export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, class, or invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'overdue' | 'pending' | 'cancelled')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outstanding</SelectItem>
            <SelectItem value="overdue">Overdue Only</SelectItem>
            <SelectItem value="pending">Pending Only</SelectItem>
            <SelectItem value="cancelled">Cancelled, still outstanding</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {search && (
        <p className="text-xs text-muted-foreground mb-3">
          Found {filtered.length} of {outstandingInvoices.length} outstanding invoices in {classGroups.length} class(es)
        </p>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {outstandingInvoices.length === 0
              ? 'No outstanding invoice balances.'
              : 'No matching outstanding payments found.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {classGroups.map((group) => {
            const isExpanded = expandedClasses.has(group.className);
            const classQ = classSearches[group.className] || '';
            const visibleInvoices = filterByClassSearch(group.invoices, group.className);
            const visibleTotal = visibleInvoices.reduce((s, i) => s + getOutstandingBalance(i), 0);
            const visibleOverdue = visibleInvoices.filter((i) => i.computedStatus === 'overdue').length;
            return (
              <Card key={group.className}>
                <button
                  onClick={() => toggleClass(group.className)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{group.className}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {visibleInvoices.length} invoice{visibleInvoices.length !== 1 ? 's' : ''}
                    </Badge>
                    {visibleOverdue > 0 && (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {visibleOverdue} overdue
                      </Badge>
                    )}
                    {group.cancelledCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {group.cancelledCount} cancelled with balance
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'font-semibold text-sm',
                      visibleOverdue > 0 ? 'text-destructive' : 'text-foreground'
                    )}>
                      ${visibleTotal.toLocaleString()}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-muted/20">
                      <div className="relative max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search in this class..."
                          value={classQ}
                          onChange={(e) => setClassSearch(group.className, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="pl-9 h-8 text-sm"
                        />
                        {classQ && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setClassSearch(group.className, ''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {classQ && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Found {visibleInvoices.length} of {group.invoices.length} invoices
                        </p>
                      )}
                    </div>
                    {visibleInvoices.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No matching invoices found in {group.className}.
                      </div>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Student</TableHead>
                              <TableHead>Invoice</TableHead>
                              <TableHead>Amount Due</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleInvoices.map((inv, idx) => {
                              const isOverdue = inv.computedStatus === 'overdue';
                              return (
                                <TableRow
                                  key={inv.id}
                                  className={cn(isOverdue && 'bg-destructive/5')}
                                >
                                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm">
                                        {inv.student?.enrollment_number && (
                                          <span className="font-mono text-primary mr-1.5">
                                            {inv.student.enrollment_number}
                                          </span>
                                        )}
                                        {inv.student?.profile?.full_name || 'Unknown'}
                                      </p>
                                      {inv.student?.grade && (
                                        <p className="text-xs text-muted-foreground">Grade {inv.student.grade}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-mono text-xs text-primary">{inv.invoice_number}</p>
                                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{inv.title}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className={cn('font-semibold text-sm', isOverdue || inv.computedStatus === 'cancelled' ? 'text-destructive' : 'text-foreground')}>
                                      ${getOutstandingBalance(inv).toLocaleString()}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className={cn('text-sm', isOverdue && 'text-destructive font-medium')}>
                                      {format(new Date(inv.due_date + 'T00:00:00'), 'dd MMM yyyy')}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {inv.computedStatus === 'cancelled' ? (
                                      <Badge variant="outline">Cancelled · balance due</Badge>
                                    ) : isOverdue ? (
                                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Overdue
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
                                        <Clock className="h-3 w-3" />
                                        Pending
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/30 font-medium">
                              <TableCell colSpan={3} className="text-right text-sm text-muted-foreground">
                                Class Total ({visibleInvoices.length} invoices)
                              </TableCell>
                              <TableCell className={cn('font-semibold text-sm', visibleOverdue > 0 ? 'text-destructive' : 'text-foreground')}>
                                ${visibleTotal.toLocaleString()}
                              </TableCell>
                              <TableCell colSpan={2} />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
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
