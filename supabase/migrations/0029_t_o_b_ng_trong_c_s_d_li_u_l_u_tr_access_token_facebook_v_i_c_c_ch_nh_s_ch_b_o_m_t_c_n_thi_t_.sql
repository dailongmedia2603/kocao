-- Create user_facebook_tokens table
CREATE TABLE public.user_facebook_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.user_facebook_tokens IS 'Stores user-provided Facebook API access tokens.';

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.user_facebook_tokens ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own Facebook tokens" ON public.user_facebook_tokens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Facebook tokens" ON public.user_facebook_tokens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Facebook tokens" ON public.user_facebook_tokens
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Facebook tokens" ON public.user_facebook_tokens
FOR DELETE TO authenticated USING (auth.uid() = user_id);