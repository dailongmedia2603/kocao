-- Đầu tiên, xóa hàm cũ đi vì cấu trúc trả về của nó sẽ thay đổi.
DROP FUNCTION IF EXISTS public.get_available_prompt_templates();

-- 1. Tạo lại hàm lấy danh sách các template có sẵn cho người dùng.
-- Logic mới: Lấy các template của người dùng HOẶC các template công khai.
CREATE FUNCTION public.get_available_prompt_templates()
RETURNS TABLE(id uuid, user_id uuid, word_count integer, writing_style text, tone_of_voice text, ai_role text, mandatory_requirements text, created_at timestamp with time zone, updated_at timestamp with time zone, model text, name text, is_default boolean, business_field text, goal text, writing_method text, presentation_structure text, example_dialogue text, general_prompt text, is_public boolean)
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
    -- Lấy tất cả template công khai
    t.is_public = true;
END;
$function$
;

-- 2. Cập nhật hàm đặt template mặc định cho một KOC.
-- Logic mới: Cho phép đặt nếu template là của người dùng HOẶC là template công khai.
CREATE OR REPLACE FUNCTION public.set_default_prompt_for_koc(p_koc_id uuid, p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Đảm bảo người dùng gọi hàm này sở hữu KOC
  IF NOT EXISTS (
    SELECT 1 FROM public.kocs WHERE id = p_koc_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own this KOC.';
  END IF;

  -- Đảm bảo người dùng có quyền truy cập vào template (là của họ hoặc là công khai)
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_templates t
    WHERE t.id = p_template_id
      AND (t.user_id = auth.uid() OR t.is_public = true)
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not have access to this template.';
  END IF;

  -- Cập nhật KOC với ID template mặc định mới
  UPDATE public.kocs
  SET default_prompt_template_id = p_template_id
  WHERE id = p_koc_id;
END;
$function$
;

-- 3. Cập nhật hàm tìm kiếm template mặc định cho KOC (dùng cho automation).
-- Logic mới: Tìm kiếm theo thứ tự ưu tiên rõ ràng và an toàn.
CREATE OR REPLACE FUNCTION public.get_default_template_for_koc(p_koc_id uuid)
 RETURNS TABLE(id uuid, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_template_id uuid;
    v_user_id uuid := auth.uid();
BEGIN
    -- Step 1: Get the KOC's specific default template ID
    SELECT default_prompt_template_id INTO v_template_id
    FROM public.kocs
    WHERE id = p_koc_id AND user_id = v_user_id;

    -- Step 2: If KOC has a specific default, verify access and return it
    IF v_template_id IS NOT NULL THEN
        RETURN QUERY
        SELECT t.id, t.name
        FROM public.ai_prompt_templates t
        WHERE t.id = v_template_id
          AND (t.user_id = v_user_id OR t.is_public = true)
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Step 3: If not found, find the user's own default template
    RETURN QUERY
    SELECT t.id, t.name
    FROM public.ai_prompt_templates t
    WHERE t.user_id = v_user_id AND t.is_default = true
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- Step 4: If still not found, find a system-wide public default template
    RETURN QUERY
    SELECT t.id, t.name
    FROM public.ai_prompt_templates t
    WHERE t.is_public = true AND t.is_default = true
    ORDER BY t.created_at DESC -- In case there are multiple, pick the newest
    LIMIT 1;

END;
$function$
;