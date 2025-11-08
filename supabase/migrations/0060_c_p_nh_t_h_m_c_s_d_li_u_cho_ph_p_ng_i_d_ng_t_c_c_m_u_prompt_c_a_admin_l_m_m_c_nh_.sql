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

  -- Đảm bảo người dùng có quyền truy cập vào template họ đang cố gắng đặt (là của chính họ hoặc của admin)
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_templates t
    LEFT JOIN public.profiles p ON t.user_id = p.id
    WHERE t.id = p_template_id
      AND (t.user_id = auth.uid() OR p.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not have access to this template.';
  END IF;

  -- Cập nhật KOC với ID template mặc định mới
  UPDATE public.kocs
  SET default_prompt_template_id = p_template_id
  WHERE id = p_koc_id;
END;
$function$