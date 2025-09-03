-- Function to handle queuing the next task
CREATE OR REPLACE FUNCTION public.queue_next_task_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    next_task_id uuid;
BEGIN
    -- We only care when a task is marked as 'completed'
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
        -- Find the next task in the sequence for the same project
        SELECT id INTO next_task_id
        FROM public.tasks
        WHERE project_id = NEW.project_id
          AND execution_order = NEW.execution_order + 1
        ORDER BY execution_order ASC
        LIMIT 1;

        -- If there is a next task, update its status to 'queued'
        -- and carry over the extension ID from the task that just completed.
        IF next_task_id IS NOT NULL THEN
            UPDATE public.tasks
            SET
                status = 'queued',
                assigned_extension_id = NEW.assigned_extension_id
            WHERE id = next_task_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to execute the function after a task is updated
-- We drop it first to ensure we don't have duplicates if this is run again.
DROP TRIGGER IF EXISTS on_task_completed_queue_next ON public.tasks;
CREATE TRIGGER on_task_completed_queue_next
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_next_task_on_completion();