-- Thêm cột 'is_public' vào bảng ai_prompt_templates
-- Cột này sẽ được dùng để đánh dấu các template có thể được sử dụng bởi tất cả người dùng.
-- Giá trị mặc định là FALSE để đảm bảo các template hiện có và template mới là riêng tư.
ALTER TABLE public.ai_prompt_templates
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Thêm một ghi chú mô tả cho cột mới để làm rõ mục đích của nó.
COMMENT ON COLUMN public.ai_prompt_templates.is_public IS 'Nếu là TRUE, template này sẽ hiển thị cho tất cả người dùng. Chỉ có thể được thiết lập bởi quản trị viên.';