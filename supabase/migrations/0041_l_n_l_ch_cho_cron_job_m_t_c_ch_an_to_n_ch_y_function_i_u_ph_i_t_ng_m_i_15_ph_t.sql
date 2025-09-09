-- Kích hoạt extension pg_cron nếu chưa có
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Xóa lịch cũ một cách an toàn để tránh lỗi nếu nó không tồn tại
-- Lệnh này sẽ chỉ chạy nếu tìm thấy công việc có tên 'run-automation-campaigns-job'
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'run-automation-campaigns-job';

-- Lên lịch cho một công việc mới chạy mỗi 15 phút
-- Nó sẽ gửi một yêu cầu POST đến Edge Function 'run-automation-campaigns'
SELECT cron.schedule(
  'run-automation-campaigns-job', -- Tên của công việc
  '*/15 * * * *', -- Lịch trình: "vào phút thứ 0, 15, 30, 45 của mỗi giờ"
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/run-automation-campaigns',
    headers:='{
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw"
    }'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);