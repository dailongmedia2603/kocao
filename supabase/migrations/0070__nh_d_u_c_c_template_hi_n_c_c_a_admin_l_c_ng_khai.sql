-- Cập nhật tất cả các template hiện có thuộc sở hữu của người dùng có vai trò 'admin'.
-- Đặt cột 'is_public' của chúng thành TRUE để chúng trở thành template công khai
-- theo logic hệ thống mới.
UPDATE public.ai_prompt_templates
SET is_public = true
WHERE user_id IN (
  SELECT id
  FROM public.profiles
  WHERE role = 'admin'
);