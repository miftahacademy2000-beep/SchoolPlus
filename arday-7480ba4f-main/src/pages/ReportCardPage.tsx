import { useState, useMemo } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GraduationCap,
  TrendingUp,
  Award,
  BookOpen,
  Loader2,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { useGrades, useCourses } from '@/hooks/useGrades';
import { useStudents } from '@/hooks/useStudents';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { compareByEnrollmentNumber } from '@/lib/studentSorting';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// GPA scale: A=4.0, B=3.0, C=2.0, D=1.0, F=0
function percentageToGradePoint(pct: number): number {
  if (pct >= 90) return 4.0;
  if (pct >= 80) return 3.0;
  if (pct >= 70) return 2.0;
  if (pct >= 60) return 1.0;
  return 0.0;
}

function percentageToLetter(pct: number): string {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}

function getLetterColor(letter: string): string {
  if (letter.startsWith('A')) return 'text-green-600 dark:text-green-400';
  if (letter.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
  if (letter.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
  if (letter.startsWith('D')) return 'text-orange-600 dark:text-orange-400';
  return 'text-destructive';
}

function getGpaBadgeVariant(gpa: number): string {
  if (gpa >= 3.5) return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30';
  if (gpa >= 2.5) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
  if (gpa >= 1.5) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
  return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
}

interface CourseGradeGroup {
  courseId: string;
  courseName: string;
  courseCode: string;
  grades: Array<{
    id: string;
    title: string;
    grade_type: string;
    score: number;
    max_score: number;
    weight: number | null;
    graded_at: string;
    notes: string | null;
  }>;
  simpleAvg: number;
  weightedAvg: number;
  letterGrade: string;
  gradePoint: number;
}

export default function ReportCardPage() {
  const { roles } = useAuth();
  const { currentSchoolId } = useSchoolContext();
  const { id: routeStudentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: student, isError, error, refetch } = useQuery({
    queryKey: ['student-profile', currentSchoolId, routeStudentId],
    queryFn: async () => {
      if (!routeStudentId) return null;
      const { data } = await api.get(`/students/${routeStudentId}`, {
        params: { school_id: currentSchoolId },
      });
      return data;
    },
    enabled: !!routeStudentId,
  });
  const { data: examResults, isExamLoading, refetch: refetchExams } = useQuery({
    queryKey: ['student-exam-results', currentSchoolId, routeStudentId],
    queryFn: async () => {
      if (!routeStudentId) return null;
      const response = await api.get<{ data: { student: any; examResults: any[] } }>(`/students/${routeStudentId}/exam-results`, {
        params: { school_id: currentSchoolId },
      });
      return response.data;
    },
    enabled: !!routeStudentId,
  });

  const isSuperAdmin = roles.some(r => r.role === 'super_admin');
  const isSchoolAdmin = roles.some(r => r.role === 'school_admin');
  const isTeacher = roles.some(r => r.role === 'teacher');
  const canSelectStudent = isSuperAdmin || isSchoolAdmin || isTeacher;

  // Group grades by course
  const courseGroups = useMemo((): CourseGradeGroup[] => {
    if (!allGrades?.length) return [];

    const grouped = new Map<string, CourseGradeGroup>();

    for (const g of allGrades) {
      const courseId = g.course_id;
      const courseName = g.course?.name || 'Unknown Course';
      const courseCode = g.course?.code || '---';

      if (!grouped.has(courseId)) {
        grouped.set(courseId, {
          courseId,
          courseName,
          courseCode,
          grades: [],
          simpleAvg: 0,
          weightedAvg: 0,
          letterGrade: 'N/A',
          gradePoint: 0,
        });
      }

      grouped.get(courseId)!.grades.push({
        id: g.id,
        title: g.title,
        grade_type: g.grade_type,
        score: g.score,
        max_score: g.max_score,
        weight: g.weight,
        graded_at: g.graded_at,
        notes: g.notes,
      });
    }

    // Calculate averages for each course
    for (const group of grouped.values()) {
      const totalSimple = group.grades.reduce((s, g) => s + (g.score / g.max_score) * 100, 0);
      group.simpleAvg = totalSimple / group.grades.length;

      const totalWeightedScore = group.grades.reduce((s, g) => s + (g.score / g.max_score) * 100 * (g.weight || 1), 0);
      const totalWeight = group.grades.reduce((s, g) => s + (g.weight || 1), 0);
      group.weightedAvg = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

      group.letterGrade = percentageToLetter(group.weightedAvg);
      group.gradePoint = percentageToGradePoint(group.weightedAvg);
    }

    return Array.from(grouped.values()).sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [allGrades]);

  const filteredCourseGroups = useMemo(() => {
    if (!courseSearch.trim()) return courseGroups;
    const q = courseSearch.toLowerCase();
    return courseGroups.filter(cg =>
      cg.courseName.toLowerCase().includes(q) ||
      cg.courseCode.toLowerCase().includes(q)
    );
  }, [courseGroups, courseSearch]);

  // Calculate cumulative GPA
  const cumulativeGPA = useMemo(() => {
    if (!courseGroups.length) return 0;
    const totalPoints = courseGroups.reduce((s, c) => s + c.gradePoint, 0);
    return totalPoints / courseGroups.length;
  }, [courseGroups]);

  const overallAvg = useMemo(() => {
    if (!courseGroups.length) return 0;
    return courseGroups.reduce((s, c) => s + c.weightedAvg, 0) / courseGroups.length;
  }, [courseGroups]);

  const toggleCourse = (courseId: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    let list = students;
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase();
      list = list.filter(s =>
        (s.profile?.full_name || '').toLowerCase().includes(q) ||
        (s.enrollment_number || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => compareByEnrollmentNumber(a, b));
  }, [students, studentSearchQuery]);

  const studentName = useMemo(() => {
    if (!routeStudentId) {
      if (!selectedStudentId || !students) return '';
      const s = students.find(st => st.id === selectedStudentId);
      return s?.profile?.full_name || 'Student';
    }
    const s = students?.find(st => st.id === routeStudentId);
    return s?.profile?.full_name || 'Student';
  }, [routeStudentId, selectedStudentId, students]);

  // PDF export
  const exportReportCardPdf = () => {
    if (!courseGroups.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Report Card', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    if (studentName) {
      doc.text(`Student: ${studentName}`, 14, y);
      y += 6;
    }
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 14, y);
    y += 6;
    doc.text(`Cumulative GPA: ${cumulativeGPA.toFixed(2)} / 4.00`, 14, y);
    y += 6;
    doc.text(`Overall Average: ${overallAvg.toFixed(1)}%`, 14, y);
    y += 12;

    // Course summary table
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Course Summary', 14, y);
    y += 8;

    // Table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
    doc.text('Course', 16, y);
    doc.text('Code', 80, y);
    doc.text('Avg %', 110, y);
    doc.text('Letter', 135, y);
    doc.text('GPA', 160, y);
    doc.text('Grades', 180, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    for (const cg of courseGroups) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(cg.courseName.substring(0, 30), 16, y);
      doc.text(cg.courseCode, 80, y);
      doc.text(`${cg.weightedAvg.toFixed(1)}%`, 110, y);
      doc.text(cg.letterGrade, 135, y);
      doc.text(cg.gradePoint.toFixed(1), 160, y);
      doc.text(`${cg.grades.length}`, 180, y);
      y += 6;
    }

    y += 10;

    // Detailed grades per course
    for (const cg of courseGroups) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${cg.courseName} (${cg.courseCode})`, 14, y);
      y += 7;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, pageWidth - 28, 7, 'F');
      doc.text('Title', 16, y);
      doc.text('Type', 90, y);
      doc.text('Score', 120, y);
      doc.text('Weight', 145, y);
      doc.text('Date', 165, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const grade of cg.grades) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(grade.title.substring(0, 35), 16, y);
        doc.text(grade.grade_type, 90, y);
        doc.text(`${grade.score}/${grade.max_score}`, 120, y);
        doc.text(`${grade.weight || 1}`, 145, y);
        doc.text(format(new Date(grade.graded_at), 'MMM d, yyyy'), 165, y);
        y += 5;
      }
      y += 6;
    }

    doc.save(`report-card${studentName ? `-${studentName.replace(/\s+/g, '-')}` : ''}.pdf`);
  };

  const isLoading = studentsLoading || gradesLoading;

  return (
    <DashboardLayout>
      <PageHeader
        title="Student Report Card"
        description="View grades grouped by course with GPA calculation"
        breadcrumbs={[{ label: 'Grades', href: '/grades' }, { label: 'Report Card' }]}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {canSelectStudent && (
          <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full sm:w-[280px] justify-between">
                {selectedStudentId
                  ? students?.find(s => s.id === selectedStudentId)?.profile?.full_name || 'Unnamed'
                  : 'Select a student'}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search by name or ID..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              <ScrollArea className="max-h-[200px]">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">No students found</p>
                ) : (
                  filteredStudents.map(s => (
                    <button
                      key={s.id}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer',
                        selectedStudentId === s.id && 'bg-accent font-medium'
                      )}
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setStudentSearchOpen(false);
                        setStudentSearchQuery('');
                      }}
                    >
                      {s.profile?.full_name || 'Unnamed'}
                      {s.enrollment_number && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({s.enrollment_number})</span>
                      )}
                    </button>
                  ))
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        {courseGroups.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={exportReportCardPdf}>
              <Download className="h-4 w-4 mr-1.5" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          </div>
        )}
      </div>

      {!selectedStudentId && canSelectStudent ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Select a student to view their report card</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : courseGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No grades found for this student</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* GPA Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 grid-cols-2 md:grid-cols-4"
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{cumulativeGPA.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Cumulative GPA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overallAvg.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Overall Average</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{courseGroups.length}</p>
                    <p className="text-xs text-muted-foreground">Courses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{allGrades?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Grades</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* GPA Progress Bar */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">GPA Progress</span>
                  <Badge className={cn('text-xs', getGpaBadgeVariant(cumulativeGPA))}>
                    {percentageToLetter(overallAvg)}
                  </Badge>
                </div>
                <Progress value={(cumulativeGPA / 4.0) * 100} className="h-3" />
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>1.0</span>
                  <span>2.0</span>
                  <span>3.0</span>
                  <span>4.0</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Course Summary Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">Course Summary</CardTitle>
                    <CardDescription>Click a course to see individual grades</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search courses..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="hidden sm:table-cell">Code</TableHead>
                      <TableHead className="text-center">Grades</TableHead>
                      <TableHead className="text-center">Avg</TableHead>
                      <TableHead className="text-center">Letter</TableHead>
                      <TableHead className="text-center">GPA</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourseGroups.map((cg) => (
                      <Collapsible key={cg.courseId} open={expandedCourses.has(cg.courseId)} onOpenChange={() => toggleCourse(cg.courseId)} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-medium">{cg.courseName}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="text-xs">{cg.courseCode}</Badge>
                              </TableCell>
                              <TableCell className="text-center">{cg.grades.length}</TableCell>
                              <TableCell className="text-center font-medium">{cg.weightedAvg.toFixed(1)}%</TableCell>
                              <TableCell className="text-center">
                                <span className={cn('font-bold', getLetterColor(cg.letterGrade))}>
                                  {cg.letterGrade}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={cn('text-xs', getGpaBadgeVariant(cg.gradePoint))}>
                                  {cg.gradePoint.toFixed(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {expandedCourses.has(cg.courseId) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={7} className="p-0">
                                <div className="bg-muted/30 px-4 py-3 border-t border-b">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs">Title</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs text-center">Score</TableHead>
                                        <TableHead className="text-xs text-center">Weight</TableHead>
                                        <TableHead className="text-xs text-center hidden sm:table-cell">Date</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {cg.grades.map((grade) => {
                                        const pct = (grade.score / grade.max_score) * 100;
                                        return (
                                          <TableRow key={grade.id} className="hover:bg-transparent">
                                            <TableCell className="py-2 text-sm">{grade.title}</TableCell>
                                            <TableCell className="py-2">
                                              <Badge variant="secondary" className="text-xs capitalize">
                                                {grade.grade_type}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                              <span className={cn('font-medium text-sm', getLetterColor(percentageToLetter(pct)))}>
                                                {grade.score}/{grade.max_score}
                                              </span>
                                            </TableCell>
                                            <TableCell className="py-2 text-center text-sm text-muted-foreground">
                                              ×{grade.weight || 1}
                                            </TableCell>
                                            <TableCell className="py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">
                                              {format(new Date(grade.graded_at), 'MMM d, yyyy')}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
