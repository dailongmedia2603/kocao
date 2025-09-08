-- Create tts_logs table to store request/response for voice generation tasks
CREATE TABLE public.tts_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  request_payload JSONB,
  response_body JSONB,
  status_code INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user
    FOREIGN KEY(user_id) 
    REFERENCES auth.users(id)
);

-- Add an index on task_id for faster lookups
CREATE INDEX idx_tts_logs_task_id ON public.tts_logs(task_id);

-- Enable RLS for security
ALTER TABLE public.tts_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Users can view their own tts logs" ON public.tts_logs
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow backend services to insert logs
CREATE POLICY "Service role can insert logs" ON public.tts_logs
FOR INSERT WITH CHECK (true);