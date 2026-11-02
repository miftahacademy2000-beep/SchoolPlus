import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  BookOpen, 
  Users, 
  FileText, 
  Loader2, 
  GraduationCap,
  Mail,
  Hash,
  Download,
  File,
  Image,
  FileVideo,
  FileAudio,
  Upload
} from 'lucide-react';
import { useCourseDetails, useCourseStudents, useCourseMaterials } from '@/hooks/useCourseDetails';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useState } from 'react';
import { UploadMaterialModal } from '@/components/materials';

export default function CourseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { primaryRole, isSuperAdmin } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const { data: course, isLoading: courseLoading } = useCourseDetails(id);
  const { data: students = [], isLoading: studentsLoading } = useCourseStudents(id);
  const { data: materials = [], isLoading: materialsLoading } = useCourseMaterials(id);

  const isTeacher = primaryRole === 'teacher';
  const canUploadMaterials = isTeacher || isSuperAdmin || primaryRole === 'school_admin';

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-8 w-8" />;
    if (fileType.startsWith('image/')) return <Image className="h-8 w-8" />;
    if (fileType.startsWith('video/')) return <FileVideo className="h-8 w-8" />;
    if (fileType.startsWith('audio/')) return <FileAudio className="h-8 w-8" />;
    if (fileType.includes('pdf')) return <FileText className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (courseLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Course not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The course you're looking for doesn't exist or you don't have access.
          </p>
          <Button variant="outline" onClick={() => navigate('/courses')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={course.name}
        description={course.description || 'No description provided'}
        breadcrumbs={[
          { label: isTeacher ? 'My Courses' : 'Courses', href: '/courses' },
          { label: course.name }
        ]}
        actions={
          <Button variant="outline" onClick={() => navigate('/courses')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      {/* Course Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                <Hash className="h-3 w-3 mr-1" />
                {course.code}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              <span>{course.credits || 3} Credits</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{students.length} Students</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{materials.length} Materials</span>
            </div>
            {course.teacher?.profile?.full_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Instructor: <strong>{course.teacher.profile.full_name}</strong></span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students" className="gap-2">
            <Users className="h-4 w-4" />
            Students ({students.length})
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-2">
            <FileText className="h-4 w-4" />
            Materials ({materials.length})
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>
                Students enrolled in classes taking this course
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No students enrolled</h3>
                  <p className="text-muted-foreground mt-1">
                    Students will appear here once they're enrolled in classes with this course.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {students.map((student) => (
                    <div 
                      key={student.id} 
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Avatar className="h-12 w-12 border-2 border-border">
                        <AvatarImage src={student.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(student.profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">
                          {student.profile?.full_name || 'Unnamed Student'}
                        </h4>
                        {student.profile?.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{student.profile.email}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {student.class_name}
                          </Badge>
                          {student.grade && (
                            <Badge variant="secondary" className="text-xs">
                              {student.grade}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Learning Materials</CardTitle>
                <CardDescription>
                  Course materials and resources
                </CardDescription>
              </div>
              {canUploadMaterials && course && (
                <Button onClick={() => setShowUploadModal(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {materialsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : materials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No materials yet</h3>
                  <p className="text-muted-foreground mt-1">
                    {canUploadMaterials 
                      ? 'Upload learning materials for this course.' 
                      : 'No materials have been uploaded for this course yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div 
                      key={material.id} 
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {getFileIcon(material.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{material.title}</h4>
                        {material.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {material.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{material.file_name}</span>
                          <span>•</span>
                          <span>{formatFileSize(material.file_size)}</span>
                          <span>•</span>
                          <span>{format(new Date(material.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(material.file_url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Material Modal */}
      {course && (
        <UploadMaterialModal 
          open={showUploadModal} 
          onOpenChange={setShowUploadModal}
          preselectedCourseId={course.id}
        />
      )}
    </DashboardLayout>
  );
}
