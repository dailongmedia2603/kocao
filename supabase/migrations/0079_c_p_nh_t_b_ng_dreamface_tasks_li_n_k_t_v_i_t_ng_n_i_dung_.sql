-- Add a column to link dreamface_tasks to koc_content_ideas
ALTER TABLE public.dreamface_tasks
ADD COLUMN koc_content_idea_id UUID REFERENCES public.koc_content_ideas(id) ON DELETE SET NULL;