-- Allow the task_id column in tts_logs to be null
-- This ensures that logs are saved even if the API call fails to return a task ID
ALTER TABLE public.tts_logs ALTER COLUMN task_id DROP NOT NULL;