CREATE OR REPLACE FUNCTION public.get_default_template_for_koc(p_koc_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_template_id uuid;
    v_user_id uuid := auth.uid();
BEGIN
    -- Step 1: Get the KOC's specific default template ID
    SELECT default_prompt_template_id INTO v_template_id
    FROM public.kocs
    WHERE id = p_koc_id AND user_id = v_user_id;

    -- Step 2: If KOC has a specific default, try to return it
    IF v_template_id IS NOT NULL THEN
        RETURN QUERY
        SELECT t.id, t.name
        FROM public.ai_prompt_templates t
        WHERE t.id = v_template_id
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Step 3: If not found, try to find the user's own default template
    RETURN QUERY
    SELECT t.id, t.name
    FROM public.ai_prompt_templates t
    WHERE t.user_id = v_user_id AND t.is_default = true
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- Step 4: If still not found, find a system-wide (admin) default template
    RETURN QUERY
    SELECT t.id, t.name
    FROM public.ai_prompt_templates t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE p.role = 'admin' AND t.is_default = true
    ORDER BY t.created_at DESC -- In case there are multiple, pick the newest
    LIMIT 1;

END;
$$;