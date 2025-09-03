CREATE OR REPLACE FUNCTION get_projects_for_user()
RETURNS TABLE(
    id uuid,
    user_id uuid,
    name text,
    created_at timestamptz,
    profiles json,
    tasks json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.name,
        p.created_at,
        json_build_object(
            'id', pr.id,
            'first_name', pr.first_name,
            'last_name', pr.last_name,
            'avatar_url', pr.avatar_url
        ) as profiles,
        json_build_array(json_build_object('count', (SELECT count(*) FROM tasks t WHERE t.project_id = p.id))) as tasks
    FROM
        projects p
    LEFT JOIN
        profiles pr ON p.user_id = pr.id
    WHERE
        p.user_id = auth.uid()
    ORDER BY
        p.created_at DESC;
END;
$$;