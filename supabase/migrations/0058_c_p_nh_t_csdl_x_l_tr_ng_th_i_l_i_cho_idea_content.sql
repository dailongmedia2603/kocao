-- Thêm cột để lưu thông báo lỗi
ALTER TABLE public.koc_content_ideas
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Cập nhật trigger cho bảng voice_tasks để xử lý trạng thái lỗi
CREATE OR REPLACE FUNCTION public.update_idea_status_on_voice_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Khi tác vụ hoàn thành
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' AND NEW.audio_url IS NOT NULL THEN
    UPDATE public.koc_content_ideas
    SET 
      status = 'Đã tạo voice',
      voice_audio_url = NEW.audio_url,
      error_message = NULL -- Xóa lỗi cũ nếu có
    WHERE voice_task_id = NEW.id;
  -- Khi tác vụ thất bại
  ELSIF (NEW.status = 'error' OR NEW.status = 'failed') AND (OLD.status IS DISTINCT FROM 'error' AND OLD.status IS DISTINCT FROM 'failed') THEN
    UPDATE public.koc_content_ideas
    SET
      status = 'Lỗi tạo voice',
      error_message = NEW.error_message
    WHERE voice_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Tạo trigger cho bảng dreamface_tasks để xử lý trạng thái lỗi
CREATE OR REPLACE FUNCTION public.update_idea_status_on_video_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Khi tác vụ thất bại
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    UPDATE public.koc_content_ideas
    SET
      status = 'Lỗi tạo video',
      error_message = NEW.error_message
    WHERE dreamface_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Áp dụng trigger (xóa trigger cũ nếu có để tránh lỗi)
DROP TRIGGER IF EXISTS on_dreamface_task_updated ON public.dreamface_tasks;
CREATE TRIGGER on_dreamface_task_updated
  AFTER UPDATE ON public.dreamface_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_idea_status_on_video_completion();