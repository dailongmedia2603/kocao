-- Lên lịch cho một công việc định kỳ (cron job) có tên 'goi-auto-tao-voice'
-- '1 * * * *' có nghĩa là "chạy vào phút thứ 1 của mỗi giờ, mỗi ngày"
-- (Chạy sau job tạo kịch bản 1 phút để đảm bảo có kịch bản mới để xử lý)
SELECT cron.schedule(
  'goi-auto-tao-voice',
  '1 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/auto-tao-voice',
    headers:='{
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"
    }'::jsonb,
    body:='{}'::jsonb
  )
  $$
);