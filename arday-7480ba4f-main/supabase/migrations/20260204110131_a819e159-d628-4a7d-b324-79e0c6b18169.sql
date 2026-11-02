-- Create storage bucket for school assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school-assets', 'school-assets', true);

-- Create policies for school assets bucket
CREATE POLICY "School assets are publicly viewable" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'school-assets');

CREATE POLICY "School admins can upload school assets" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins can update school assets" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins can delete school assets" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);