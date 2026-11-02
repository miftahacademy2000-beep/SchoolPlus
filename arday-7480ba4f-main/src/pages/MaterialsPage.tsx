import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, FolderOpen, Upload } from 'lucide-react';
import { 
  useLearningMaterials, 
  useDeleteMaterial,
  type LearningMaterial 
} from '@/hooks/useLearningMaterials';
import { useCourses } from '@/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { UploadMaterialModal, MaterialCard, EditMaterialModal } from '@/components/materials';

export default function MaterialsPage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('__all__');

  const { data: materials, isLoading } = useLearningMaterials();
  const { data: courses } = useCourses();
  const deleteMaterial = useDeleteMaterial();
  const { primaryRole } = useAuth();

  const canManage = primaryRole === 'teacher' || primaryRole === 'school_admin' || primaryRole === 'super_admin';

  // Filter materials
  const filteredMaterials = materials?.filter((material) => {
    const matchesSearch = material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.course?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse = courseFilter === '__all__' || material.course_id === courseFilter;

    return matchesSearch && matchesCourse;
  });

  const handleEdit = (material: LearningMaterial) => {
    setSelectedMaterial(material);
    setIsEditOpen(true);
  };

  const handleDelete = (material: LearningMaterial) => {
    setSelectedMaterial(material);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedMaterial) {
      await deleteMaterial.mutateAsync(selectedMaterial);
      setIsDeleteOpen(false);
      setSelectedMaterial(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Learning Materials"
        description="Upload and manage course materials for your students"
        actions={
          canManage ? (
            <Button onClick={() => setIsUploadOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload Material
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Courses</SelectItem>
            {courses?.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.code} - {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Materials List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredMaterials?.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No materials found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || courseFilter !== '__all__'
              ? 'Try adjusting your search or filters'
              : 'Upload your first learning material to get started'}
          </p>
          {canManage && !searchQuery && courseFilter === '__all__' && (
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Material
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMaterials?.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <UploadMaterialModal
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />

      <EditMaterialModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        material={selectedMaterial}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMaterial?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
