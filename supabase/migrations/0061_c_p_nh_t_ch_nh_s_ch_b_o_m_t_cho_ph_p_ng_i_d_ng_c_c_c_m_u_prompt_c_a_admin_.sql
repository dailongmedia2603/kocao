-- Tạo một chính sách mới cho phép người dùng đã xác thực đọc các mẫu prompt do admin tạo.
CREATE POLICY "Allow authenticated users to read admin templates"
ON public.ai_prompt_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = ai_prompt_templates.user_id AND public.profiles.role = 'admin'
  )
);