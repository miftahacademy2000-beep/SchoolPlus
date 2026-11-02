import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileUp, Download, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { parseImportFile, generateTemplateCSV, downloadCSV, IMPORT_TEMPLATES } from '@/lib/csvUtils';

interface ImportStudentDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportType = 'students' | 'attendance' | 'grades' | 'class_enrollments';

interface ParsedRow {
  data: Record<string, string>;
  valid: boolean;
  error?: string;
}

const TAB_LABELS: Record<ImportType, string> = {
  students: 'Students',
  attendance: 'Attendance',
  grades: 'Grades',
  class_enrollments: 'Enrollments',
};

export function ImportStudentDataModal({ open, onOpenChange }: ImportStudentDataModalProps) {
  const [activeTab, setActiveTab] = useState<ImportType>('students');
  const [parsedData, setParsedData] = useState<Record<string, ParsedRow[]>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; messages: string[] } | null>(null);

  const { currentSchoolId } = useSchoolContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileUpload = (type: ImportType, file: File) => {
    void parseImportFile(file).then(({ rows }) => {
      const template = IMPORT_TEMPLATES[type];

      const parsed: ParsedRow[] = rows.map((row) => {
        const data: Record<string, string> = {};
        template.headers.forEach((h, i) => {
          data[h] = row[i] || '';
        });

        let valid = true;
        let error = '';

        if (type === 'students') {
          if (!data['Full Name']?.trim()) { valid = false; error = 'Name required'; }
        } else if (type === 'attendance') {
          if (!data['Enrollment Number']?.trim()) { valid = false; error = 'Enrollment # required'; }
          if (!data['Class Name']?.trim()) { valid = false; error += ' Class required'; }
          if (!data['Date']?.trim()) { valid = false; error += ' Date required'; }
          const status = data['Status']?.toLowerCase();
          if (!['present', 'absent', 'late'].includes(status)) { valid = false; error += ' Invalid status'; }
        } else if (type === 'grades') {
          if (!data['Enrollment Number']?.trim()) { valid = false; error = 'Enrollment # required'; }
          if (!data['Course Code']?.trim()) { valid = false; error += ' Course code required'; }
          if (!data['Title']?.trim()) { valid = false; error += ' Title required'; }
          if (isNaN(Number(data['Score']))) { valid = false; error += ' Invalid score'; }
        } else if (type === 'class_enrollments') {
          if (!data['Enrollment Number']?.trim()) { valid = false; error = 'Enrollment # required'; }
          if (!data['Class Name']?.trim()) { valid = false; error += ' Class required'; }
        }

        return { data, valid, error: error.trim() || undefined };
      });

      setParsedData((prev) => ({ ...prev, [type]: parsed }));
      setImportResults(null);
    }).catch((error: unknown) => {
      toast({
        title: 'Unable to read import file',
        description: error instanceof Error ? error.message : 'The file could not be parsed.',
        variant: 'destructive',
      });
    });
  };

  const downloadTemplate = (type: ImportType) => {
    const csv = generateTemplateCSV(type);
    downloadCSV(csv, `${type}_template.csv`);
  };

  const handleImport = async () => {
    const rows = parsedData[activeTab];
    if (!rows?.length || !currentSchoolId) return;

    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast({ title: 'No valid rows', description: 'Fix validation errors first.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setProgress(0);
    const messages: string[] = [];
    let success = 0;
    let errors = 0;

    try {
      if (activeTab === 'students') {
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i].data;
          try {
            const response = await api.post<{ error?: string; existing?: boolean }>('/users', {
              full_name: row['Full Name'],
              email: row['Email'] || undefined,
              login_id: !row['Email'] ? row['Enrollment Number'] : undefined,
              password: row['Password'] || 'Temp1234!',
              role: 'student',
              school_id: currentSchoolId,
              enrollment_number: row['Enrollment Number'] || undefined,
              grade: row['Grade'] || undefined,
              date_of_birth: row['Date of Birth'] || undefined,
              phone: row['Phone'] || undefined,
            });
            if (response?.error) throw new Error(response.error);
            if (response.existing) {
              messages.push(`Row ${i + 1} (${row['Full Name']}): already exists; existing account and credentials were preserved`);
            } else {
              success++;
            }
          } catch (err) {
            errors++;
            messages.push(`Row ${i + 1} (${row['Full Name']}): ${(err as Error).message}`);
          }
          setProgress(Math.round(((i + 1) / validRows.length) * 100));
        }
      } else if (activeTab === 'attendance') {
        // Fetch students and classes for mapping
        const studentsResponse = await api.get<{ data: { id: string; enrollment_number: string }[] }>('/students', { params: { school_id: currentSchoolId } });
        const classesResponse = await api.get<{ data: { id: string; name: string }[] }>('/classes', { params: { school_id: currentSchoolId } });
        const students = studentsResponse.data || [];
        const classes = classesResponse.data || [];

        const studentMap: Record<string, string> = {};
        for (const s of students) {
          if (s.enrollment_number) studentMap[s.enrollment_number.toLowerCase()] = s.id;
        }
        const classMap: Record<string, string> = {};
        for (const c of classes) {
          classMap[c.name.toLowerCase()] = c.id;
        }

        const toInsert: any[] = [];
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i].data;
          const studentId = studentMap[row['Enrollment Number'].toLowerCase()];
          const classId = classMap[row['Class Name'].toLowerCase()];
          if (!studentId) { errors++; messages.push(`Row ${i + 1}: Student '${row['Enrollment Number']}' not found`); continue; }
          if (!classId) { errors++; messages.push(`Row ${i + 1}: Class '${row['Class Name']}' not found`); continue; }

          toInsert.push({
            student_id: studentId,
            class_id: classId,
            date: row['Date'],
            status: row['Status'].toLowerCase(),
            notes: row['Notes'] || null,
            marked_by: user?.id || null,
          });
        }

        if (toInsert.length > 0) {
          // Insert in batches of 100
          for (let i = 0; i < toInsert.length; i += 100) {
            const batch = toInsert.slice(i, i + 100);
            try {
              await api.post('/attendance/bulk', { records: batch, school_id: currentSchoolId });
              success += batch.length;
            } catch (err) {
              errors += batch.length;
              messages.push(`Batch error: ${(err as Error).message}`);
            }
            setProgress(Math.round(((i + batch.length) / toInsert.length) * 100));
          }
        }
      } else if (activeTab === 'grades') {
        const studentsResponse = await api.get<{ data: { id: string; enrollment_number: string }[] }>('/students', { params: { school_id: currentSchoolId } });
        const coursesResponse = await api.get<{ data: { id: string; code: string }[] }>('/courses', { params: { school_id: currentSchoolId } });
        const students = studentsResponse.data || [];
        const courses = coursesResponse.data || [];

        const studentMap: Record<string, string> = {};
        for (const s of students) {
          if (s.enrollment_number) studentMap[s.enrollment_number.toLowerCase()] = s.id;
        }
        const courseMap: Record<string, string> = {};
        for (const c of courses) {
          courseMap[c.code.toLowerCase()] = c.id;
        }

        const toInsert: any[] = [];
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i].data;
          const studentId = studentMap[row['Enrollment Number'].toLowerCase()];
          const courseId = courseMap[row['Course Code'].toLowerCase()];
          if (!studentId) { errors++; messages.push(`Row ${i + 1}: Student '${row['Enrollment Number']}' not found`); continue; }
          if (!courseId) { errors++; messages.push(`Row ${i + 1}: Course '${row['Course Code']}' not found`); continue; }

          toInsert.push({
            student_id: studentId,
            course_id: courseId,
            title: row['Title'],
            grade_type: row['Grade Type'] || 'exam',
            score: Number(row['Score']),
            max_score: Number(row['Max Score']) || 100,
            weight: row['Weight'] ? Number(row['Weight']) : 1.0,
            notes: row['Notes'] || null,
            graded_by: user?.id || null,
          });
        }

        if (toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += 100) {
            const batch = toInsert.slice(i, i + 100);
            try {
              await api.post('/grades/bulk', { records: batch, school_id: currentSchoolId });
              success += batch.length;
            } catch (err) {
              errors += batch.length;
              messages.push(`Batch error: ${(err as Error).message}`);
            }
            setProgress(Math.round(((i + batch.length) / toInsert.length) * 100));
          }
        }
      } else if (activeTab === 'class_enrollments') {
        const studentsResponse = await api.get<{ data: { id: string; enrollment_number: string }[] }>('/students', { params: { school_id: currentSchoolId } });
        const classesResponse = await api.get<{ data: { id: string; name: string }[] }>('/classes', { params: { school_id: currentSchoolId } });
        const students = studentsResponse.data || [];
        const classes = classesResponse.data || [];

        const studentMap: Record<string, string> = {};
        for (const s of students) {
          if (s.enrollment_number) studentMap[s.enrollment_number.toLowerCase()] = s.id;
        }
        const classMap: Record<string, string> = {};
        for (const c of classes) {
          classMap[c.name.toLowerCase()] = c.id;
        }

        const toInsert: any[] = [];
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i].data;
          const studentId = studentMap[row['Enrollment Number'].toLowerCase()];
          const classId = classMap[row['Class Name'].toLowerCase()];
          if (!studentId) { errors++; messages.push(`Row ${i + 1}: Student '${row['Enrollment Number']}' not found`); continue; }
          if (!classId) { errors++; messages.push(`Row ${i + 1}: Class '${row['Class Name']}' not found`); continue; }
          toInsert.push({ student_id: studentId, class_id: classId });
        }

        if (toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += 100) {
            const batch = toInsert.slice(i, i + 100);
            try {
              await api.post('/classes/bulk-enrollments', { records: batch, school_id: currentSchoolId });
              success += batch.length;
            } catch (err) {
              errors += batch.length;
              messages.push(`Batch error: ${(err as Error).message}`);
            }
            setProgress(Math.round(((i + batch.length) / toInsert.length) * 100));
          }
        }
      }

      setImportResults({ success, errors, messages });
      if (success > 0) {
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['grades'] });
      }
    } catch (err) {
      toast({ title: 'Import failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const currentData = parsedData[activeTab] || [];
  const validCount = currentData.filter((r) => r.valid).length;
  const invalidCount = currentData.filter((r) => !r.valid).length;

  const handleClose = () => {
    setParsedData({});
    setImportResults(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import Student Data
          </DialogTitle>
          <DialogDescription>
            Upload CSV or Excel files to import student data. Download templates for the correct format.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ImportType); setImportResults(null); }}>
          <TabsList className="grid grid-cols-4">
            {(Object.keys(TAB_LABELS) as ImportType[]).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm">
                {TAB_LABELS[tab]}
                {parsedData[tab]?.length ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                    {parsedData[tab].length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TAB_LABELS) as ImportType[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
              {/* Upload / Template */}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(tab)} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Template
                </Button>
                <div className="relative flex-1">
                  <Input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(tab, file);
                      e.target.value = '';
                    }}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Preview */}
              {parsedData[tab]?.length ? (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{parsedData[tab].length} rows parsed</span>
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {validCount} valid
                    </Badge>
                    {invalidCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> {invalidCount} invalid
                      </Badge>
                    )}
                  </div>

                  <ScrollArea className="max-h-[30vh] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          {IMPORT_TEMPLATES[tab].headers.map((h) => (
                            <TableHead key={h} className="text-xs">{h}</TableHead>
                          ))}
                          <TableHead className="w-20">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData[tab].slice(0, 50).map((row, i) => (
                          <TableRow key={i} className={!row.valid ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            {IMPORT_TEMPLATES[tab].headers.map((h) => (
                              <TableCell key={h} className="text-xs max-w-[120px] truncate">
                                {row.data[h] || '—'}
                              </TableCell>
                            ))}
                            <TableCell>
                              {row.valid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="text-xs text-destructive" title={row.error}>
                                  <AlertTriangle className="h-4 w-4 inline" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsedData[tab].length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing first 50 of {parsedData[tab].length} rows
                      </p>
                    )}
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Upload a CSV or Excel file or download the template first
                </div>
              )}

              {/* Progress / Results */}
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">Importing... {progress}%</p>
                </div>
              )}

              {importResults && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> {importResults.success} imported
                    </span>
                    {importResults.errors > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" /> {importResults.errors} failed
                      </span>
                    )}
                  </div>
                  {importResults.messages.length > 0 && (
                    <ScrollArea className="max-h-24">
                      <div className="space-y-0.5">
                        {importResults.messages.map((m, i) => (
                          <p key={i} className="text-xs text-destructive">{m}</p>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button
            onClick={handleImport}
            disabled={importing || !currentData.length || validCount === 0}
            className="gap-2"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import {validCount} Record(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
