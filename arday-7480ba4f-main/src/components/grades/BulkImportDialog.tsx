import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCreateGrade, type GradeType } from '@/hooks/useGrades';
import { useAuth } from '@/contexts/AuthContext';
import {
  parseCsvContent,
  downloadImportTemplate,
  type ParsedGradeRow,
} from '@/lib/gradesExport';
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentOption {
  id: string;
  profile: { full_name: string | null } | null;
}

interface CourseOption {
  id: string;
  name: string;
  code: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentOption[];
  courses: CourseOption[];
}

export function BulkImportDialog({
  open,
  onOpenChange,
  students,
  courses,
}: BulkImportDialogProps) {
  const [parsedRows, setParsedRows] = useState<ParsedGradeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const createGrade = useCreateGrade();
  const { user } = useAuth();

  const resolveIds = useCallback(
    (rows: ParsedGradeRow[]): ParsedGradeRow[] => {
      return rows.map((row) => {
        const matchedStudent = students.find(
          (s) =>
            s.profile?.full_name?.toLowerCase() === row.student_name.toLowerCase()
        );
        const matchedCourse = courses.find(
          (c) => c.code.toLowerCase() === row.course_code.toLowerCase()
        );

        const errors: string[] = [];
        if (row.error) errors.push(row.error);
        if (!matchedStudent) errors.push(`Student "${row.student_name}" not found`);
        if (!matchedCourse) errors.push(`Course code "${row.course_code}" not found`);

        return {
          ...row,
          student_id: matchedStudent?.id,
          course_id: matchedCourse?.id,
          error: errors.length > 0 ? errors.join('; ') : undefined,
        };
      });
    },
    [students, courses]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCsvContent(content);
      const resolved = resolveIds(parsed);
      setParsedRows(resolved);
      setImportResult(null);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => !!r.error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        await createGrade.mutateAsync({
          student_id: row.student_id!,
          course_id: row.course_id!,
          grade_type: row.grade_type as GradeType,
          title: row.title,
          score: row.score,
          max_score: row.max_score,
          graded_by: user?.id,
          notes: row.notes || undefined,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setImportResult({ success, failed });
    toast({
      title: 'Import complete',
      description: `${success} grades imported${failed > 0 ? `, ${failed} failed` : ''}.`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  const handleClose = () => {
    setParsedRows([]);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Grades</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple grades at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Actions row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={downloadImportTemplate}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {parsedRows.length > 0 && (
              <div className="flex items-center gap-2 ml-auto text-sm">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validRows.length} valid
                </Badge>
                {errorRows.length > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errorRows.length} errors
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Instructions (when no data) */}
          {parsedRows.length === 0 && !importResult && (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Upload a CSV file to get started
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Required columns: <code className="text-xs bg-muted px-1 rounded">student_name</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">course_code</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">grade_type</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">title</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">score</code>. Optional:{' '}
                <code className="text-xs bg-muted px-1 rounded">max_score</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">notes</code>
              </p>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-3" />
              <p className="text-lg font-semibold text-foreground">Import Complete</p>
              <p className="text-sm text-muted-foreground">
                {importResult.success} grades imported successfully
                {importResult.failed > 0 && `, ${importResult.failed} failed`}.
              </p>
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && !importResult && (
            <ScrollArea className="h-[340px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold w-8">#</TableHead>
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Course</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold text-right">Score</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={cn(row.error && 'bg-destructive/5')}
                    >
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-sm">{row.student_name}</TableCell>
                      <TableCell className="text-sm">{row.course_code}</TableCell>
                      <TableCell className="text-sm capitalize">{row.grade_type}</TableCell>
                      <TableCell className="text-sm">{row.title}</TableCell>
                      <TableCell className="text-sm text-right">
                        {row.score}/{row.max_score}
                      </TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="text-xs text-destructive flex items-start gap-1">
                            <X className="h-3 w-3 mt-0.5 shrink-0" />
                            {row.error}
                          </span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Done' : 'Cancel'}
          </Button>
          {parsedRows.length > 0 && !importResult && (
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
            >
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {validRows.length} Grade{validRows.length !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
