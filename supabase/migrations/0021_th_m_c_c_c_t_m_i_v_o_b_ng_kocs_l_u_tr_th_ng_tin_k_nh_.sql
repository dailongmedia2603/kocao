-- Add new columns to the kocs table to store channel details from the API
ALTER TABLE public.kocs
ADD COLUMN channel_nickname TEXT,
ADD COLUMN channel_unique_id TEXT,
ADD COLUMN channel_created_at TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN public.kocs.channel_nickname IS 'The display name (nickname) of the TikTok channel.';
COMMENT ON COLUMN public.kocs.channel_unique_id IS 'The unique ID (@username) of the TikTok channel.';
COMMENT ON COLUMN public.kocs.channel_created_at IS 'The creation timestamp of the TikTok account.';