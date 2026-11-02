import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Download,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LearningMaterial } from '@/hooks/useLearningMaterials';

interface MaterialCardProps {
  material: LearningMaterial;
  onEdit: (material: LearningMaterial) => void;
  onDelete: (material: LearningMaterial) => void;
  canManage?: boolean;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.startsWith('video/')) return FileVideo;
  if (fileType.startsWith('audio/')) return FileAudio;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('word')) return FileText;
  return File;
};

const getFileTypeLabel = (fileType: string | null) => {
  if (!fileType) return 'File';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('word') || fileType.includes('document')) return 'Word';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PowerPoint';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.startsWith('audio/')) return 'Audio';
  return 'File';
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MaterialCard({ material, onEdit, onDelete, canManage = true }: MaterialCardProps) {
  const FileIcon = getFileIcon(material.file_type);

  const handleDownload = () => {
    window.open(material.file_url, '_blank');
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <FileIcon className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{material.title}</h3>
                {material.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {material.description}
                  </p>
                )}
              </div>
              
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(material)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(material)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getFileTypeLabel(material.file_type)}
              </Badge>
              {material.course && (
                <Badge variant="outline" className="text-xs">
                  {material.course.code}
                </Badge>
              )}
              {material.file_size && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(material.file_size)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {format(new Date(material.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
