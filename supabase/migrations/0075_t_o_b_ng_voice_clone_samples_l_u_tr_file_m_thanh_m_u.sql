-- Create a table to store voice clone sample files
CREATE TABLE public.voice_clone_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.voice_clone_samples ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can manage their own voice samples"
ON public.voice_clone_samples
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);