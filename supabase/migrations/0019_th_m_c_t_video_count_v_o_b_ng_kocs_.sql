-- Add the missing video_count column to the kocs table
ALTER TABLE public.kocs
ADD COLUMN video_count BIGINT DEFAULT 0;

-- Add a comment for clarity
COMMENT ON COLUMN public.kocs.video_count IS 'Total number of videos, updated via daily scan from TikTok API.';