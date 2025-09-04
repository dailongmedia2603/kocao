-- Drop the existing table to replace it with a new structure
DROP TABLE IF EXISTS public.user_api_keys;

-- Create a new table to store multiple API keys per user
CREATE TABLE public.user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.user_api_keys IS 'Stores user-provided Gemini API keys.';
COMMENT ON COLUMN public.user_api_keys.name IS 'A user-defined name for the API key for easy identification.';

-- Enable Row Level Security
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies to ensure users can only access their own keys
CREATE POLICY "Users can view their own API keys" ON public.user_api_keys
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON public.user_api_keys
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.user_api_keys
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.user_api_keys
FOR DELETE TO authenticated USING (auth.uid() = user_id);