import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Search, ArrowRight, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useTransferStudents } from '@/hooks/useTransferStudents';
import { type StudentWithProfile } from '@/hooks/useStudents';
import { extractStudentIdNum } from '@/lib/studentSorting';

interface TransferStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentWithProfile[];
}

export function TransferStudentsModal({ open, onOpenChange, students }: TransferStudentsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetSchoolId, setTargetSchoolId] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<'select' | 'results'>('select');
  const [results, setResults] = useState<{ student_id: string; status: string; name?: string; error?: string }[]>([]);

  const { currentSchoolId } = useSchoolContext();
  const transferMutation = useTransferStudents();

  // Fetch available schools (excluding current)
  const { data: schools = [] } = useQuery({
    queryKey: ['transfer-target-schools', currentSchoolId],
    queryFn: async () => {
      const response = await api.get<{ data: { id: string; name: string }[] }>('/schools', {
        params: { status: 'active', exclude_id: currentSchoolId, sort: 'name' },
      });
      return response.data || [];
    },
    enabled: open && !!currentSchoolId,
  });

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          s.profile?.full_name?.toLowerCase().includes(q) ||
          s.profile?.email?.toLowerCase().includes(q) ||
          s.enrollment_number?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => extractStudentIdNum(a.enrollment_number) - extractStudentIdNum(b.enrollment_number));
  }, [students, search]);

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selectedIds);
      filteredStudents.forEach((s) => newSet.delete(s.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filteredStudents.forEach((s) => newSet.add(s.id));
      setSelectedIds(newSet);
    }
  };

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleTransfer = async () => {
    setShowConfirm(false);
    const result = await transferMutation.mutateAsync({
      studentIds: Array.from(selectedIds),
      targetSchoolId,
      sourceSchoolId: currentSchoolId!,
    });
    setResults(result.results);
    setStep('results');
  };

  const handleClose = () => {
    setSearch('');
    setSelectedIds(new Set());
    setTargetSchoolId('');
    setStep('select');
    setResults([]);
    onOpenChange(false);
  };

  const targetSchoolName = schools.find((s) => s.id === targetSchoolId)?.name;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              {step === 'select' ? 'Transfer Students' : 'Transfer Results'}
            </DialogTitle>
            <DialogDescription>
              {step === 'select'
                ? 'Select students and a target school to transfer them with all their records.'
                : 'Summary of the transfer operation.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'select' ? (
            <>
              {/* Target School */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Target School</label>
                <Select value={targetSchoolId} onValueChange={setTargetSchoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target school..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search & Select All */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Student List */}
              <ScrollArea className="flex-1 min-h-0 max-h-[40vh] border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {student.profile?.full_name || 'Unnamed'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {student.enrollment_number && `ID: ${student.enrollment_number}`}
                          {student.grade && ` · Grade: ${student.grade}`}
                        </span>
                      </div>
                    </label>
                  ))}
                  {filteredStudents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No students found</p>
                  )}
                </div>
              </ScrollArea>

              {/* Selection Summary */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedIds.size} student(s) selected
                </span>
                {targetSchoolId && selectedIds.size > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {targetSchoolName}
                  </Badge>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={selectedIds.size === 0 || !targetSchoolId || transferMutation.isPending}
                >
                  {transferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Transfer {selectedIds.size} Student(s)
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {results.filter((r) => r.status === 'success').length} transferred
                  </div>
                  {results.some((r) => r.status === 'error') && (
                    <div className="flex items-center gap-1.5 text-destructive">
                      <XCircle className="h-4 w-4" />
                      {results.filter((r) => r.status === 'error').length} failed
                    </div>
                  )}
                </div>

                <ScrollArea className="max-h-[50vh] border rounded-md">
                  <div className="p-2 space-y-1">
                    {results.map((r) => (
                      <div
                        key={r.student_id}
                        className="flex items-center gap-2 p-2 rounded-md text-sm"
                      >
                        {r.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <span className="font-medium">{r.name || r.student_id}</span>
                        {r.error && (
                          <span className="text-destructive text-xs ml-auto">{r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Transfer
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to transfer <strong>{selectedIds.size} student(s)</strong> to{' '}
              <strong>{targetSchoolName}</strong>. This will:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Move student records to the target school</li>
                <li>Update memberships and roles</li>
                <li>Remove class enrollments from the current school</li>
                <li>Transfer pending invoices</li>
                <li>Keep attendance and grade history linked</li>
              </ul>
              <p className="mt-2 font-medium">This action cannot be easily undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer}>
              Confirm Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
