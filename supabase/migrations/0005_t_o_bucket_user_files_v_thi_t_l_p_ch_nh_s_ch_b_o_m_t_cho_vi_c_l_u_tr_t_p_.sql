-- Tạo bucket lưu trữ tệp có tên 'user_files' và đặt nó ở chế độ công khai.
-- Chế độ công khai là cần thiết để các URL công khai hoạt động, cho phép extension truy cập tệp.
INSERT INTO storage.buckets (id, name, public)
VALUES ('user_files', 'user_files', true)
ON CONFLICT (id) DO NOTHING;

-- Chính sách bảo mật cho phép người dùng xem (tải xuống) các tệp của chính họ.
-- Điều này kiểm tra xem ID người dùng có khớp với thư mục cấp cao nhất trong đường dẫn tệp hay không.
CREATE POLICY "Allow authenticated users to view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chính sách bảo mật cho phép người dùng tải lên tệp vào thư mục của chính họ.
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chính sách bảo mật cho phép người dùng cập nhật các tệp của chính họ.
CREATE POLICY "Allow authenticated users to update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chính sách bảo mật cho phép người dùng xóa các tệp của chính họ.
CREATE POLICY "Allow authenticated users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);