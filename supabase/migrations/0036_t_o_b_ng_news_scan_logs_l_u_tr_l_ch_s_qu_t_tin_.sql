-- Create table for news scanning logs
CREATE TABLE public.news_scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id TEXT,
  source_name TEXT,
  request_url TEXT,
  status_code INT,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.news_scan_logs IS 'Logs each attempt to scan a news source.';

-- Enable RLS
ALTER TABLE public.news_scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own scan logs"
ON public.news_scan_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow service role to insert logs for any user
CREATE POLICY "Service role can insert scan logs"
ON public.news_scan_logs FOR INSERT
TO service_role
WITH CHECK (true);