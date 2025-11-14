-- Delete obsolete Gemini templates as they are being replaced by GPT templates.
DELETE FROM public.prompt_templates
WHERE template_type = 'content_plan_gemini';

DELETE FROM public.prompt_templates
WHERE template_type = 'generate_more_ideas_gemini';