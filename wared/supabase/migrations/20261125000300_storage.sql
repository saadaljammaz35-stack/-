-- وارد — storage buckets.
--
-- Files are uploaded by staff through short-lived signed upload URLs that the Next.js server issues after it
-- has checked the user's permission, file type and size. There are no insert/update/delete policies on
-- storage.objects for anon or authenticated users, so the public anon key cannot write to storage.
-- The buckets are public for reading: podcast audio must be reachable by podcast apps through the RSS feed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('images', 'images', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('audio', 'audio', true, 524288000,
    array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav']),
  ('video', 'video', true, 314572800,
    array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
