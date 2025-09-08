-- Create the table to store posts fetched from news sources
CREATE TABLE public.news_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source_name TEXT,
  post_id TEXT NOT NULL,
  content TEXT,
  post_url TEXT,
  created_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'new',
  voice_script TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_post UNIQUE (user_id, post_id)
);

-- Add comments for clarity
COMMENT ON TABLE public.news_posts IS 'Stores posts fetched from configured news sources.';
COMMENT ON COLUMN public.news_posts.source_name IS 'The name of the source Fanpage/Group at the time of scanning.';
COMMENT ON COLUMN public.news_posts.status IS 'The status of the post, e.g., new, processed, archived.';

-- Enable Row Level Security
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for user-specific access
CREATE POLICY "Users can manage their own news posts"
ON public.news_posts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);