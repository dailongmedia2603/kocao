-- Thêm một cột mới 'model' vào bảng ai_prompt_templates để lưu trữ model AI được chọn
ALTER TABLE public.ai_prompt_templates
ADD COLUMN model TEXT;

-- Thêm một bình luận vào cột mới để dễ hiểu hơn sau này
COMMENT ON COLUMN public.ai_prompt_templates.model IS 'Model AI mặc định được sử dụng để tạo kịch bản.';