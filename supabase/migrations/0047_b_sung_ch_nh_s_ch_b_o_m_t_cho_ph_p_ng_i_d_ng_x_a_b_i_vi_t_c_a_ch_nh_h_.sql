-- Tạo một chính sách bảo mật mới, rõ ràng và cụ thể cho hành động DELETE
-- trên bảng news_posts.
CREATE POLICY "Users can delete their own news posts"
ON public.news_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);