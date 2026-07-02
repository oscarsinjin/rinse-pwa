-- Local dev seed data. Re-applied every `supabase db reset`.
insert into public.service_tiers (name, description, category, base_price, price_per_kg, turnaround_hours) values
  ('Wash & Fold', 'Everyday laundry, washed, dried and neatly folded.', 'everyday', 60, 35, 24),
  ('Wash & Iron', 'Everyday laundry, washed and pressed.', 'everyday', 80, 45, 24),
  ('Dry Clean', 'Formal and delicate garments, professionally dry cleaned.', 'formal_delicate', 120, null, 48),
  ('Express Dry Clean', 'Formal and delicate garments, same-day turnaround.', 'formal_delicate', 180, null, 8);
