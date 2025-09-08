-- Add a policy to allow users to delete their own scan logs
CREATE POLICY "Users can delete their own scan logs"
ON public.news_scan_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);