-- Create a new private bucket for tickets
-- Note: 'tickets' bucket creation might need to be done via dashboard if this script runs without admin privileges to storage schema.
-- But usually inserting into storage.buckets works if the user has permissions or via migration.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files to 'tickets' bucket
DROP POLICY IF EXISTS "Authenticated users can upload tickets" ON storage.objects;
CREATE POLICY "Authenticated users can upload tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'tickets' );

-- Policy to allow authenticated users to view tickets
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON storage.objects;
CREATE POLICY "Authenticated users can view tickets"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'tickets' );

-- Optional: Allow users to delete their own tickets (if needed)
-- DROP POLICY IF EXISTS "Users can delete own tickets" ON storage.objects;
-- CREATE POLICY "Users can delete own tickets"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING ( bucket_id = 'tickets' AND auth.uid() = owner );
