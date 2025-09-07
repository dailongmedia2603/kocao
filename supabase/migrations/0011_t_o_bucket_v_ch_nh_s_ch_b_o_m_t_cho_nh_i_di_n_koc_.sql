-- Tạo một bucket công khai để lưu trữ ảnh đại diện
INSERT INTO storage.buckets (id, name, public)
VALUES ('koc_avatars', 'koc_avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Chính sách: Cho phép người dùng đã xác thực xem tất cả ảnh đại diện
CREATE POLICY "koc_avatars_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'koc_avatars');

-- Chính sách: Cho phép người dùng đã xác thực tải lên ảnh đại diện của riêng họ
-- Bảo mật được đảm bảo bằng cách yêu cầu thư mục đầu tiên trong đường dẫn tệp phải là ID người dùng
CREATE POLICY "koc_avatars_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'koc_avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Chính sách: Cho phép người dùng cập nhật ảnh đại diện của riêng họ
CREATE POLICY "koc_avatars_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'koc_avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Chính sách: Cho phép người dùng xóa ảnh đại diện của riêng họ
CREATE POLICY "koc_avatars_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'koc_avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);