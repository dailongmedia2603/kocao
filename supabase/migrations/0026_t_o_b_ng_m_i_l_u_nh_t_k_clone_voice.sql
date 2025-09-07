-- Create voice_clone_logs table
CREATE TABLE public.voice_clone_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_url TEXT,
  request_payload JSONB,
  response_body JSONB,
  status_code INT,
  status_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE public.voice_clone_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for data access
CREATE POLICY "Users can view their own logs" ON public.voice_clone_logs
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow service role (used by edge functions) to insert logs
CREATE POLICY "Service role can insert logs" ON public.voice_clone_logs
FOR INSERT TO service_role WITH CHECK (true);