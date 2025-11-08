-- Bước 1: Xóa hàm cũ đi vì chúng ta sẽ thay đổi cấu trúc (tên cột) mà nó trả về.
DROP FUNCTION IF EXISTS public.get_default_template_for_koc(uuid);

-- Bước 2: Tạo lại hàm với tên cột trả về đã được đổi để tránh xung đột.
CREATE OR REPLACE FUNCTION public.get_default_template_for_koc(p_koc_id uuid)
 RETURNS TABLE(template_id uuid, template_name text) -- Đổi tên cột 'id' thành 'template_id'
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_template_id uuid;
    v_user_id uuid;
BEGIN
    -- Lấy user_id của KOC, không phụ thuộc vào người gọi hàm
    SELECT k.user_id INTO v_user_id FROM public.kocs k WHERE k.id = p_koc_id;

    -- Step 1: Get the KOC's specific default template ID
    SELECT k.default_prompt_template_id INTO v_template_id
    FROM public.kocs k
    WHERE k.id = p_koc_id;

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
$function$;

-- Bước 3: Cập nhật hàm của trigger để sử dụng tên cột mới.
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
      NEW.ai_prompt_template_id := template_record.template_id; -- Sử dụng tên cột mới
      NEW.ai_prompt := template_record.template_name;     -- Sử dụng tên cột mới
    ELSE
      -- Nếu không tìm thấy, ném lỗi để ngăn việc tạo chiến dịch
      RAISE EXCEPTION 'KOC này chưa được cấu hình template AI mặc định và không tìm thấy template mặc định nào khác. Vui lòng vào chi tiết KOC, tab Idea Content để cấu hình.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;