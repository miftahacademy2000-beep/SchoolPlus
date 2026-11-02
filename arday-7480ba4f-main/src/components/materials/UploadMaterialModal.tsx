import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUploadMaterial } from '@/hooks/useLearningMaterials';
import { useCourses } from '@/hooks/useCourses';
import { Loader2, Upload, FileText, X } from 'lucide-react';

const uploadSchema = z.object({
  courseId: z.string().min(1, 'Please select a course'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface UploadMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCourseId?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
];

export function UploadMaterialModal({ open, onOpenChange, preselectedCourseId }: UploadMaterialModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadMaterial = useUploadMaterial();
  const { data: courses, isLoading: coursesLoading } = useCourses();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      courseId: preselectedCourseId || '',
      title: '',
      description: '',
    },
  });
  
  // Update form when preselectedCourseId changes
  const courseIdValue = form.watch('courseId');
  if (preselectedCourseId && !courseIdValue) {
    form.setValue('courseId', preselectedCourseId);
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File size must be less than 50MB');
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('File type not supported');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Auto-fill title from filename if empty
    if (!form.getValues('title')) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      form.setValue('title', nameWithoutExt);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      setFileError('Please select a file to upload');
      return;
    }

    await uploadMaterial.mutateAsync({
      courseId: data.courseId,
      title: data.title,
      description: data.description,
      file: selectedFile,
    });

    form.reset();
    setSelectedFile(null);
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Learning Material
          </DialogTitle>
          <DialogDescription>
            Upload course materials for your students. Supports PDF, Word, PowerPoint, Excel, images, videos, and audio files up to 50MB.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {coursesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : courses?.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No courses available
                        </div>
                      ) : (
                        courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload Area */}
            <div className="space-y-2">
              <FormLabel>File</FormLabel>
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max file size: 50MB
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept={ALLOWED_TYPES.join(',')}
              />
              {fileError && (
                <p className="text-sm text-destructive">{fileError}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Material title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add a description for this material..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={uploadMaterial.isPending || !selectedFile}
              >
                {uploadMaterial.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upload Material
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
