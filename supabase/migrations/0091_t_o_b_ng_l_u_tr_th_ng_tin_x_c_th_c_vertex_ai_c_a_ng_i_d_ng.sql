-- Create user_vertex_ai_credentials table
CREATE TABLE public.user_vertex_ai_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_id TEXT NOT NULL,
  credentials JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.user_vertex_ai_credentials IS 'Stores user-provided Google Vertex AI credentials.';
COMMENT ON COLUMN public.user_vertex_ai_credentials.credentials IS 'The JSON content of the Google Cloud service account key.';

-- Enable RLS for security
ALTER TABLE public.user_vertex_ai_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies to ensure users can only access their own credentials
CREATE POLICY "Users can manage their own Vertex AI credentials"
ON public.user_vertex_ai_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);