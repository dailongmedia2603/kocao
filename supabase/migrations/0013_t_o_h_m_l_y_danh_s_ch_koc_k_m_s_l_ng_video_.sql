CREATE OR REPLACE FUNCTION get_kocs_with_video_count(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    field text,
    avatar_url text,
    created_at timestamptz,
    channel_url text,
    folder_path text,
    video_count bigint
)
LANGUAGE plpgsql
AS $$
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
        (
            SELECT COUNT(*)
            FROM public.koc_files kf
            WHERE kf.koc_id = k.id AND kf.r2_key LIKE '%/generated/%'
        ) AS video_count
    FROM
        public.kocs k
    WHERE
        k.user_id = p_user_id
    ORDER BY
        k.created_at DESC;
END;
$$;