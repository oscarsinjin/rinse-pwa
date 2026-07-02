-- Public bucket for driver pickup/delivery proof photos and order item photos.
insert into storage.buckets (id, name, public) values ('proof-photos', 'proof-photos', true);

create policy "Authenticated users can upload proof photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proof-photos');

create policy "Anyone can view proof photos"
  on storage.objects for select
  to public
  using (bucket_id = 'proof-photos');
