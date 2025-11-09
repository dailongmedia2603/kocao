DROP FUNCTION IF EXISTS public.get_kocs_with_video_count(uuid);

CREATE OR REPLACE FUNCTION public.get_kocs_with_video_count(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, field text, avatar_url text, created_at timestamp with time zone, channel_url text, folder_path text, video_count bigint, follower_count bigint, like_count bigint, generated_video_count bigint, default_cloned_voice_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.name,
        k.field,
        k.avatar_url,
        k.created_at,
        k.channel_url,
        k.folder_path,
        k.video_count,
        k.follower_count,
        k.like_count,
        (
            SELECT count(*) 
            FROM public.koc_files kf 
            WHERE kf.koc_id = k.id AND kf.r2_key LIKE '%/generated/%'
        ) AS generated_video_count,
        k.default_cloned_voice_id
    FROM
        public.kocs k
    WHERE
        k.user_id = p_user_id
    ORDER BY
        k.created_at DESC;
END;
$function$