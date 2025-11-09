-- Function to reset video counts
CREATE OR REPLACE FUNCTION public.reset_monthly_video_counts()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.user_subscriptions
  SET current_period_videos_used = 0
  WHERE status = 'active';
$$;

-- Schedule the job to run at midnight on the 1st of every month
-- This uses pg_cron syntax
SELECT cron.schedule(
  'monthly-video-reset',
  '0 0 1 * *', -- At 00:00 on day-of-month 1
  'SELECT public.reset_monthly_video_counts()'
);