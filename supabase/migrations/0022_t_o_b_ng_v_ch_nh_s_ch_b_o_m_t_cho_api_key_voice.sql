-- Create user_voice_api_keys table
CREATE TABLE public.user_voice_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.user_voice_api_keys IS 'Stores user-provided GenAIPro Voice API keys.';

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.user_voice_api_keys ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own voice API keys" ON public.user_voice_api_keys
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice API keys" ON public.user_voice_api_keys
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice API keys" ON public.user_voice_api_keys
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice API keys" ON public.user_voice_api_keys
FOR DELETE TO authenticated USING (auth.uid() = user_id);