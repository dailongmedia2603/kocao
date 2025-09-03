-- Create the extension_instances table
CREATE TABLE public.extension_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for the new table
ALTER TABLE public.extension_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extension instances"
ON public.extension_instances FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extension instances"
ON public.extension_instances FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extension instances"
ON public.extension_instances FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extension instances"
ON public.extension_instances FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add the new column to the tasks table
ALTER TABLE public.tasks
ADD COLUMN assigned_extension_id UUID REFERENCES public.extension_instances(id) ON DELETE SET NULL;

-- Update the function to propagate the assigned_extension_id
CREATE OR REPLACE FUNCTION public.update_task_and_queue_next(task_id uuid, new_status text, error_message text DEFAULT NULL::text, extracted_data jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    completed_task_project_id uuid;
    completed_task_user_id uuid;
    completed_task_order int;
    completed_task_extension_id uuid; -- Added
    next_task_id uuid;
BEGIN
    -- Step 1: Update the current task and get its details
    UPDATE public.tasks
    SET
        status = new_status,
        error_log = CASE WHEN new_status = 'failed' THEN error_message ELSE NULL END
    WHERE id = task_id
    RETURNING project_id, user_id, execution_order, assigned_extension_id INTO completed_task_project_id, completed_task_user_id, completed_task_order, completed_task_extension_id;

    -- Step 2: If the task is completed successfully, handle next steps
    IF new_status = 'completed' THEN
        -- File saving logic (remains the same)
        IF extracted_data IS NOT NULL AND
           jsonb_typeof(extracted_data) = 'object' AND
           extracted_data ? 'fileName' AND
           extracted_data ? 'fileUrl' AND
           extracted_data ? 'storagePath'
        THEN
            INSERT INTO public.user_files (user_id, project_id, file_name, file_url, storage_path, source)
            VALUES (
                completed_task_user_id,
                completed_task_project_id,
                extracted_data ->> 'fileName',
                extracted_data ->> 'fileUrl',
                extracted_data ->> 'storagePath',
                'extract'
            );
        END IF;

        -- Find and activate the next task in the scenario
        IF completed_task_order IS NOT NULL THEN
            SELECT id INTO next_task_id
            FROM public.tasks
            WHERE project_id = completed_task_project_id
              AND execution_order = completed_task_order + 1
            LIMIT 1;

            IF next_task_id IS NOT NULL THEN
                -- Update the next task, carrying over the extension ID
                UPDATE public.tasks
                SET
                    status = 'queued',
                    assigned_extension_id = completed_task_extension_id -- This is the key change
                WHERE id = next_task_id;
            END IF;
        END IF;
    END IF;
END;
$function$