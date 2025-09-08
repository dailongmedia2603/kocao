-- This script schedules a cron job to run the scan-koc-stats function daily at 00:01 UTC.

-- First, ensure the necessary extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgtap; -- For testing if needed
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- Grant usage to the postgres user if not already granted
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA vault TO postgres;
GRANT EXECUTE ON FUNCTION vault.get_secret(text) TO postgres;


-- Remove any existing job with the same name to avoid conflicts
SELECT cron.unschedule('daily-koc-stats-scan');

-- Schedule the new job with proper headers
SELECT cron.schedule(
  'daily-koc-stats-scan',
  '1 0 * * *', -- Runs every day at 00:01 UTC
  $$
    SELECT net.http_post(
      url:='https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/scan-koc-stats',
      headers:=jsonb_build_object(
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw',
        'Authorization', 'Bearer ' || vault.get_secret('SUPABASE_SERVICE_ROLE_KEY')
      )
    )
  $$
);