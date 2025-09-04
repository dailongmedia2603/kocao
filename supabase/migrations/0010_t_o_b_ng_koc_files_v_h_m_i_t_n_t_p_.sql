-- Create koc_files table to store file metadata
CREATE TABLE public.koc_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  koc_id UUID NOT NULL REFERENCES public.kocs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for the new table
ALTER TABLE public.koc_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only manage their own files
CREATE POLICY "Users can manage their own files"
ON public.koc_files
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create an RPC function for securely renaming files
CREATE OR REPLACE FUNCTION public.update_koc_file_name(file_id uuid, new_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.koc_files
  SET display_name = new_name
  WHERE id = file_id AND user_id = auth.uid();
END;
$$;