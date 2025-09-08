-- Schedule the 'scan-facebook-feed' function to run every hour
select
  cron.schedule(
    'hourly-facebook-scan',
    '0 * * * *', -- Run at the beginning of every hour
    $$
    select
      net.http_post(
        url := 'https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/scan-facebook-feed',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"}'::jsonb
      ) as request_id;
    $$
  );