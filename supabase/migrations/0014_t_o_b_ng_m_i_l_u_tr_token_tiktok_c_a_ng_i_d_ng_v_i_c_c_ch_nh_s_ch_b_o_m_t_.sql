-- Create user_tiktok_tokens table
CREATE TABLE public.user_tiktok_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to the table and columns
COMMENT ON TABLE public.user_tiktok_tokens IS 'Stores user-provided TikTok API access tokens.';
COMMENT ON COLUMN public.user_tiktok_tokens.name IS 'A user-friendly name for the token.';
COMMENT ON COLUMN public.user_tiktok_tokens.access_token IS 'The access token for the TikTok API proxy.';

-- Enable RLS
ALTER TABLE public.user_tiktok_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own TikTok tokens"
ON public.user_tiktok_tokens FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TikTok tokens"
ON public.user_tiktok_tokens FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TikTok tokens"
ON public.user_tiktok_tokens FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TikTok tokens"
ON public.user_tiktok_tokens FOR DELETE
TO authenticated USING (auth.uid() = user_id);