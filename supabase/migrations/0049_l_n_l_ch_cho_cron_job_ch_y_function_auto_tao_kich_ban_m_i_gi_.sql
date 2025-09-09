-- Lên lịch cho một công việc định kỳ (cron job) có tên 'goi-auto-tao-kich-ban'
-- '0 * * * *' có nghĩa là "chạy vào phút thứ 0 của mỗi giờ, mỗi ngày"
-- Công việc này sẽ gọi đến function 'auto-tao-kich-ban' thông qua một yêu cầu POST
SELECT cron.schedule(
  'goi-auto-tao-kich-ban',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/auto-tao-kich-ban',
    headers:='{
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"
    }'::jsonb,
    body:='{}'::jsonb
  )
  $$
);