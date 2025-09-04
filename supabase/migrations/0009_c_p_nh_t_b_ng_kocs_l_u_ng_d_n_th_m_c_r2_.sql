-- Add folder_path column to kocs table
ALTER TABLE public.kocs ADD COLUMN folder_path TEXT;

-- Create an index for faster lookups
CREATE UNIQUE INDEX idx_kocs_folder_path ON public.kocs(folder_path);