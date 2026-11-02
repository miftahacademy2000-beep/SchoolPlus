import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  DollarSign, Save, Loader2, Users, GraduationCap, Pencil, Trash2, Plus, AlertCircle, Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface MonthlyFeeSectionProps {
  schoolId: string;
  schoolFee: number | null;
  onSchoolFeeChange: (fee: number | null) => void;
}

interface ClassFee {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  monthly_fee: number | null;
}

interface StudentOverride {
  id: string;
  student_id: string;
  monthly_fee: number;
  reason: string | null;
  student_name: string | null;
  enrollment_number: string | null;
}

export function MonthlyFeeSection({ schoolId, schoolFee, onSchoolFeeChange }: MonthlyFeeSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feeTab, setFeeTab] = useState('class');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classFeeValue, setClassFeeValue] = useState('');
  const [showStudentOverrideDialog, setShowStudentOverrideDialog] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentFeeValue, setStudentFeeValue] = useState('');
  const [studentFeeReason, setStudentFeeReason] = useState('');
  const [editingOverride, setEditingOverride] = useState<StudentOverride | null>(null);

  // Fetch classes with their fee overrides
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['class-fees', schoolId],
    queryFn: async () => {
      const response = await api.get<{ data: ClassFee[] }>('/classes', { params: { school_id: schoolId, sort: 'name' } });
      return response.data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch student fee overrides
  const { data: studentOverrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ['student-fee-overrides', schoolId],
    queryFn: async () => {
      const response = await api.get<{ data: StudentOverride[] }>('/student-fee-overrides', { params: { school_id: schoolId } });
      return response.data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch students for the override dialog
  const { data: allStudents = [] } = useQuery({
    queryKey: ['school-students-for-fees', schoolId],
    queryFn: async () => {
      const response = await api.get<{ data: { id: string; name: string; enrollment_number: string }[] }>('/students', { params: { school_id: schoolId } });
      const students = response.data || [];
      return students.map((s: any) => ({
        id: s.id,
        name: s.profile?.full_name || s.name || 'Unknown',
        enrollment_number: s.enrollment_number,
      })).sort((a: any, b: any) => {
        const numA = parseInt(a.enrollment_number || '0', 10);
        const numB = parseInt(b.enrollment_number || '0', 10);
        return numA - numB;
      });
    },
    enabled: !!schoolId && showStudentOverrideDialog,
  });

  // Update class fee
  const updateClassFee = useMutation({
    mutationFn: async ({ classId, fee }: { classId: string; fee: number | null }) => {
      await api.put(`/classes/${classId}`, { monthly_fee: fee, school_id: schoolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-fees', schoolId] });
      setEditingClassId(null);
      toast({ title: 'Class fee updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Upsert student override
  const upsertStudentOverride = useMutation({
    mutationFn: async ({ studentId, fee, reason }: { studentId: string; fee: number; reason: string }) => {
      await api.post('/student-fee-overrides', {
        student_id: studentId,
        school_id: schoolId,
        monthly_fee: fee,
        reason: reason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fee-overrides', schoolId] });
      setShowStudentOverrideDialog(false);
      setEditingOverride(null);
      resetStudentForm();
      toast({ title: 'Student fee override saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Delete student override
  const deleteStudentOverride = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/student-fee-overrides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fee-overrides', schoolId] });
      toast({ title: 'Student fee override removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const resetStudentForm = () => {
    setSelectedStudentId('');
    setStudentFeeValue('');
    setStudentFeeReason('');
  };

  const handleEditOverride = (override: StudentOverride) => {
    setEditingOverride(override);
    setSelectedStudentId(override.student_id);
    setStudentFeeValue(String(override.monthly_fee));
    setStudentFeeReason(override.reason || '');
    setShowStudentOverrideDialog(true);
  };

  const handleSaveStudentOverride = () => {
    const fee = parseFloat(studentFeeValue);
    if (isNaN(fee) || fee < 0) {
      toast({ title: 'Invalid fee', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    const studentId = editingOverride ? editingOverride.student_id : selectedStudentId;
    if (!studentId) {
      toast({ title: 'Select a student', variant: 'destructive' });
      return;
    }
    upsertStudentOverride.mutate({ studentId, fee, reason: studentFeeReason });
  };

  const classesWithFee = classes.filter(c => c.monthly_fee !== null && c.monthly_fee > 0);
  const isAutoInvoicingActive = (schoolFee !== null && schoolFee > 0) || classesWithFee.length > 0 || studentOverrides.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Monthly Fee Management
        </CardTitle>
        <CardDescription>
          Each class controls its own monthly billing. Set the fee per class to invoice students based on their enrollment. Student overrides and school defaults are available as secondary options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-invoicing status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <div className={`h-2.5 w-2.5 rounded-full ${isAutoInvoicingActive ? 'bg-success' : 'bg-muted-foreground/40'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Automatic Monthly Invoicing: {isAutoInvoicingActive ? 'Active' : 'Disabled'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAutoInvoicingActive
                ? `${classesWithFee.length} class(es) with custom fees. School default: $${(schoolFee ?? 0).toFixed(2)}`
                : 'Set class fees or a school default to enable automatic invoicing'}
            </p>
          </div>
        </div>

        <Tabs value={feeTab} onValueChange={setFeeTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="class" className="gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              Per Class
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{classes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="student" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Per Student
              {studentOverrides.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{studentOverrides.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="default" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              School Default
            </TabsTrigger>
          </TabsList>

          {/* School Default Fee */}
          <TabsContent value="default" className="mt-4 space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="monthly_fee" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Default Monthly Fee
              </Label>
              <Input
                id="monthly_fee"
                type="number"
                min={0}
                step={0.01}
                value={schoolFee ?? ''}
                onChange={(e) => onSchoolFeeChange(e.target.value ? Number(e.target.value) : null)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty or set to 0 to disable automatic monthly invoicing. This fee applies to all students unless a class or student override is set.
              </p>
            </div>
        <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary/80">
                <strong>Priority order:</strong> Student-specific fee → Class fee → School default fee. Changes are applied to the next billing cycle automatically.
              </p>
            </div>
          </TabsContent>

          {/* Per-Class Fees (Primary) */}
          <TabsContent value="class" className="mt-4 space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5">
              <GraduationCap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary/80">
                <strong>Each class controls its own billing.</strong> Set the monthly fee for each class below. Students are invoiced based on their class fee. Classes without a fee will fall back to the school default.
              </p>
            </div>
            {classesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No classes found. Create classes first to assign fees.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Grade / Section</TableHead>
                      <TableHead className="text-right">Monthly Fee</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => (
                      <TableRow key={cls.id} className={editingClassId === cls.id ? 'bg-muted/30' : ''}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[cls.grade, cls.section].filter(Boolean).join(' · ') || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingClassId === cls.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={classFeeValue}
                                onChange={(e) => setClassFeeValue(e.target.value)}
                                className="w-28"
                                placeholder="0.00"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const fee = classFeeValue ? parseFloat(classFeeValue) : null;
                                    updateClassFee.mutate({ classId: cls.id, fee: fee && fee > 0 ? fee : null });
                                  }
                                  if (e.key === 'Escape') setEditingClassId(null);
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors cursor-pointer"
                              onClick={() => {
                                setEditingClassId(cls.id);
                                setClassFeeValue(cls.monthly_fee != null ? String(cls.monthly_fee) : '');
                              }}
                            >
                              {cls.monthly_fee != null && cls.monthly_fee > 0
                                ? `$${cls.monthly_fee.toFixed(2)}`
                                : <span className="text-muted-foreground italic">Click to set</span>}
                              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {cls.monthly_fee != null && cls.monthly_fee > 0 ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Fallback</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingClassId === cls.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2"
                                onClick={() => {
                                  const fee = classFeeValue ? parseFloat(classFeeValue) : null;
                                  updateClassFee.mutate({ classId: cls.id, fee: fee && fee > 0 ? fee : null });
                                }}
                                disabled={updateClassFee.isPending}
                              >
                                {updateClassFee.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingClassId(null)}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => {
                                  setEditingClassId(cls.id);
                                  setClassFeeValue(cls.monthly_fee != null ? String(cls.monthly_fee) : '');
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {cls.monthly_fee != null && cls.monthly_fee > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => updateClassFee.mutate({ classId: cls.id, fee: null })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{classesWithFee.length} of {classes.length} classes have custom fees</span>
              <span>Classes without a fee use the school default (${(schoolFee ?? 0).toFixed(2)})</span>
            </div>
          </TabsContent>

          {/* Per-Student Fees */}
          <TabsContent value="student" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Override the fee for specific students. This takes highest priority over class and school fees.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  resetStudentForm();
                  setEditingOverride(null);
                  setShowStudentOverrideDialog(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Override
              </Button>
            </div>

            {overridesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentOverrides.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No student fee overrides set.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Monthly Fee</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentOverrides
                      .sort((a, b) => {
                        const numA = parseInt(a.enrollment_number || '0', 10);
                        const numB = parseInt(b.enrollment_number || '0', 10);
                        return numA - numB;
                      })
                      .map((override) => (
                        <TableRow key={override.id}>
                          <TableCell>{override.enrollment_number || '—'}</TableCell>
                          <TableCell className="font-medium">{override.student_name}</TableCell>
                          <TableCell className="text-right font-medium">${override.monthly_fee.toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                            {override.reason || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleEditOverride(override)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteStudentOverride.mutate(override.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Student Override Dialog */}
        <Dialog open={showStudentOverrideDialog} onOpenChange={(open) => {
          if (!open) { setShowStudentOverrideDialog(false); setEditingOverride(null); resetStudentForm(); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOverride ? 'Edit' : 'Add'} Student Fee Override</DialogTitle>
              <DialogDescription>
                Set a custom monthly fee for a specific student.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {!editingOverride && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {allStudents
                        .filter((s: any) => !studentOverrides.some(o => o.student_id === s.id))
                        .map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.enrollment_number ? `#${s.enrollment_number} — ` : ''}{s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editingOverride && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Student:</span>{' '}
                  <span className="font-medium">
                    {editingOverride.enrollment_number ? `#${editingOverride.enrollment_number} — ` : ''}
                    {editingOverride.student_name}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Monthly Fee Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={studentFeeValue}
                  onChange={(e) => setStudentFeeValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  value={studentFeeReason}
                  onChange={(e) => setStudentFeeReason(e.target.value)}
                  placeholder="e.g. Scholarship discount, sibling discount..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowStudentOverrideDialog(false); setEditingOverride(null); resetStudentForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSaveStudentOverride} disabled={upsertStudentOverride.isPending}>
                {upsertStudentOverride.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
