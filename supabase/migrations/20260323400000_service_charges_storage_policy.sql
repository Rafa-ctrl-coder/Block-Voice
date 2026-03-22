-- Storage policies for service-charges bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload service charges"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-charges');

-- Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read service charges"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'service-charges');

-- Allow service role to read all files (for extraction API)
CREATE POLICY "Service role can read service charges"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'service-charges');
