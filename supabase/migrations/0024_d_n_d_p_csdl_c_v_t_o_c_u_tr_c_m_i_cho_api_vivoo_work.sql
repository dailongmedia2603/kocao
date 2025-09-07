-- Xóa các bảng liên quan đến Minimax không còn sử dụng
DROP TABLE IF EXISTS public.user_minimax_credentials;
DROP TABLE IF EXISTS public.voice_generation_history;

-- Tạo bảng mới để lưu trữ API key của Vivoo.work
CREATE TABLE public.user_voice_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.user_voice_api_keys IS 'Stores user-provided GenAIPro Voice (Vivoo.work) API keys.';

-- Bật RLS để bảo mật
ALTER TABLE public.user_voice_api_keys ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật (RLS policies)
CREATE POLICY "Users can manage their own Voice API keys" ON public.user_voice_api_keys
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);