-- Create the table to store automation campaigns
CREATE TABLE public.automation_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused', -- 'active', 'paused', 'error'
  koc_id UUID NOT NULL REFERENCES public.kocs(id) ON DELETE CASCADE,
  cloned_voice_id TEXT NOT NULL,
  cloned_voice_name TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ai_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_run_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'error'))
);

-- Add comments to explain the table and columns
COMMENT ON TABLE public.automation_campaigns IS 'Stores automation campaigns configured by users.';
COMMENT ON COLUMN public.automation_campaigns.status IS 'The current status of the campaign: active, paused, or error.';
COMMENT ON COLUMN public.automation_campaigns.koc_id IS 'The KOC this campaign will generate videos for.';
COMMENT ON COLUMN public.automation_campaigns.cloned_voice_id IS 'The specific cloned voice ID to use for TTS.';
COMMENT ON COLUMN public.automation_campaigns.project_id IS 'The project (scenario) to execute on the extension.';
COMMENT ON COLUMN public.automation_campaigns.ai_prompt IS 'The custom AI prompt for generating video scripts.';
COMMENT ON COLUMN public.automation_campaigns.last_run_at IS 'Timestamp of the last time this campaign was successfully executed.';

-- Enable Row Level Security
ALTER TABLE public.automation_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own automation campaigns"
ON public.automation_campaigns
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);