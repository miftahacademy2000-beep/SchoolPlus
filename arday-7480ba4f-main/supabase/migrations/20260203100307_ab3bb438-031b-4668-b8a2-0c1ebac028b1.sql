-- Allow anyone to view active schools for signup purposes
CREATE POLICY "Anyone can view active schools"
ON public.schools
FOR SELECT
USING (status = 'active');