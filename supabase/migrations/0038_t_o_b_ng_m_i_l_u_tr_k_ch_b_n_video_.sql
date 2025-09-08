-- Create video_scripts table
CREATE TABLE public.video_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  koc_id UUID REFERENCES public.kocs(id) ON DELETE SET NULL,
  news_post_id UUID REFERENCES public.news_posts(id) ON DELETE SET NULL,
  script_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.video_scripts IS 'Stores AI-generated video scripts.';
COMMENT ON COLUMN public.video_scripts.name IS 'The user-defined name for the script.';
COMMENT ON COLUMN public.video_scripts.koc_id IS 'The KOC this script is for.';
COMMENT ON COLUMN public.video_scripts.news_post_id IS 'The news post used as a source for the script.';
COMMENT ON COLUMN public.video_scripts.script_content IS 'The generated script content from AI.';

-- Enable RLS
ALTER TABLE public.video_scripts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own video scripts"
ON public.video_scripts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video scripts"
ON public.video_scripts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video scripts"
ON public.video_scripts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video scripts"
ON public.video_scripts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);