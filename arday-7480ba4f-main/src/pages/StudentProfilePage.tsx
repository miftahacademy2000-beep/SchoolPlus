import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, GraduationCap, Hash, Loader2 } from 'lucide-react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';

interface StudentApiRecord {
  id: string;
  userId?: string;
  user_id?: string;
  schoolId?: string;
  school_id?: string;
  enrollmentNumber?: string | null;
  enrollment_number?: string | null;
  grade?: string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  createdAt?: string;
  created_at?: string;
  parentId?: string | null;
  parent_id?: string | null;
  profile?: {
    fullName?: string | null;
    full_name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
  } | null;
}

// Raw shape returned by GET /students/:id/exam-results
interface RawExamResult {
  id: string;
  score: number | null;
  max_score: number | null;
  weight: number | null;
  created_at?: string | null;
  exam_types?: { id?: string; name?: string | null } | null;
  subjects?: { id?: string; name?: string | null } | null;
  terms?: { id?: string; name?: string | null } | null;
}

interface ExamResultApi {
  student: StudentApiRecord;
  examResults: RawExamResult[];
}

interface AssessmentRow {
  id: string;
  examType: string;
  subject: string;
  term: string | null;
  score: number | null;
  maxScore: number | null;
  weight: number | null;
  /** score / maxScore * 100, or null when not derivable from real data */
  percentage: number | null;
}

interface SubjectSummary {
  name: string;
  count: number;
  averagePercentage: number | null;
}

// Grading scale shared with the report card (ReportCardPage).
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

function toPercentage(score: number | null, maxScore: number | null): number | null {
  if (score === null || score === undefined || maxScore === null || maxScore === undefined || maxScore <= 0) {
    return null;
  }
  return (score / maxScore) * 100;
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentSchoolId } = useSchoolContext();

  const { data: student, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-profile-detail', currentSchoolId, id],
    queryFn: async () => {
      if (!id || !currentSchoolId) throw new Error('Select a school to view this student.');
      const response = await api.get<{ data: StudentApiRecord }>(`/students/${id}`, {
        params: { school_id: currentSchoolId },
      });
      return response.data;
    },
    enabled: Boolean(id && currentSchoolId),
  });

  const {
    data: examResults,
    isLoading: isExamLoading,
    isError: isExamError,
    error: examError,
    refetch: refetchExams,
  } = useQuery({
    queryKey: ['student-exam-results', currentSchoolId, id],
    queryFn: async () => {
      if (!id || !currentSchoolId) return null;
      const response = await api.get<{ data: ExamResultApi }>(`/students/${id}/exam-results`, {
        params: { school_id: currentSchoolId },
      });
      return response.data;
    },
    enabled: Boolean(id && currentSchoolId),
  });

  // Map the real exam records returned by the backend.
  const assessments: AssessmentRow[] = (examResults?.examResults ?? []).map((exam) => ({
    id: exam.id,
    examType: exam.exam_types?.name || 'Assessment',
    subject: exam.subjects?.name || 'Unspecified subject',
    term: exam.terms?.name || null,
    score: exam.score,
    maxScore: exam.max_score,
    weight: exam.weight,
    percentage: toPercentage(exam.score, exam.max_score),
  }));

  const assessmentCount = assessments.length;
  const scoredAssessments = assessments.filter((a) => a.percentage !== null);
  const overallAverage =
    scoredAssessments.length > 0
      ? scoredAssessments.reduce((sum, a) => sum + (a.percentage as number), 0) / scoredAssessments.length
      : null;

  // Group real assessments by subject.
  const subjectMap = new Map<string, { count: number; percentages: number[] }>();
  for (const a of assessments) {
    const entry = subjectMap.get(a.subject) ?? { count: 0, percentages: [] };
    entry.count += 1;
    if (a.percentage !== null) entry.percentages.push(a.percentage);
    subjectMap.set(a.subject, entry);
  }
  const subjects: SubjectSummary[] = Array.from(subjectMap.entries())
    .map(([name, entry]) => ({
      name,
      count: entry.count,
      averagePercentage:
        entry.percentages.length > 0
          ? entry.percentages.reduce((s, p) => s + p, 0) / entry.percentages.length
          : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const name = student?.profile?.full_name ?? student?.profile?.fullName ?? 'Unnamed Student';
  const email = student?.profile?.email;
  const avatarUrl = student?.profile?.avatar_url ?? student?.profile?.avatarUrl;
  const enrollmentNumber = student?.enrollment_number ?? student?.enrollmentNumber;
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <DashboardLayout>
      <PageHeader
        title={isLoading ? 'Student Profile' : name}
        description="Student information and enrollment details"
        breadcrumbs={[{ label: 'Students', href: '/students' }, { label: name }]}
      />

      <div className="mb-6">
        <Button variant="outline" onClick={() => navigate('/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24" role="status" aria-label="Loading student profile">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError || !student ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Unable to load student profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'The student may not exist or you may not have access.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => void refetch()}>Try again</Button>
              <Button onClick={() => navigate('/students')}>Back to Students</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Avatar className="mb-4 h-24 w-24 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} alt={name} />
                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{name}</h2>
              {email && <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {student.grade && (
                  <Badge variant="secondary">
                    <GraduationCap className="mr-1 h-3 w-3" />
                    {student.grade}
                  </Badge>
                )}
                {enrollmentNumber && (
                  <Badge variant="outline">
                    <Hash className="mr-1 h-3 w-3" />
                    {enrollmentNumber}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exams</CardTitle>
            </CardHeader>
            <CardContent>
              {isExamLoading ? (
                <div className="flex items-center justify-center py-8" role="status" aria-label="Loading exam results">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isExamError ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
                  <p className="text-sm font-medium">Unable to load exam results</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {examError instanceof Error ? examError.message : 'Something went wrong while fetching exam results.'}
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => void refetchExams()}>
                    Try again
                  </Button>
                </div>
              ) : assessmentCount === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">No exams on record</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No exam results have been entered for this student yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary from real records */}
                  <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Overall Average</p>
                      <p className="text-2xl font-medium">
                        {overallAverage !== null ? `${overallAverage.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Assessments</p>
                      <p className="text-2xl font-medium">{assessmentCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subjects</p>
                      <p className="text-2xl font-medium">{subjects.length}</p>
                    </div>
                  </div>

                  {/* Subject grades */}
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Subject Grades</h3>
                    <div className="space-y-2">
                      {subjects.map((subject) => (
                        <div
                          key={subject.name}
                          className="flex items-center justify-between gap-4 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{subject.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {subject.count} {subject.count === 1 ? 'assessment' : 'assessments'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {subject.averagePercentage !== null
                                ? `${subject.averagePercentage.toFixed(1)}%`
                                : '—'}
                            </span>
                            {subject.averagePercentage !== null && (
                              <span
                                className={`text-sm font-semibold ${getLetterColor(
                                  percentageToLetter(subject.averagePercentage),
                                )}`}
                              >
                                {percentageToLetter(subject.averagePercentage)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Academic performance history (all real exam records) */}
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Academic Performance History</h3>
                    <div className="space-y-2">
                      {assessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {assessment.subject}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {assessment.examType}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assessment.term || 'No term'}
                              {assessment.weight !== null ? ` · Weight ${assessment.weight}%` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {assessment.score !== null ? assessment.score : '—'} /{' '}
                              {assessment.maxScore !== null ? assessment.maxScore : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assessment.percentage !== null
                                ? `${assessment.percentage.toFixed(1)}%`
                                : 'No score'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Navigate to Report Cards for detailed grade analysis
              </p>
              <Button variant="outline" onClick={() => navigate(`/students/${id}/report-cards`)}>
                Open Report Cards
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
