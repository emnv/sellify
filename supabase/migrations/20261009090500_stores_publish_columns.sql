-- Publishing is a server-side step: the app validates the draft against the
-- store config schema, then writes published_config with the service role.
-- Members must not be able to skip that by writing the publish columns
-- directly through the Data API, since public pages render them.
revoke insert, update on public.stores from authenticated;
grant insert (shop_id, slug, template, draft_config) on public.stores to authenticated;
grant update (slug, template, draft_config) on public.stores to authenticated;
