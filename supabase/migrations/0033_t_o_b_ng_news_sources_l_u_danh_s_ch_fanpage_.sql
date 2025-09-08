-- Create the table to store news sources (Fanpages/Groups)
CREATE TABLE public.news_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_source UNIQUE (user_id, source_id)
);

-- Add comments to explain the table and columns
COMMENT ON TABLE public.news_sources IS 'Stores the list of Fanpages or Groups a user wants to scan for news.';
COMMENT ON COLUMN public.news_sources.source_id IS 'The ID of the Facebook Fanpage or Group.';
COMMENT ON COLUMN public.news_sources.name IS 'The display name of the Fanpage or Group.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for user-specific access
CREATE POLICY "Users can view their own news sources"
ON public.news_sources FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own news sources"
ON public.news_sources FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own news sources"
ON public.news_sources FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own news sources"
ON public.news_sources FOR DELETE
TO authenticated
USING (auth.uid() = user_id);