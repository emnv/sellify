-- Upsert and delete through the Storage API also need SELECT on the object.
-- Public reads go through the public bucket URL and are unaffected.
create policy "members read shop media" on storage.objects
  for select to authenticated
  using (bucket_id = 'shop-media' and private.is_shop_member(private.media_path_shop_id(name)));
