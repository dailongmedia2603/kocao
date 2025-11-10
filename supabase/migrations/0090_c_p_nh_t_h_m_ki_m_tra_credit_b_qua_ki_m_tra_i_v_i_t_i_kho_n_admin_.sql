CREATE OR REPLACE FUNCTION public.check_and_deduct_credit(p_user_id uuid, p_koc_id uuid, p_idea_id uuid DEFAULT NULL::uuid, p_video_url text DEFAULT NULL::text, p_audio_url text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, new_task_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_role TEXT;
  v_subscription RECORD;
  v_source_video RECORD;
  v_source_video_url TEXT;
  v_audio_url TEXT;
  v_new_task_id UUID;
  v_title TEXT;
  v_r2_public_url TEXT;
BEGIN
  -- Đầu tiên, kiểm tra vai trò của người dùng
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;

  -- Nếu người dùng không phải là admin, thực hiện kiểm tra credit
  IF v_user_role <> 'admin' THEN
    -- 1. Lấy gói cước đang hoạt động và giới hạn video
    SELECT us.current_period_videos_used, sp.monthly_video_limit
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'Bạn không có gói cước nào đang hoạt động.', NULL::UUID;
      RETURN;
    END IF;

    -- 2. Kiểm tra xem đã đạt đến giới hạn chưa
    IF v_subscription.current_period_videos_used >= v_subscription.monthly_video_limit THEN
      RETURN QUERY SELECT false, 'Bạn đã sử dụng hết số lượt tạo video trong tháng cho gói cước này.', NULL::UUID;
      RETURN;
    END IF;
  END IF;

  -- 3. Xác định URL video nguồn và audio (logic chung cho tất cả người dùng)
  IF p_video_url IS NOT NULL THEN
    v_source_video_url := p_video_url;
  ELSE
    SELECT * INTO v_source_video FROM public.get_and_update_next_source_video(p_koc_id);
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Không tìm thấy video nguồn nào cho KOC này. Vui lòng tải video nguồn lên.', NULL::UUID;
        RETURN;
    END IF;
    
    SELECT supabase_vault.get_secret('R2_PUBLIC_URL') INTO v_r2_public_url;
    IF v_r2_public_url IS NULL THEN
        RAISE EXCEPTION 'Secret R2_PUBLIC_URL is not set in Supabase Vault.';
    END IF;
    v_source_video_url := 'https://' || v_r2_public_url || '/' || v_source_video.r2_key;
  END IF;

  IF p_audio_url IS NOT NULL THEN
    v_audio_url := p_audio_url;
    v_title := 'ManualVideo for KOC ' || left(p_koc_id::text, 8);
  ELSIF p_idea_id IS NOT NULL THEN
    SELECT i.voice_audio_url INTO v_audio_url FROM public.koc_content_ideas i WHERE i.id = p_idea_id;
    v_title := 'AutoVideo for Idea ' || left(p_idea_id::text, 8);
  ELSE
    RETURN QUERY SELECT false, 'Thiếu thông tin audio_url hoặc idea_id.', NULL::UUID;
    RETURN;
  END IF;

  -- 4. Nếu không phải admin, trừ credit
  IF v_user_role <> 'admin' THEN
    UPDATE public.user_subscriptions
    SET current_period_videos_used = current_period_videos_used + 1
    WHERE user_id = p_user_id AND status = 'active';
  END IF;

  -- 5. Tạo dreamface_task
  INSERT INTO public.dreamface_tasks (user_id, koc_id, koc_content_idea_id, status, title, original_video_url, original_audio_url)
  VALUES (p_user_id, p_koc_id, p_idea_id, 'pending', v_title, v_source_video_url, v_audio_url)
  RETURNING id INTO v_new_task_id;

  -- 6. Liên kết task lại với idea nếu có
  IF p_idea_id IS NOT NULL THEN
    UPDATE public.koc_content_ideas
    SET dreamface_task_id = v_new_task_id, status = 'Đang tạo video'
    WHERE id = p_idea_id;
  END IF;

  RETURN QUERY SELECT true, 'Yêu cầu tạo video đã được gửi đi.', v_new_task_id;
END;
$function$