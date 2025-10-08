-- Create the table to store user-provided Dreamface API keys
CREATE TABLE public.user_dreamface_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  user_id_dreamface TEXT NOT NULL,
  token_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to the table and columns
COMMENT ON TABLE public.user_dreamface_api_keys IS 'Stores user-provided Dreamface API keys for video generation.';
COMMENT ON COLUMN public.user_dreamface_api_keys.user_id_dreamface IS 'The user ID specific to the Dreamface API.';

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.user_dreamface_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies to ensure users can only manage their own API keys
CREATE POLICY "Users can view their own Dreamface API keys"
ON public.user_dreamface_api_keys FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Dreamface API keys"
ON public.user_dreamface_api_keys FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Dreamface API keys"
ON public.user_dreamface_api_keys FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Dreamface API keys"
ON public.user_dreamface_api_keys FOR DELETE
TO authenticated USING (auth.uid() = user_id);