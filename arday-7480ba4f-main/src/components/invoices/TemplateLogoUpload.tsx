import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface TemplateLogoUploadProps {
  currentLogoUrl: string | null;
  schoolId: string;
  schoolName: string;
  onLogoUpdate: (newLogoUrl: string | null) => void;
}

export function TemplateLogoUpload({
  currentLogoUrl,
  schoolId,
  schoolName,
  onLogoUpdate,
}: TemplateLogoUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !schoolId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${schoolId}/logo.${fileExt}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);

      // Upload to storage via API
      const uploadResponse = await api.upload<{ data: { url?: string; publicUrl?: string } }>('/files/upload/school-assets', formData);

      const logoUrl = uploadResponse?.data?.publicUrl || uploadResponse?.data?.url;
      if (!logoUrl) {
        throw new Error('Upload succeeded but no URL returned');
      }

      // Update school with new logo URL
      await api.put(`/schools/${schoolId}`, { logo_url: logoUrl });

      onLogoUpdate(logoUrl);

      toast({
        title: 'Logo uploaded',
        description: 'Your school logo has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: 'Error uploading logo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!schoolId) return;

    setIsUploading(true);

    try {
      // Delete the file from storage
      await api.delete(`/files/school-assets/${schoolId}/logo.*`);

      // Update school to remove logo URL
      await api.put(`/schools/${schoolId}`, { logo_url: null });

      onLogoUpdate(null);

      toast({
        title: 'Logo removed',
        description: 'Your school logo has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error removing logo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-3 border-b space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">School Logo</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={currentLogoUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {schoolName?.charAt(0) || 'S'}
            </AvatarFallback>
          </Avatar>
          {currentLogoUrl && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
              onClick={handleRemoveLogo}
              disabled={isUploading}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" />
                {currentLogoUrl ? 'Change' : 'Upload'}
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            PNG/JPG, max 2MB
          </p>
        </div>
      </div>
    </div>
  );
}
