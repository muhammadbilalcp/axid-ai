-- Create public storage bucket for chat image uploads
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- Public read
create policy "chat-images public read"
on storage.objects for select
using (bucket_id = 'chat-images');

-- Authenticated users can upload to their own folder
create policy "chat-images user upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can delete their own files
create policy "chat-images user delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);