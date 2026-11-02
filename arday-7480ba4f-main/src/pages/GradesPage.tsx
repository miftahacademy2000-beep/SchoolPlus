import { useState, useMemo } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { StatCard } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  useGrades, 
  useCourses, 
  useCreateGrade, 
  useUpdateGrade,
  useDeleteGrade,
  type GradeType,
  type GradeRecord 
} from '@/hooks/useGrades';
import { useStudents } from '@/hooks/useStudents';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, 
  Loader2, 
  Plus, 
  FileText, 
  Trash2,
  TrendingUp,
  BookOpen,
  Pencil,
  Award,
  Users,
  BarChart3,
  Target,
  Download,
   Upload,
   ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { exportGradesToCsv, exportGradesToPdf } from '@/lib/gradesExport';
import { BulkImportDialog } from '@/components/grades/BulkImportDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const gradeTypeLabels: Record<GradeType, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  project: 'Project',
  participation: 'Participation',
};

const gradeTypeColors: Record<GradeType, string> = {
  assignment: 'bg-primary/10 text-primary border-primary/20',
  quiz: 'bg-[hsl(var(--super-admin))]/10 text-[hsl(var(--super-admin))] border-[hsl(var(--super-admin))]/20',
  exam: 'bg-destructive/10 text-destructive border-destructive/20',
  project: 'bg-success/10 text-success border-success/20',
  participation: 'bg-warning/10 text-warning border-warning/20',
};

const PIE_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
];

export default function GradesPage() {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [gradeToDelete, setGradeToDelete] = useState<GradeRecord | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [gradeType, setGradeType] = useState<GradeType>('assignment');
  const [title, setTitle] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('1');
  const [notes, setNotes] = useState('');
  
  const { user, primaryRole, isSuperAdmin } = useAuth();
  const { data: grades, isLoading } = useGrades(
    courseFilter !== 'all' ? courseFilter : undefined
  );
  const { data: courses } = useCourses();
  const { data: students } = useStudents();
  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  const canManageGrades = isSuperAdmin || primaryRole === 'school_admin' || primaryRole === 'teacher';

  const filteredGrades = grades?.filter((grade) => {
    const matchesSearch =
      !search ||
      grade.title.toLowerCase().includes(search.toLowerCase()) ||
      grade.student?.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || grade.grade_type === typeFilter;
    const matchesStudent = studentFilter === 'all' || grade.student_id === studentFilter;
    return matchesSearch && matchesType && matchesStudent;
  });

  // Stats
  const stats = useMemo(() => {
    if (!grades || grades.length === 0) return null;
    const total = grades.length;
    const avgScore = Math.round(
      grades.reduce((acc, g) => acc + (g.score / g.max_score) * 100, 0) / total
    );
    // Weighted average: sum(score/max * weight) / sum(weight)
    const totalWeight = grades.reduce((acc, g) => acc + (g.weight || 1), 0);
    const weightedAvg = totalWeight > 0
      ? Math.round(grades.reduce((acc, g) => acc + (g.score / g.max_score) * 100 * (g.weight || 1), 0) / totalWeight)
      : avgScore;
    const uniqueStudents = new Set(grades.map(g => g.student_id)).size;
    const highPerformers = grades.filter(g => (g.score / g.max_score) * 100 >= 90).length;
    return { total, avgScore, weightedAvg, uniqueStudents, highPerformers };
  }, [grades]);

  // Chart data
  const typeDistribution = useMemo(() => {
    if (!grades || grades.length === 0) return [];
    const counts: Record<string, number> = {};
    grades.forEach(g => {
      counts[g.grade_type] = (counts[g.grade_type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      name: gradeTypeLabels[type as GradeType] || type,
      value: count,
    }));
  }, [grades]);

  const scoreDistribution = useMemo(() => {
    if (!grades || grades.length === 0) return [];
    const buckets = [
      { range: '0-49%', min: 0, max: 49, count: 0 },
      { range: '50-69%', min: 50, max: 69, count: 0 },
      { range: '70-79%', min: 70, max: 79, count: 0 },
      { range: '80-89%', min: 80, max: 89, count: 0 },
      { range: '90-100%', min: 90, max: 100, count: 0 },
    ];
    grades.forEach(g => {
      const pct = (g.score / g.max_score) * 100;
      const bucket = buckets.find(b => pct >= b.min && pct <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map(b => ({ name: b.range, count: b.count }));
  }, [grades]);

  // Per-course weighted averages
  const courseWeightedAverages = useMemo(() => {
    if (!grades || grades.length === 0) return [];
    const courseMap: Record<string, { name: string; totalWeightedScore: number; totalWeight: number }> = {};
    grades.forEach(g => {
      const courseId = g.course_id;
      const courseName = g.course?.name || 'Unknown';
      if (!courseMap[courseId]) {
        courseMap[courseId] = { name: courseName, totalWeightedScore: 0, totalWeight: 0 };
      }
      const w = g.weight || 1;
      courseMap[courseId].totalWeightedScore += (g.score / g.max_score) * 100 * w;
      courseMap[courseId].totalWeight += w;
    });
    return Object.values(courseMap)
      .map(c => ({ name: c.name, average: Math.round(c.totalWeightedScore / c.totalWeight) }))
      .sort((a, b) => b.average - a.average);
  }, [grades]);

  const handleAddGrade = async () => {
    if (!selectedStudent || !selectedCourse || !title.trim() || !score) return;
    await createGrade.mutateAsync({
      student_id: selectedStudent,
      course_id: selectedCourse,
      grade_type: gradeType,
      title: title.trim(),
      score: parseFloat(score),
      max_score: parseFloat(maxScore) || 100,
      weight: parseFloat(weight) || 1,
      graded_by: user?.id,
      notes: notes.trim() || undefined,
    });
    resetForm();
    setAddDialogOpen(false);
  };

  const handleEditGrade = async () => {
    if (!editingGrade || !title.trim() || !score) return;
    await updateGrade.mutateAsync({
      id: editingGrade.id,
      grade_type: gradeType,
      title: title.trim(),
      score: parseFloat(score),
      max_score: parseFloat(maxScore) || 100,
      weight: parseFloat(weight) || 1,
      notes: notes.trim() || undefined,
    });
    resetForm();
    setEditingGrade(null);
  };

  const openEditDialog = (grade: GradeRecord) => {
    setEditingGrade(grade);
    setGradeType(grade.grade_type);
    setTitle(grade.title);
    setScore(String(grade.score));
    setMaxScore(String(grade.max_score));
    setWeight(String(grade.weight || 1));
    setNotes(grade.notes || '');
  };

  const handleDelete = async () => {
    if (!gradeToDelete) return;
    await deleteGrade.mutateAsync(gradeToDelete.id);
    setGradeToDelete(null);
  };

  const filteredFormStudents = useMemo(() => {
    if (!students) return [];
    if (!studentSearchQuery.trim()) return students;
    const q = studentSearchQuery.toLowerCase();
    return students.filter(s =>
      (s.profile?.full_name || '').toLowerCase().includes(q) ||
      (s.enrollment_number || '').toLowerCase().includes(q)
    );
  }, [students, studentSearchQuery]);

  const resetForm = () => {
    setSelectedStudent('');
    setStudentSearchQuery('');
    setSelectedCourse('');
    setGradeType('assignment');
    setTitle('');
    setScore('');
    setMaxScore('100');
    setWeight('1');
    setNotes('');
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-primary';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBg = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'bg-success/10';
    if (percentage >= 70) return 'bg-primary/10';
    if (percentage >= 50) return 'bg-warning/10';
    return 'bg-destructive/10';
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Grades"
        description={canManageGrades ? "Manage student grades and assessments" : "View grades and assessments"}
        breadcrumbs={[{ label: 'Grades' }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            {filteredGrades && filteredGrades.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportGradesToCsv(filteredGrades)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportGradesToPdf(filteredGrades)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Import + Add (teachers/admins only) */}
            {canManageGrades && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Grade
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Total Grades"
            value={stats.total}
            icon={<FileText className="h-5 w-5" />}
            color="primary"
            delay={0}
          />
          <StatCard
            title="Simple Average"
            value={`${stats.avgScore}%`}
            icon={<Target className="h-5 w-5" />}
            color={stats.avgScore >= 70 ? 'success' : 'warning'}
            trend={stats.avgScore >= 70 ? 'up' : 'down'}
            delay={0.05}
          />
          <StatCard
            title="Weighted Average"
            value={`${stats.weightedAvg}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            color={stats.weightedAvg >= 70 ? 'success' : 'warning'}
            trend={stats.weightedAvg >= 70 ? 'up' : 'down'}
            delay={0.08}
          />
          <StatCard
            title="Students Graded"
            value={stats.uniqueStudents}
            icon={<Users className="h-5 w-5" />}
            color="info"
            delay={0.1}
          />
          <StatCard
            title="High Performers (90%+)"
            value={stats.highPerformers}
            icon={<Award className="h-5 w-5" />}
            color="success"
            delay={0.15}
          />
        </div>
      )}

      {/* Analytics Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(215, 16%, 47%)' }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(215, 16%, 47%)' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(214, 32%, 91%)',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Grade Types
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {typeDistribution.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Weighted Avg by Course
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={courseWeightedAverages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(215, 16%, 47%)' }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(214, 32%, 91%)',
                        borderRadius: '0.5rem',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Weighted Avg']}
                    />
                    <Bar dataKey="average" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(gradeTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by student" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.profile?.full_name || 'Unknown'} {s.enrollment_number ? `(${s.enrollment_number})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredGrades?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No grades found</h2>
          <p className="text-sm text-muted-foreground">
            {search || courseFilter !== 'all' || typeFilter !== 'all' || studentFilter !== 'all'
              ? 'Try adjusting your filters'
              : canManageGrades
              ? 'Add grades to track student performance'
              : 'No grades available yet'}
          </p>
          {!search && courseFilter === 'all' && typeFilter === 'all' && studentFilter === 'all' && canManageGrades && (
            <Button className="mt-4 gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Grade
            </Button>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Course</TableHead>
                    <TableHead className="font-semibold">Assessment</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold text-right">Score</TableHead>
                    <TableHead className="font-semibold text-right">Weight</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    {canManageGrades && <TableHead className="w-[80px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrades?.map((grade) => (
                    <TableRow key={grade.id} className="data-table-row">
                      <TableCell className="font-medium">
                        {grade.student?.profile?.full_name || 'Unknown Student'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{grade.course?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{grade.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", gradeTypeColors[grade.grade_type])}>
                          {gradeTypeLabels[grade.grade_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold",
                          getScoreBg(grade.score, grade.max_score),
                          getScoreColor(grade.score, grade.max_score)
                        )}>
                          {grade.score}/{grade.max_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {grade.weight || 1}×
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(grade.graded_at), 'MMM d, yyyy')}
                      </TableCell>
                      {canManageGrades && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEditDialog(grade)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setGradeToDelete(grade)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Grade Dialog */}
      {canManageGrades && (
        <>
          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Grade</DialogTitle>
                <DialogDescription>Record a new grade for a student</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Student</Label>
                  <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedStudent
                          ? students?.find(s => s.id === selectedStudent)?.profile?.full_name || 'Unknown'
                          : 'Select student'}
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
                        {filteredFormStudents.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-3 text-center">No students found</p>
                        ) : (
                          filteredFormStudents.map(s => (
                            <button
                              key={s.id}
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer',
                                selectedStudent === s.id && 'bg-accent font-medium'
                              )}
                              onClick={() => {
                                setSelectedStudent(s.id);
                                setStudentSearchOpen(false);
                                setStudentSearchQuery('');
                              }}
                            >
                              {s.profile?.full_name || 'Unknown'}
                              {s.enrollment_number && (
                                <span className="ml-1.5 text-xs text-muted-foreground">({s.enrollment_number})</span>
                              )}
                            </button>
                          ))
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label>Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name} ({course.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={gradeType} onValueChange={(v) => setGradeType(v as GradeType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(gradeTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g., Midterm Exam, Quiz 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Score</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max Score</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Weight</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      min="0.1"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Additional comments..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddGrade} 
                  disabled={!selectedStudent || !selectedCourse || !title.trim() || !score || createGrade.isPending}
                >
                  {createGrade.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Grade
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Grade Dialog */}
          <Dialog open={!!editingGrade} onOpenChange={(open) => {
            if (!open) {
              setEditingGrade(null);
              resetForm();
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Grade</DialogTitle>
                <DialogDescription>
                  Update grade for {editingGrade?.student?.profile?.full_name || 'student'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={gradeType} onValueChange={(v) => setGradeType(v as GradeType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(gradeTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g., Midterm Exam, Quiz 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Score</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max Score</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Weight</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      min="0.1"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Additional comments..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditingGrade(null); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEditGrade} 
                  disabled={!title.trim() || !score || updateGrade.isPending}
                >
                  {updateGrade.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!gradeToDelete} onOpenChange={() => setGradeToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Grade</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this grade for <strong>{gradeToDelete?.student?.profile?.full_name}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Bulk Import Dialog */}
      {canManageGrades && (
        <BulkImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          students={students || []}
          courses={courses || []}
        />
      )}
    </DashboardLayout>
  );
}
