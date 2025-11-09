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
  v_new_task_id UUID;
BEGIN
  -- Get user's active subscription and plan limit
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

  -- Check if limit is reached
  IF v_subscription.current_period_videos_used >= v_subscription.monthly_video_limit THEN
    RETURN QUERY SELECT false, 'Bạn đã sử dụng hết số lượt tạo video trong tháng cho gói cước này.', NULL::UUID;
    RETURN;
  END IF;

  -- All checks passed, proceed to deduct credit and create task
  -- 1. Increment the used video count
  UPDATE public.user_subscriptions
  SET current_period_videos_used = current_period_videos_used + 1
  WHERE user_id = p_user_id AND status = 'active';

  -- 2. Create a placeholder dreamface_task
  INSERT INTO public.dreamface_tasks (user_id, koc_id, koc_content_idea_id, status, title)
  VALUES (p_user_id, p_koc_id, p_idea_id, 'pending', 'New Video Task')
  RETURNING id INTO v_new_task_id;

  -- 3. Link the new task back to the idea
  UPDATE public.koc_content_ideas
  SET dreamface_task_id = v_new_task_id
  WHERE id = p_idea_id;

  RETURN QUERY SELECT true, 'Credit đã được trừ. Bắt đầu tạo video.', v_new_task_id;
END;
$$;