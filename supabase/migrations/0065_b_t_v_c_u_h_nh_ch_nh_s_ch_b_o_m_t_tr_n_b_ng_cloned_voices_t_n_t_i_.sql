-- Enable Row Level Security on the existing table
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists to ensure a clean state
DROP POLICY IF EXISTS "Users can manage their own cloned voices" ON public.cloned_voices;

-- Create policies for users to manage their own voices
CREATE POLICY "Users can manage their own cloned voices"
ON public.cloned_voices
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);