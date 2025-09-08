-- Add model and max_words columns to the automation_campaigns table
ALTER TABLE public.automation_campaigns
ADD COLUMN model TEXT,
ADD COLUMN max_words INTEGER;

-- Add comments for the new columns
COMMENT ON COLUMN public.automation_campaigns.model IS 'The AI model to use for script generation (e.g., gemini-1.5-pro-latest).';
COMMENT ON COLUMN public.automation_campaigns.max_words IS 'The maximum number of words for the generated script.';

-- Recreate the RLS policy to include the new columns
DROP POLICY IF EXISTS "Users can manage their own automation campaigns" ON public.automation_campaigns;

CREATE POLICY "Users can manage their own automation campaigns"
ON public.automation_campaigns
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);