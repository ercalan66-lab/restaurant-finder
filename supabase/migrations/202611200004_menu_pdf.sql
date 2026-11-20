-- Restaurants can publish their full menu as a PDF, which customers view or download from the
-- restaurant page. Requires 202611200003_customer_reviews.sql.

alter table public.restaurants add column menu_pdf_url text;

-- Owners edit their listing column by column (see 202611180002), so they need this column too.
grant update (menu_pdf_url) on public.restaurants to authenticated;

-- Public bucket for menu PDFs: anyone can open them, but files live under "<restaurant id>/..." and
-- only that restaurant's owner can add or remove them (the same rule as restaurant-photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-menus', 'restaurant-menus', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "owners add restaurant menus" on storage.objects for insert to authenticated with check (
  bucket_id = 'restaurant-menus'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
-- Removing a file also needs read access to it.
create policy "owners read own restaurant menu objects" on storage.objects for select to authenticated using (
  bucket_id = 'restaurant-menus'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
create policy "owners remove restaurant menus" on storage.objects for delete to authenticated using (
  bucket_id = 'restaurant-menus'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
