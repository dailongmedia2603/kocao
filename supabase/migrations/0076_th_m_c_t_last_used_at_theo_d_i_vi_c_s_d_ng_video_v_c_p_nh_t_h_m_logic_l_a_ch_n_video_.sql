-- Thêm cột mới vào bảng koc_files để theo dõi thời gian sử dụng
ALTER TABLE public.koc_files
ADD COLUMN last_used_at TIMESTAMPTZ;

-- Xóa hàm cũ không còn sử dụng
DROP FUNCTION IF EXISTS public.get_random_source_video(uuid);

-- Tạo hàm mới với logic chọn video tuần tự và tự động cập nhật
CREATE OR REPLACE FUNCTION public.get_and_update_next_source_video(p_koc_id uuid)
RETURNS SETOF koc_files
LANGUAGE plpgsql
AS $function$
DECLARE
    selected_video record;
BEGIN
    -- Chọn video chưa được sử dụng hoặc được sử dụng lâu nhất, và khóa dòng đó lại
    SELECT *
    INTO selected_video
    FROM public.koc_files
    WHERE koc_id = p_koc_id
      AND r2_key LIKE '%/sources/videos/%'
    ORDER BY last_used_at ASC NULLS FIRST, created_at ASC
    LIMIT 1
    FOR UPDATE;

    -- Nếu tìm thấy video, cập nhật thời gian sử dụng và trả về video đó
    IF FOUND THEN
        UPDATE public.koc_files
        SET last_used_at = NOW()
        WHERE id = selected_video.id;

        RETURN QUERY SELECT * FROM public.koc_files WHERE id = selected_video.id;
    END IF;
END;
$function$;