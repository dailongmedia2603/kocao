-- Add columns to store TikTok stats
ALTER TABLE public.kocs
ADD COLUMN follower_count BIGINT DEFAULT 0,
ADD COLUMN like_count BIGINT DEFAULT 0,
ADD COLUMN stats_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN public.kocs.follower_count IS 'Total number of followers, updated via daily scan.';
COMMENT ON COLUMN public.kocs.like_count IS 'Total number of likes, updated via daily scan.';
COMMENT ON COLUMN public.kocs.stats_updated_at IS 'Timestamp of the last successful stats update.';