CREATE OR REPLACE FUNCTION public.handle_failed_video_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Check if the status is changing to 'failed'
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    -- Decrement the used video count for the user
    UPDATE public.user_subscriptions
    SET current_period_videos_used = GREATEST(0, current_period_videos_used - 1)
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, to avoid conflicts
DROP TRIGGER IF EXISTS on_dreamface_task_failed ON public.dreamface_tasks;

-- Create the new trigger
CREATE TRIGGER on_dreamface_task_failed
  AFTER UPDATE ON public.dreamface_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_failed_video_task();