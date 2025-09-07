-- Tạo bảng để lưu trữ các task tạo voice
CREATE TABLE public.voice_tasks (
  id TEXT PRIMARY KEY, -- Sử dụng task_id từ API làm khóa chính
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'doing',
  error_message TEXT,
  credit_cost INT,
  audio_url TEXT,
  srt_url TEXT,
  task_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.voice_tasks IS 'Stores voice generation tasks from Vivoo.work API.';

-- Bật RLS
ALTER TABLE public.voice_tasks ENABLE ROW LEVEL SECURITY;

-- Chính sách bảo mật
CREATE POLICY "Users can manage their own voice tasks" ON public.voice_tasks
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tạo bảng để lưu trữ các giọng nói đã clone
CREATE TABLE public.cloned_voices (
  voice_id TEXT PRIMARY KEY, -- Sử dụng voice_id từ API
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_name TEXT NOT NULL,
  sample_audio TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.cloned_voices IS 'Stores user-cloned voices from Vivoo.work API.';

-- Bật RLS
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

-- Chính sách bảo mật
CREATE POLICY "Users can manage their own cloned voices" ON public.cloned_voices
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);