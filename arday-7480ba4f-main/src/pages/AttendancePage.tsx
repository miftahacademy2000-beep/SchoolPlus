import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClasses } from '@/hooks/useClasses';
import { 
  useAttendance, 
  useClassStudentsForAttendance, 
  useBulkMarkAttendance,
  useDeleteAttendance,
  type AttendanceStatus 
} from '@/hooks/useAttendance';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  CalendarIcon, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Save,
  FileDown,
  TrendingUp,
  ClipboardList,
  UserCheck,
  BarChart3,
  RotateCcw,
  Lock,
  Unlock,
} from 'lucide-react';
import { exportAttendancePdf } from '@/lib/attendanceExport';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { extractStudentIdNum } from '@/lib/studentSorting';
import { buildBulkAttendanceChanges } from '@/lib/attendanceBulk';
import AttendanceRangeReport from '@/components/attendance/AttendanceRangeReport';
import AttendanceAnalytics from '@/components/attendance/AttendanceAnalytics';

type BulkActionType = 'present' | 'absent' | 'excused' | null;

const EMPTY_LOCKED_STUDENT_IDS = new Set<string>();

export default function AttendancePage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceChanges, setAttendanceChanges] = useState<Record<string, AttendanceStatus>>({});
  const [clearedStudents, setClearedStudents] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<BulkActionType>(null);
  const [lockedStudentState, setLockedStudentState] = useState<{
    scope: string;
    ids: Set<string>;
    loadFailed: boolean;
  }>({
    scope: '',
    ids: EMPTY_LOCKED_STUDENT_IDS,
    loadFailed: false,
  });

  const statusOptions: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'present', label: t('attendance.status.present'), icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
    { value: 'absent', label: t('attendance.status.absent'), icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
    { value: 'late', label: t('attendance.status.late'), icon: <Clock className="h-4 w-4" />, color: 'text-warning' },
    { value: 'excused', label: t('attendance.status.excused'), icon: <AlertCircle className="h-4 w-4" />, color: 'text-muted-foreground' },
  ];

  const { user } = useAuth();
  const { toast } = useToast();
  const lockStorageKey = `attendance-locked-students:${user?.id || 'anonymous'}:${selectedClassId || 'none'}`;
  const lockedStudentIds = lockedStudentState.scope === lockStorageKey
    ? lockedStudentState.ids
    : EMPTY_LOCKED_STUDENT_IDS;
  const locksReady = lockedStudentState.scope === lockStorageKey && !lockedStudentState.loadFailed;
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: attendance, isLoading: attendanceLoading } = useAttendance(
    selectedClassId || null, 
    selectedDate
  );
  const { data: students, isLoading: studentsLoading } = useClassStudentsForAttendance(
    selectedClassId || null
  );
  const bulkMarkAttendance = useBulkMarkAttendance();
  const deleteAttendance = useDeleteAttendance();

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus | undefined>();
    (attendance || []).forEach(a => map.set(a.student_id, a.status));
    Object.entries(attendanceChanges).forEach(([studentId, status]) => map.set(studentId, status));
    clearedStudents.forEach(id => map.delete(id));
    return map;
  }, [attendance, attendanceChanges, clearedStudents]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];

    const sorted = [...students].sort((a, b) =>
      extractStudentIdNum(a.enrollment_number) - extractStudentIdNum(b.enrollment_number)
    );

    if (!studentSearch.trim()) return sorted;
    const q = studentSearch.toLowerCase();
    return sorted.filter(s =>
      s.student_name.toLowerCase().includes(q) ||
      (s.enrollment_number && s.enrollment_number.toLowerCase().includes(q))
    );
  }, [students, studentSearch]);

  const unlockedFilteredStudents = useMemo(
    () => filteredStudents.filter(student => !lockedStudentIds.has(student.student_id)),
    [filteredStudents, lockedStudentIds],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lockStorageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed) || !parsed.every(id => typeof id === 'string')) {
        throw new Error('Saved attendance lock data is invalid.');
      }
      setLockedStudentState({ scope: lockStorageKey, ids: new Set<string>(parsed), loadFailed: false });
    } catch (error) {
      toast({
        title: t('attendance.lockLoadError', 'Unable to load attendance locks'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
      setLockedStudentState({ scope: lockStorageKey, ids: EMPTY_LOCKED_STUDENT_IDS, loadFailed: true });
    }
  }, [lockStorageKey, t, toast]);

  const handleToggleStudentLock = (studentId: string) => {
    if (!locksReady) return;

    const nextLockedStudentIds = new Set(lockedStudentIds);
    if (nextLockedStudentIds.has(studentId)) {
      nextLockedStudentIds.delete(studentId);
    } else {
      nextLockedStudentIds.add(studentId);
    }

    try {
      localStorage.setItem(lockStorageKey, JSON.stringify([...nextLockedStudentIds]));
      setLockedStudentState({ scope: lockStorageKey, ids: nextLockedStudentIds, loadFailed: false });
    } catch (error) {
      toast({
        title: t('attendance.lockSaveError', 'Unable to save attendance lock'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const markedByMap = useMemo(() => {
    const map = new Map<string, { name: string | null; updatedAt: string }>();
    (attendance || []).forEach(a => {
      map.set(a.student_id, {
        name: a.marked_by_profile?.full_name || null,
        updatedAt: a.created_at,
      });
    });
    return map;
  }, [attendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    const currentStatus = attendanceMap.get(studentId);
    if (currentStatus === status) {
      // Toggle off: clear the status back to "Not Marked"
      handleClearStatus(studentId);
      return;
    }
    setClearedStudents(prev => { const n = new Set(prev); n.delete(studentId); return n; });
    setAttendanceChanges(prev => ({ ...prev, [studentId]: status }));
  };

  const handleClearStatus = (studentId: string) => {
    setAttendanceChanges(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    // If there's an existing DB record, mark it for deletion
    const existingRecord = (attendance || []).find(a => a.student_id === studentId);
    if (existingRecord) {
      setClearedStudents(prev => new Set(prev).add(studentId));
    }
  };

  // Keyboard shortcuts: Arrow keys to navigate rows, P/A/L/E to mark status
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!filteredStudents.length) return;

    const keyMap: Record<string, AttendanceStatus> = {
      p: 'present', a: 'absent', l: 'late', e: 'excused',
    };

    const key = e.key.toLowerCase();

    if (key === 'arrowdown') {
      e.preventDefault();
      setFocusedRowIndex(prev => Math.min(prev + 1, filteredStudents.length - 1));
    } else if (key === 'arrowup') {
      e.preventDefault();
      setFocusedRowIndex(prev => Math.max(prev - 1, 0));
    } else if (keyMap[key] && focusedRowIndex >= 0 && focusedRowIndex < filteredStudents.length) {
      e.preventDefault();
      handleStatusChange(filteredStudents[focusedRowIndex].student_id, keyMap[key]);
    }
  }, [filteredStudents, focusedRowIndex, handleStatusChange]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset focused row when students list changes
  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [selectedClassId, studentSearch]);

  const handleSave = async () => {
    if (!selectedClassId || (Object.keys(attendanceChanges).length === 0 && clearedStudents.size === 0)) return;
    
    // Delete cleared records
    if (clearedStudents.size > 0) {
      const idsToDelete = (attendance || [])
        .filter(a => clearedStudents.has(a.student_id))
        .map(a => a.id);
      if (idsToDelete.length > 0) {
        await deleteAttendance.mutateAsync(idsToDelete);
      }
    }
    
    // Upsert changed records
    if (Object.keys(attendanceChanges).length > 0) {
      const records = Object.entries(attendanceChanges).map(([studentId, status]) => ({
        studentId, classId: selectedClassId, date: format(selectedDate, 'yyyy-MM-dd'), status, markedBy: user?.id,
      }));
      await bulkMarkAttendance.mutateAsync(records);
    }
    
    setAttendanceChanges({});
    setClearedStudents(new Set());
  };

  const handleExportPdf = () => {
    if (!selectedClassId || !students?.length) return;
    const cls = classes?.find(c => c.id === selectedClassId);
    if (!cls) return;
    const rows = students.map(s => ({ student_id: s.student_id, enrollment_number: s.enrollment_number, student_name: s.student_name, status: attendanceMap.get(s.student_id), marked_by: markedByMap.get(s.student_id)?.name || null }));
    exportAttendancePdf(
      { name: cls.name, grade: cls.grade, section: cls.section, teacherName: cls.teacher?.profile?.full_name, studentCount: students.length },
      selectedDate, rows,
    );
  };

  const getStatusBadge = (status: AttendanceStatus | undefined) => {
    if (!status) return null;
    const option = statusOptions.find(o => o.value === status);
    if (!option) return null;
    return (
      <Badge variant="outline" className={cn("gap-1",
        status === 'present' && "border-success/50 bg-success/10 text-success",
        status === 'absent' && "border-destructive/50 bg-destructive/10 text-destructive",
        status === 'late' && "border-warning/50 bg-warning/10 text-warning",
        status === 'excused' && "border-muted-foreground/50 bg-muted text-muted-foreground"
      )}>
        {option.icon}{option.label}
      </Badge>
    );
  };

  const handleShareStudentWhatsApp = async (studentId: string, studentName: string) => {
    try {
      // Look up parent phone via parent_students -> parents
      const { data: links } = await api.get<{ parent_id: string }[]>('/parent-students', {
        params: { student_id: studentId }
      });

      let parentPhone: string | null = null;
      if (links && links.length > 0) {
        const { data: parent } = await api.get<{ phone: string | null }>(`/parents/${links[0].parent_id}`);
        parentPhone = parent?.phone || null;
      }

      const cls = classes?.find(c => c.id === selectedClassId);
      const dateStr = format(selectedDate, 'MMMM d, yyyy');
      const status = attendanceMap.get(studentId);
      const statusLabel = status ? t(`attendance.status.${status}`) : t('attendance.status.notMarked');

      const message = [
        `📋 *${t('attendance.title')} - ${dateStr}*`,
        cls ? `🏫 ${cls.name}${cls.grade ? ` - ${cls.grade}` : ''}${cls.section ? ` (${cls.section})` : ''}` : '',
        '',
        `👤 *${studentName}*`,
        `📊 ${t('attendance.table.status')}: ${statusLabel}`,
        '',
        status === 'absent' ? `⚠️ ${t('attendance.parentAbsentNotice', 'Your child was marked absent today. Please contact the school if needed.')}` : '',
      ].filter(Boolean).join('\n');

      let url: string;
      if (parentPhone) {
        const cleanPhone = parentPhone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
        url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      } else {
        url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        toast({
          title: t('attendance.noParentPhone', 'No parent phone found'),
          description: t('attendance.noParentPhoneDesc', 'Opening WhatsApp without a pre-filled number. You can manually select a contact.'),
        });
      }
      window.open(url, '_blank');
    } catch {
      toast({ title: t('common.error', 'Error'), description: t('attendance.shareError', 'Failed to share attendance'), variant: 'destructive' });
    }
  };

  const hasChanges = Object.keys(attendanceChanges).length > 0 || clearedStudents.size > 0;

  return (
    <DashboardLayout>
      <PageHeader
        title={t('attendance.title')}
        description={t('attendance.description')}
        breadcrumbs={[{ label: t('attendance.title') }]}
      />

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList>
          <TabsTrigger value="daily" className="gap-2">
            <ClipboardList className="h-4 w-4" /> {t('attendance.tabs.daily')}
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <TrendingUp className="h-4 w-4" /> {t('attendance.tabs.rangeReport')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" /> {t('attendance.tabs.analytics', 'Analytics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('attendance.selectClassAndDate')}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger><SelectValue placeholder={t('attendance.selectClass')} /></SelectTrigger>
                    <SelectContent>
                      {classesLoading ? (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> {t('attendance.loadingClasses')}
                        </div>
                      ) : classes?.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('attendance.noClasses')}</div>
                      ) : (
                        classes?.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} {cls.grade && `- ${cls.grade}`} {cls.section && `(${cls.section})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{t('attendance.selectClassPrompt')}</h2>
              <p className="text-sm text-muted-foreground">{t('attendance.selectClassDesc')}</p>
            </div>
          ) : studentsLoading || attendanceLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : students?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{t('attendance.noStudents')}</h2>
              <p className="text-sm text-muted-foreground">{t('attendance.noStudentsDesc')}</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('attendance.attendanceFor', { date: format(selectedDate, 'MMMM d, yyyy') })}</CardTitle>
<div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 border-success/50 text-success hover:bg-success/10"
                    onClick={() => setBulkActionConfirm('present')}
                    disabled={!locksReady || unlockedFilteredStudents.length === 0}
                  >
                    <UserCheck className="h-4 w-4" /> {t('attendance.markAllPresent', 'Mark All Present')}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setBulkActionConfirm('absent')}
                    disabled={!locksReady || unlockedFilteredStudents.length === 0}
                  >
                    <XCircle className="h-4 w-4" /> {t('attendance.markAllAbsent', 'Mark All Absent')}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setBulkActionConfirm('excused')}
                    disabled={!locksReady || unlockedFilteredStudents.length === 0}
                  >
                    <AlertCircle className="h-4 w-4" /> {t('attendance.markAllExcused', 'Mark All Excused')}
                  </Button>
                  <Button variant="outline" onClick={handleExportPdf} className="gap-2">
                    <FileDown className="h-4 w-4" /> {t('attendance.exportPdf')}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/10"
                    onClick={() => {
                      if (!selectedClassId || !students?.length) return;
                      const cls = classes?.find(c => c.id === selectedClassId);
                      const dateStr = format(selectedDate, 'MMMM d, yyyy');
                      const total = filteredStudents.length;
                      const present = filteredStudents.filter(s => attendanceMap.get(s.student_id) === 'present').length;
                      const absent = filteredStudents.filter(s => attendanceMap.get(s.student_id) === 'absent').length;
                      const late = filteredStudents.filter(s => attendanceMap.get(s.student_id) === 'late').length;
                      const excused = filteredStudents.filter(s => attendanceMap.get(s.student_id) === 'excused').length;
                      const notMarked = total - present - absent - late - excused;
                      const message = [
                        `📋 *${t('attendance.title')} - ${dateStr}*`,
                        cls ? `🏫 ${cls.name}${cls.grade ? ` - ${cls.grade}` : ''}${cls.section ? ` (${cls.section})` : ''}` : '',
                        '',
                        `👥 ${t('attendance.total', 'Total')}: ${total}`,
                        `✅ ${t('attendance.status.present')}: ${present}`,
                        `❌ ${t('attendance.status.absent')}: ${absent}`,
                        `⏰ ${t('attendance.status.late')}: ${late}`,
                        `ℹ️ ${t('attendance.status.excused')}: ${excused}`,
                        notMarked > 0 ? `⬜ ${t('attendance.status.notMarked')}: ${notMarked}` : '',
                      ].filter(Boolean).join('\n');
                      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {t('attendance.shareWhatsApp', 'Share to WhatsApp')}
                  </Button>
                  {hasChanges && (
                    <Button onClick={handleSave} disabled={bulkMarkAttendance.isPending} className="gap-2">
                      {bulkMarkAttendance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t('attendance.saveChanges')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-sm">
                  <Input
                    placeholder={t('attendance.searchPlaceholder')}
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {studentSearch.trim() && (
                  <div className="text-sm text-muted-foreground">
                    {t('attendance.foundStudents', { count: filteredStudents.length, total: students?.length || 0 })}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <span className="font-medium">{t('attendance.shortcuts.title', 'Shortcuts')}:</span>
                  <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">↑↓</kbd> {t('attendance.shortcuts.navigate', 'Navigate')}</span>
                  <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">P</kbd> {t('attendance.shortcuts.present', 'Present')}</span>
                  <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">A</kbd> {t('attendance.shortcuts.absent', 'Absent')}</span>
                  <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">L</kbd> {t('attendance.shortcuts.late', 'Late')}</span>
                  <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">E</kbd> {t('attendance.shortcuts.excused', 'Excused')}</span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{t('attendance.table.number')}</TableHead>
                      <TableHead>{t('attendance.table.studentId')}</TableHead>
                      <TableHead>{t('attendance.table.student')}</TableHead>
                      <TableHead>{t('attendance.table.status')}</TableHead>
                      <TableHead>{t('attendance.table.markedBy')}</TableHead>
                      <TableHead className="text-right">{t('attendance.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {t('attendance.noResults', { search: studentSearch })}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {filteredStudents.map((student, index) => {
                      const currentStatus = attendanceMap.get(student.student_id);
                      const isHighlighted = studentSearch.trim().length > 0;
                      const isLocked = lockedStudentIds.has(student.student_id);
                      return (
                        <TableRow
                          key={student.student_id}
                          className={cn(
                            isHighlighted && "bg-accent/30",
                            isLocked && "bg-amber-500/5",
                            focusedRowIndex === index && "ring-2 ring-primary ring-inset bg-primary/5"
                          )}
                          onClick={() => setFocusedRowIndex(index)}
                        >
                          <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                          <TableCell className="text-muted-foreground text-sm font-mono">{student.enrollment_number || '—'}</TableCell>
                          <TableCell className="font-medium">
                            <span>{student.student_name}</span>
                            {isLocked && (
                              <Badge variant="outline" className="ml-2 gap-1 border-amber-500/50 bg-amber-500/10 text-amber-700">
                                <Lock className="h-3 w-3" />
                                {t('attendance.locked', 'Locked')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {currentStatus ? (
                              getStatusBadge(currentStatus)
                            ) : (
                              <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
                                {t('attendance.status.notMarked')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {(() => {
                              const info = markedByMap.get(student.student_id);
                              if (!currentStatus || !info) return <span className="text-muted-foreground">—</span>;
                              const fullDateTime = format(new Date(info.updatedAt), 'PPpp'); // e.g., "Mar 15, 2025, 10:53:00 AM"
                              return (
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex flex-col cursor-help">
                                        <span className="text-foreground font-medium">{info.name || t('attendance.unknown', 'Unknown')}</span>
                                        <span className="text-xs text-muted-foreground">{format(new Date(info.updatedAt), 'MMM d, h:mm a')}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <p className="font-medium">{t('attendance.lastModified', 'Last modified')}</p>
                                      <p>{fullDateTime}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "h-8 w-8 p-0",
                                        isLocked && "border-amber-500/50 text-amber-700 hover:bg-amber-500/10",
                                      )}
                                      onClick={() => handleToggleStudentLock(student.student_id)}
                                      disabled={!locksReady}
                                      aria-label={isLocked
                                        ? t('attendance.unlockStudent', 'Unlock student')
                                        : t('attendance.lockStudent', 'Lock student')}
                                    >
                                      {isLocked
                                        ? <Unlock className="h-3.5 w-3.5" />
                                        : <Lock className="h-3.5 w-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p>{isLocked
                                      ? t('attendance.lockedTooltip', 'Locked: Excluded from bulk attendance actions. Click to unlock.')
                                      : t('attendance.lockTooltip', 'Lock to exclude from bulk attendance actions')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {statusOptions.map((option) => (
                                <Button
                                  key={option.value}
                                  variant={currentStatus === option.value ? "default" : "outline"}
                                  size="sm"
                                  className={cn("h-8 w-8 p-0",
                                    currentStatus === option.value && option.value === 'present' && "bg-success hover:bg-success/90",
                                    currentStatus === option.value && option.value === 'absent' && "bg-destructive hover:bg-destructive/90",
                                    currentStatus === option.value && option.value === 'late' && "bg-warning hover:bg-warning/90",
                                    currentStatus !== option.value && option.color
                                  )}
                                  onClick={() => handleStatusChange(student.student_id, option.value)}
                                  title={option.label}
                                >
                                  {option.icon}
                                </Button>
                              ))}
                              {currentStatus && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleClearStatus(student.student_id)}
                                  title={t('attendance.reset', 'Reset to Not Marked')}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/10"
                                onClick={() => handleShareStudentWhatsApp(student.student_id, student.student_name)}
                                title={t('attendance.shareStudentWhatsApp', 'Share to parent via WhatsApp')}
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report">
          <AttendanceRangeReport />
        </TabsContent>

        <TabsContent value="analytics">
          <AttendanceAnalytics />
        </TabsContent>
      </Tabs>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={!!bulkActionConfirm} onOpenChange={() => setBulkActionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionConfirm === 'present'
                ? t('attendance.confirmMarkAllPresent', 'Mark All as Present?')
                : bulkActionConfirm === 'absent'
                  ? t('attendance.confirmMarkAllAbsent', 'Mark All as Absent?')
                  : t('attendance.confirmMarkAllExcused', 'Mark All as Excused?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionConfirm === 'present'
                ? t('attendance.confirmMarkAllPresentDesc', {
                    count: unlockedFilteredStudents.length,
                    defaultValue: `This will mark all ${unlockedFilteredStudents.length} unlocked filtered students as present. This action can be undone before saving.`,
                  })
                : bulkActionConfirm === 'absent'
                  ? t('attendance.confirmMarkAllAbsentDesc', {
                      count: unlockedFilteredStudents.length,
                      defaultValue: `This will mark all ${unlockedFilteredStudents.length} unlocked filtered students as absent. This action can be undone before saving.`,
                    })
                  : t('attendance.confirmMarkAllExcusedDesc', {
                      count: unlockedFilteredStudents.length,
                      defaultValue: `This will mark all ${unlockedFilteredStudents.length} unlocked filtered students as excused. This action can be undone before saving.`,
                    })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkActionConfirm(null)}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!bulkActionConfirm || !locksReady || !unlockedFilteredStudents.length) return;
                const changes = buildBulkAttendanceChanges(
                  filteredStudents,
                  lockedStudentIds,
                  bulkActionConfirm,
                );
                setAttendanceChanges(prev => ({ ...prev, ...changes }));
                setBulkActionConfirm(null);
              }}
              className={cn(
                bulkActionConfirm === 'present' && 'bg-success hover:bg-success/90',
                bulkActionConfirm === 'absent' && 'bg-destructive hover:bg-destructive/90',
              )}
            >
              {bulkActionConfirm === 'present'
                ? t('attendance.markAllPresent', 'Mark All Present')
                : bulkActionConfirm === 'absent'
                  ? t('attendance.markAllAbsent', 'Mark All Absent')
                  : t('attendance.markAllExcused', 'Mark All Excused')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
