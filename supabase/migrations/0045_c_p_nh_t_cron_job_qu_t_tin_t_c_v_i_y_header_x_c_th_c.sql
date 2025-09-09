-- Xóa lịch cũ một cách an toàn để tránh lỗi nếu nó không tồn tại
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'scan-facebook-news-job';

-- Lên lịch lại công việc quét tin tức mỗi giờ với đầy đủ header xác thực
SELECT cron.schedule(
  'scan-facebook-news-job', -- Tên của công việc
  '0 * * * *', -- Lịch trình: "vào phút thứ 0 của mỗi giờ"
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/scan-facebook-feed',
    headers:='{
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"
    }'::jsonb,
    body:='{"source":"cron"}'::jsonb
  ) AS request_id;
  $$
);