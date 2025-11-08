SELECT cron.schedule(
    'sync-cloned-voices-job',
    '* * * * *', -- Run every minute
    $$
    SELECT net.http_post(
        url:= 'https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/sync-cloned-voices',
        headers:= '{"Content-Type": "application/json", "Authorization": "Bearer SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,
        body:= '{}'::jsonb
    ) AS "result";
    $$
);