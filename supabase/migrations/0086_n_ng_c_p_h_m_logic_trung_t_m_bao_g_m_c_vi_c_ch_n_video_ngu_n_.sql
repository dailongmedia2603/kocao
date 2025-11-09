CREATE OR REPLACE FUNCTION public.check_and_deduct_credit(
  p_user_id UUID,
  p_koc_id UUID,
  p_idea_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT, new_task_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_subscription RECORD;
  v_source_video RECORD;
  v_source_video_url TEXT;
  v_new_task_id UUID;
BEGIN
  -- 1. Get user's active subscription and plan limit
  SELECT us.current_period_videos_used, sp.monthly_video_limit
  INTO v_subscription
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  LIMIT 1;

  -- If no active subscription, deny
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Bạn không có gói cước nào đang hoạt động.', NULL::UUID;
    RETURN;
  END IF;

  -- 2. Check if limit is reached
  IF v_subscription.current_period_videos_used >= v_subscription.monthly_video_limit THEN
    RETURN QUERY SELECT false, 'Bạn đã sử dụng hết số lượt tạo video trong tháng cho gói cước này.', NULL::UUID;
    RETURN;
  END IF;

  -- 3. Get the next source video
  SELECT * INTO v_source_video FROM public.get_and_update_next_source_video(p_koc_id);
  IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy video nguồn nào cho KOC này. Vui lòng tải video nguồn lên.';
  END IF;
  v_source_video_url := 'https://' || (SELECT current_setting('app.r2_public_url')) || '/' || v_source_video.r2_key;


  -- 4. All checks passed, proceed to deduct credit and create task
  UPDATE public.user_subscriptions
  SET current_period_videos_used = current_period_videos_used + 1
  WHERE user_id = p_user_id AND status = 'active';

  -- 5. Create a placeholder dreamface_task with all necessary info
  INSERT INTO public.dreamface_tasks (user_id, koc_id, koc_content_idea_id, status, title, original_video_url, original_audio_url)
  SELECT p_user_id, p_koc_id, p_idea_id, 'pending', 'AutoVideo for Idea ' || left(p_idea_id::text, 8), v_source_video_url, i.voice_audio_url
  FROM public.koc_content_ideas i
  WHERE i.id = p_idea_id
  RETURNING id INTO v_new_task_id;

  -- 6. Link the new task back to the idea
  UPDATE public.koc_content_ideas
  SET dreamface_task_id = v_new_task_id, status = 'Đang tạo video'
  WHERE id = p_idea_id;

  RETURN QUERY SELECT true, 'Credit đã được trừ. Bắt đầu tạo video.', v_new_task_id;
END;
$$;