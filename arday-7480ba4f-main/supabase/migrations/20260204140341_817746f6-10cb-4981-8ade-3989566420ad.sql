-- Drop existing policies
DROP POLICY IF EXISTS "School admins can upload school assets" ON storage.objects;
DROP POLICY IF EXISTS "School admins can update school assets" ON storage.objects;
DROP POLICY IF EXISTS "School admins can delete school assets" ON storage.objects;
DROP POLICY IF EXISTS "School assets are publicly viewable" ON storage.objects;

-- Recreate with proper role specifications
CREATE POLICY "School assets are publicly viewable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'school-assets');

CREATE POLICY "School admins can upload school assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins can update school assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins can delete school assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'school-assets' 
  AND is_school_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);