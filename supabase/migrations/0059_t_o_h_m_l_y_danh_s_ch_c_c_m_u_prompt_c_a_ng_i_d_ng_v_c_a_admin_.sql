CREATE OR REPLACE FUNCTION public.get_available_prompt_templates()
 RETURNS TABLE(id uuid, user_id uuid, word_count integer, writing_style text, tone_of_voice text, ai_role text, mandatory_requirements text, created_at timestamp with time zone, updated_at timestamp with time zone, model text, name text, is_default boolean, business_field text, goal text, writing_method text, presentation_structure text, example_dialogue text, general_prompt text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.ai_prompt_templates t
  WHERE 
    -- Lấy tất cả template của người dùng hiện tại
    t.user_id = auth.uid() 
    OR 
    -- Lấy tất cả template của các admin
    t.user_id IN (SELECT p.id FROM public.profiles p WHERE p.role = 'admin');
END;
$function$