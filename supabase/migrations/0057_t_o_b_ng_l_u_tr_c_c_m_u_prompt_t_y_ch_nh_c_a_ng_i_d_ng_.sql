-- Create the table to store custom prompt templates
CREATE TABLE public.prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, template_type)
);

-- Enable Row Level Security
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Policies for prompt_templates
CREATE POLICY "Users can manage their own prompt templates"
ON public.prompt_templates
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger to update 'updated_at' column
CREATE TRIGGER handle_prompt_templates_updated_at
BEFORE UPDATE ON public.prompt_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();