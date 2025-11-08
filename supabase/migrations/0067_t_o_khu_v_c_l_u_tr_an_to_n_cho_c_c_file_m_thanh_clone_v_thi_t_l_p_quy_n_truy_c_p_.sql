-- Create a new bucket for voice clone samples.
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_clone_samples', 'voice_clone_samples', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy: Users can only view their own uploaded files.
DROP POLICY IF EXISTS "select_own_voice_clone_samples" ON storage.objects;
CREATE POLICY "select_own_voice_clone_samples" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice_clone_samples' AND auth.uid() = owner);

-- Create policy: Users can only upload files for themselves.
DROP POLICY IF EXISTS "insert_own_voice_clone_samples" ON storage.objects;
CREATE POLICY "insert_own_voice_clone_samples" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice_clone_samples' AND auth.uid() = owner);