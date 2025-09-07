-- Xóa bảng API key cũ không còn sử dụng
DROP TABLE IF EXISTS public.user_voice_api_keys;

-- Tạo bảng mới để lưu trữ thông tin xác thực của Minimax
CREATE TABLE public.user_minimax_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.user_minimax_credentials IS 'Stores user-provided Minimax API credentials.';

-- Bật RLS để bảo mật
ALTER TABLE public.user_minimax_credentials ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật (RLS policies)
CREATE POLICY "Users can manage their own Minimax credentials" ON public.user_minimax_credentials
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tạo bảng để lưu lịch sử các file voice đã tạo
CREATE TABLE public.voice_generation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    model TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.voice_generation_history IS 'Stores the history of generated voice files.';

-- Bật RLS để bảo mật
ALTER TABLE public.voice_generation_history ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật (RLS policies)
CREATE POLICY "Users can manage their own voice generation history" ON public.voice_generation_history
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tạo một bucket lưu trữ mới cho các file voice
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_generations', 'voice_generations', true)
ON CONFLICT (id) DO NOTHING;

-- Tạo chính sách bảo mật cho bucket
CREATE POLICY "Allow authenticated users to manage their own voice files"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'voice_generations' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'voice_generations' AND (storage.foldername(name))[1] = auth.uid()::text);