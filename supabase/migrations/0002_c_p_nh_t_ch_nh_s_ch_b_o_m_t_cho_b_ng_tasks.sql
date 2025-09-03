-- Step 1: Remove the overly permissive public read policy.
DROP POLICY IF EXISTS "Public read access for tasks" ON public.tasks;

-- Step 2: Add a more secure policy that allows authenticated users to read only their own tasks.
CREATE POLICY "Users can view their own tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (auth.uid() = user_id);