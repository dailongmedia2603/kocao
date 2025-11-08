-- Sửa lại hàm get_default_template_for_koc để đảm bảo logic tìm kiếm chính xác
CREATE OR REPLACE FUNCTION public.get_default_template_for_koc(p_koc_id uuid)
 RETURNS TABLE(id uuid, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_template_id uuid;
    v_user_id uuid;
BEGIN
    -- Lấy user_id của KOC, không phụ thuộc vào người gọi hàm
    SELECT user_id INTO v_user_id FROM public.kocs WHERE id = p_koc_id;

    -- Step 1: Get the KOC's specific default template ID
    SELECT default_prompt_template_id INTO v_template_id
    FROM public.kocs
    WHERE id = p_koc_id;

    -- Step 2: If KOC has a specific default, verify it exists and return it
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
    ORDER BY t.created_at DESC
    LIMIT 1;

END;
$function$
;

-- Tạo hàm cho trigger
CREATE OR REPLACE FUNCTION public.handle_new_campaign_prompt()
RETURNS TRIGGER AS $$
DECLARE
  template_record RECORD;
BEGIN
  -- Chỉ chạy nếu ai_prompt_template_id chưa được cung cấp
  IF NEW.ai_prompt_template_id IS NULL THEN
    -- Gọi hàm để tìm template mặc định
    SELECT * INTO template_record FROM public.get_default_template_for_koc(NEW.koc_id);

    -- Nếu tìm thấy, cập nhật bản ghi mới
    IF FOUND THEN
      NEW.ai_prompt_template_id := template_record.id;
      NEW.ai_prompt := template_record.name;
    ELSE
      -- Nếu không tìm thấy, ném lỗi để ngăn việc tạo chiến dịch
      RAISE EXCEPTION 'KOC này chưa được cấu hình template AI mặc định và không tìm thấy template mặc định nào khác. Vui lòng vào chi tiết KOC, tab Idea Content để cấu hình.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có
DROP TRIGGER IF EXISTS on_new_campaign_set_prompt ON public.automation_campaigns;

-- Tạo trigger mới
CREATE TRIGGER on_new_campaign_set_prompt
BEFORE INSERT ON public.automation_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_campaign_prompt();