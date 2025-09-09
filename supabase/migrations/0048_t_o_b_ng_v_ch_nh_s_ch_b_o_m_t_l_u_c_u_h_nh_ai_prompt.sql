-- Tạo bảng mới để lưu trữ các mẫu prompt AI cho mỗi người dùng
CREATE TABLE public.ai_prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  word_count INT,
  writing_style TEXT,
  writing_method TEXT,
  tone_of_voice TEXT,
  ai_role TEXT,
  mandatory_requirements TEXT,
  presentation_structure TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo một function để tự động cập nhật trường 'updated_at' khi có thay đổi
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger vào bảng để tự động hóa việc cập nhật
CREATE TRIGGER update_ai_prompt_templates_updated_at
BEFORE UPDATE ON public.ai_prompt_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Bật Row Level Security để bảo vệ dữ liệu
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Tạo các chính sách bảo mật cần thiết
CREATE POLICY "Users can manage their own AI prompt templates"
ON public.ai_prompt_templates FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);