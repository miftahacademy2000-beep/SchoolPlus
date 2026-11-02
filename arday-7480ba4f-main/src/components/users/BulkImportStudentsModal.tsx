import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { parseImportFile } from '@/lib/csvUtils';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  X,
} from 'lucide-react';

interface ParsedStudent {
  row: number;
  full_name: string;
  email?: string;
  login_id?: string;
  password: string;
  grade?: string;
  enrollment_number?: string;
  date_of_birth?: string;
  errors: string[];
  status: 'pending' | 'success' | 'skipped' | 'error';
  message?: string;
}

interface BulkImportStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPECTED_HEADERS = ['full_name', 'email', 'login_id', 'password', 'grade', 'enrollment_number', 'date_of_birth'];

function parseDateField(value: string): string | undefined {
  if (!value) return undefined;
  // Try dd/mm/yyyy
  const ddmmyyyy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try yyyy-mm-dd
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  return undefined;
}

export function BulkImportStudentsModal({ open, onOpenChange }: BulkImportStudentsModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, skipped: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const { currentSchoolId } = useSchoolContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = useCallback(() => {
    setStep('upload');
    setParsedStudents([]);
    setParseErrors([]);
    setImportProgress(0);
    setImportResults({ success: 0, skipped: 0, errors: 0 });
    abortRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) {
      abortRef.current = true;
      reset();
    }
    onOpenChange(val);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setParseErrors(['Please upload a .csv, .xls, or .xlsx file']);
      return;
    }

    void parseImportFile(file).then(({ headers: sourceHeaders, rows }) => {
      if (rows.length < 1 || sourceHeaders.length === 0) {
        setParseErrors(['The file must have a header row and at least one data row']);
        return;
      }

      const headers = sourceHeaders.map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const errors: string[] = [];

      // Validate required headers
      if (!headers.includes('full_name')) errors.push('Missing required column: full_name');
      if (!headers.includes('password')) errors.push('Missing required column: password');
      if (!headers.includes('email') && !headers.includes('login_id')) {
        errors.push('Must have either "email" or "login_id" column');
      }

      if (errors.length > 0) {
        setParseErrors(errors);
        return;
      }

      const students: ParsedStudent[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => {
          record[h] = row[idx] || '';
        });

        const rowErrors: string[] = [];
        if (!record.full_name) rowErrors.push('Missing name');
        if (!record.email && !record.login_id) rowErrors.push('Missing email or login ID');
        if (!record.password) rowErrors.push('Missing password');
        if (record.password && record.password.length < 6) rowErrors.push('Password must be at least 6 characters');
        
        const dob = record.date_of_birth ? parseDateField(record.date_of_birth) : undefined;
        if (record.date_of_birth && !dob) rowErrors.push('Invalid date format (use dd/mm/yyyy or yyyy-mm-dd)');

        students.push({
          row: i + 2,
          full_name: record.full_name || '',
          email: record.email || undefined,
          login_id: record.login_id || undefined,
          password: record.password || '',
          grade: record.grade || undefined,
          enrollment_number: record.enrollment_number || undefined,
          date_of_birth: dob,
          errors: rowErrors,
          status: rowErrors.length > 0 ? 'error' : 'pending',
        });
      }

      setParseErrors([]);
      setParsedStudents(students);
      setStep('preview');
    }).catch((error: unknown) => {
      setParseErrors([error instanceof Error ? error.message : 'Failed to read import file']);
    });
  }, []);

  const validStudents = parsedStudents.filter(s => s.errors.length === 0);
  const invalidStudents = parsedStudents.filter(s => s.errors.length > 0);

  const handleImport = useCallback(async () => {
    if (!currentSchoolId) return;
    setStep('importing');
    abortRef.current = false;

    let success = 0;
    let skipped = 0;
    let errors = 0;

    const toImport = validStudents;

    for (let i = 0; i < toImport.length; i++) {
      if (abortRef.current) break;

      const student = toImport[i];
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));

      try {
        const result = await api.post<{ error?: string; message?: string; existing?: boolean }>('/users', {
          email: student.email || undefined,
          login_id: student.login_id || undefined,
          password: student.password,
          full_name: student.full_name,
          role: 'student',
          school_id: currentSchoolId,
          grade: student.grade || undefined,
          enrollment_number: student.enrollment_number || undefined,
          date_of_birth: student.date_of_birth || undefined,
        });

        if (result?.error) {
          const msg = result.error;
          // Check for duplicate
          if (msg.includes('already been registered') || msg.includes('already exists')) {
            student.status = 'skipped';
            student.message = 'Duplicate - skipped';
            skipped++;
          } else if (result?.existing) {
            student.status = 'skipped';
            student.message = 'Already exists - preserved';
            skipped++;
          } else {
            student.status = 'error';
            student.message = msg;
            errors++;
          }
        } else {
          student.status = 'success';
          student.message = 'Created successfully';
          success++;
        }
      } catch (err) {
        student.status = 'error';
        student.message = (err as Error).message;
        errors++;
      }

      // Force re-render with updated statuses
      setParsedStudents([...parsedStudents]);
    }

    setImportResults({ success, skipped, errors });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['students'] });

    if (success > 0) {
      toast({
        title: 'Import complete',
        description: `${success} student(s) created, ${skipped} skipped, ${errors} failed.`,
      });
    }
  }, [validStudents, currentSchoolId, parsedStudents, queryClient, toast]);

  const downloadTemplate = () => {
    const csv = 'full_name,email,login_id,password,grade,enrollment_number,date_of_birth\nJohn Doe,john@example.com,,password123,Grade 1,STU001,15/01/2015\nJane Smith,,jane01,password456,Grade 2,STU002,22/03/2014\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Students</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple student accounts at once.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                CSV must include columns: <strong>full_name</strong>, <strong>password</strong>, and either <strong>email</strong> or <strong>login_id</strong>.
                Optional: grade, enrollment_number, date_of_birth (dd/mm/yyyy).
              </AlertDescription>
            </Alert>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Click to upload CSV or Excel file</p>
              <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {parseErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                {parsedStudents.length} rows
              </Badge>
              <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {validStudents.length} valid
              </Badge>
              {invalidStudents.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidStudents.length} errors
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 max-h-[40vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email / Login ID</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.map((student, idx) => (
                    <TableRow key={idx} className={student.errors.length > 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{student.row}</TableCell>
                      <TableCell className="font-medium text-sm">{student.full_name || '—'}</TableCell>
                      <TableCell className="text-sm">{student.email || student.login_id || '—'}</TableCell>
                      <TableCell className="text-sm">{student.grade || '—'}</TableCell>
                      <TableCell>
                        {student.errors.length > 0 ? (
                          <span className="text-xs text-destructive">{student.errors.join(', ')}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Ready</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validStudents.length === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import {validStudents.length} Student{validStudents.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Importing students...</p>
              <p className="text-xs text-muted-foreground mt-1">Please don't close this window</p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{importProgress}%</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-semibold text-foreground">Import Complete</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{importResults.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{importResults.errors}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {(importResults.skipped > 0 || importResults.errors > 0) && (
              <ScrollArea className="max-h-[30vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedStudents
                      .filter(s => s.status === 'skipped' || s.status === 'error')
                      .map((student, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{student.full_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={student.status === 'skipped' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {student.status === 'skipped' ? 'Skipped' : 'Error'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {student.message}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleClose(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
