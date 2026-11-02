import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface LearningMaterial {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  course?: {
    id: string;
    name: string;
    code: string;
  };
}

export function useLearningMaterials() {
  return useQuery({
    queryKey: ['learning-materials'],
    queryFn: async () => {
      const { data } = await api.get<LearningMaterial[]>('/materials');
      return data || [];
    },
  });
}

export function useLearningMaterialsByCourse(courseId: string | null) {
  return useQuery({
    queryKey: ['learning-materials', 'course', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const params = new URLSearchParams({ course_id: courseId });
      const { data } = await api.get<LearningMaterial[]>(`/materials?${params.toString()}`);
      return data || [];
    },
    enabled: !!courseId,
  });
}

interface UploadMaterialInput {
  courseId: string;
  title: string;
  description?: string;
  file: File;
}

export function useUploadMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, title, description, file }: UploadMaterialInput) => {
      const formData = new FormData();
      formData.append('course_id', courseId);
      formData.append('title', title);
      if (description) formData.append('description', description);
      formData.append('file', file);

      const { data } = await api.upload<LearningMaterial>('/materials', formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-materials'] });
      toast({
        title: 'Material uploaded',
        description: 'Learning material has been uploaded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description?: string }) => {
      const { data } = await api.put<LearningMaterial>(`/materials/${id}`, { title, description });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-materials'] });
      toast({
        title: 'Material updated',
        description: 'Learning material has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (material: LearningMaterial) => {
      await api.delete(`/materials/${material.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-materials'] });
      toast({
        title: 'Material deleted',
        description: 'Learning material has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
