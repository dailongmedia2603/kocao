-- Schedule the function to run daily at 00:01 UTC
-- This requires the pg_cron extension to be enabled.
SELECT cron.schedule(
  'daily-koc-stats-scan',
  '1 0 * * *', -- 1 minute past midnight every day
  $$
  SELECT net.http_post(
    url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/scan-koc-stats',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzIనిIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ0Njc0MCwiZXhwIjoyMDcyMDIyNzQwfQ.a-w5otk2p8ix5p22i0lpV5VIp2G_Uv5y222i__msv6Y"}'
  )
  $$
);