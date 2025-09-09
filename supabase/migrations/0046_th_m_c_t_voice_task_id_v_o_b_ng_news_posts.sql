-- Thêm một cột mới vào bảng news_posts để lưu ID của tác vụ tạo voice
ALTER TABLE public.news_posts
ADD COLUMN voice_task_id TEXT;

-- Thêm một ràng buộc khóa ngoại để liên kết cột này với bảng voice_tasks
-- Điều này đảm bảo tính toàn vẹn của dữ liệu.
-- ON DELETE SET NULL có nghĩa là nếu một tác vụ voice bị xóa, trường này sẽ được đặt thành rỗng thay vì xóa cả bài viết.
ALTER TABLE public.news_posts
ADD CONSTRAINT news_posts_voice_task_id_fkey
FOREIGN KEY (voice_task_id)
REFERENCES public.voice_tasks(id)
ON DELETE SET NULL;

-- Thêm một bình luận vào cột để giải thích mục đích của nó cho sau này
COMMENT ON COLUMN public.news_posts.voice_task_id IS 'Lưu trữ ID của tác vụ chuyển văn bản thành giọng nói từ bảng voice_tasks.';