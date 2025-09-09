-- Xóa lịch cũ một cách an toàn để tránh lỗi nếu nó không tồn tại
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-koc-stats-scan';

-- Lên lịch lại công việc quét KOC hàng ngày với đầy đủ header xác thực
SELECT cron.schedule(
  'daily-koc-stats-scan', -- Tên của công việc
  '1 0 * * *', -- Lịch trình: "vào 00:01 mỗi ngày (giờ UTC)"
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/scan-koc-stats',
    headers:='{
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"
    }'::jsonb,
    body:='{"source":"cron"}'::jsonb
  ) AS request_id;
  $$
);