import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { generateCSV, downloadCSV } from '@/lib/csvUtils';

interface ExportStudentDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPORT_OPTIONS = [
  { key: 'students', label: 'Student Profiles', description: 'Names, emails, IDs, grades, DOB' },
  { key: 'attendance', label: 'Attendance Records', description: 'All attendance history by class' },
  { key: 'grades', label: 'Grades & Results', description: 'All grade records by course' },
  { key: 'class_enrollments', label: 'Class Enrollments', description: 'Student-class assignments' },
  { key: 'courses', label: 'Courses', description: 'School course catalog' },
];

const CSV_HEADERS: Record<string, string[]> = {
  students: ['Full Name', 'Email', 'Phone', 'Enrollment Number', 'Class', 'Grade', 'Start Date', 'Date of Birth', 'Status', 'Monthly Fee', 'Balance'],
  attendance: ['Enrollment Number', 'Student Name', 'Class Name', 'Date', 'Status', 'Notes'],
  grades: ['Enrollment Number', 'Student Name', 'Course Code', 'Course Name', 'Title', 'Grade Type', 'Score', 'Max Score', 'Weight', 'Notes', 'Graded At'],
  class_enrollments: ['Enrollment Number', 'Student Name', 'Class Name', 'Class Grade', 'Class Section'],
  courses: ['Code', 'Name', 'Description', 'Credits'],
};

export function ExportStudentDataModal({ open, onOpenChange }: ExportStudentDataModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['students']));
  const [loading, setLoading] = useState(false);
  const { currentSchoolId } = useSchoolContext();
  const { toast } = useToast();

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleExport = async () => {
    if (!currentSchoolId || selected.size === 0) return;
    setLoading(true);

    try {
      const response = await api.post<{ data?: Record<string, Record<string, unknown>[]> }>('/export/student-data', {
        school_id: currentSchoolId,
        types: Array.from(selected),
      });

      const data = response.data || {};
      const exportedStudents = Array.isArray(data.students) ? data.students as Record<string, unknown>[] : [];
      let downloadCount = 0;

      for (const type of Array.from(selected)) {
        const records = type === 'students'
          ? exportedStudents
          : type === 'class_enrollments'
            ? exportedStudents.flatMap((student) => {
                const enrollments = Array.isArray(student.enrollments) ? student.enrollments as Record<string, unknown>[] : [];
                return enrollments.map((enrollment) => ({
                  enrollmentNumber: student.enrollmentNumber,
                  fullName: student.fullName,
                  className: enrollment.className,
                  classGrade: enrollment.classGrade,
                  classSection: enrollment.classSection,
                }));
              })
            : type === 'attendance' || type === 'grades' || type === 'courses'
              ? exportedStudents.flatMap((student) => {
                  const nested = student[type];
                  if (!Array.isArray(nested)) return [];
                  return nested.map((record) => ({
                    enrollmentNumber: student.enrollmentNumber,
                    fullName: student.fullName,
                    ...(record as Record<string, unknown>),
                  }));
                })
              : data[type] as Record<string, unknown>[] | undefined;
        if (!records?.length) continue;

        const headers = CSV_HEADERS[type];
        const rows = records.map((r) => {
          if (type === 'students') {
            return [r.fullName, r.email, r.phone, r.enrollmentNumber, r.className, r.grade, r.startDate, r.dateOfBirth, r.status, r.monthlyFee, r.balance]
              .map((value) => String(value ?? ''));
          }
          const rowFields: Record<string, string> = {
            'Full Name': 'fullName',
            Email: 'email',
            Phone: 'phone',
            'Enrollment Number': 'enrollmentNumber',
            Grade: 'grade',
            'Date of Birth': 'dateOfBirth',
            'Student Name': 'fullName',
            'Class Name': 'className',
            'Class Grade': 'classGrade',
            'Class Section': 'classSection',
            Date: 'date',
            Status: 'status',
            Notes: 'notes',
            'Course Code': 'courseCode',
            'Course Name': 'courseName',
            Title: 'title',
            'Grade Type': 'gradeType',
            Score: 'score',
            'Max Score': 'maxScore',
            Weight: 'weight',
            'Graded At': 'gradedAt',
            Code: 'code',
            Name: 'name',
            Description: 'description',
            Credits: 'credits',
          };
          return headers.map((header) => String(r[rowFields[header] || header] ?? ''));
        });

        const csv = generateCSV(headers, rows);
        downloadCSV(csv, `${type}_export.csv`);
        downloadCount++;
      }

      if (downloadCount === 0) {
        toast({ title: 'No data', description: 'No records found for the selected types.' });
      } else {
        toast({ title: 'Export complete', description: `${downloadCount} file(s) downloaded.` });
      }
    } catch (err) {
      toast({ title: 'Export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export Student Data
          </DialogTitle>
          <DialogDescription>
            Select data types to export as CSV files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {EXPORT_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.has(opt.key)}
                onCheckedChange={() => toggle(opt.key)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={loading || selected.size === 0} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export {selected.size} Type(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
