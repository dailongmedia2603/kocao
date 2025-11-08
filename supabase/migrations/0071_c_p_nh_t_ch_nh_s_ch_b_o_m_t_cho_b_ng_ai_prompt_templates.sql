-- Bước 1: Xóa chính sách cũ, quá chung chung.
DROP POLICY IF EXISTS "Users can manage their own AI prompt templates" ON public.ai_prompt_templates;

-- Bước 2: Tạo chính sách SELECT mới.
-- Cho phép người dùng xem template của chính họ HOẶC bất kỳ template công khai nào.
CREATE POLICY "Public and owned templates are viewable"
ON public.ai_prompt_templates
FOR SELECT
TO authenticated
USING (is_public = true OR auth.uid() = user_id);

-- Bước 3: Tạo chính sách INSERT mới.
-- Cho phép người dùng tạo template cho chính họ.
-- Ngăn chặn người dùng không phải admin tạo template công khai.
CREATE POLICY "Users can insert their own templates"
ON public.ai_prompt_templates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  (is_public = false OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
);

-- Bước 4: Tạo chính sách UPDATE mới.
-- Cho phép người dùng chỉ cập nhật template của chính họ.
-- Ngăn chặn người dùng không phải admin đặt một template thành công khai.
CREATE POLICY "Users can update their own templates"
ON public.ai_prompt_templates
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  is_public = false OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Bước 5: Tạo chính sách DELETE mới.
-- Cho phép người dùng chỉ xóa template của chính họ.
CREATE POLICY "Users can delete their own templates"
ON public.ai_prompt_templates
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);