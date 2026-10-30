-- Nova Edge starter data. Run AFTER schema.sql, in Supabase -> SQL Editor. Safe to re-run: it only adds what is missing.
-- Everything here can be edited later from the admin dashboard.

-- Shop sections (the menu). "soon" shows the Soon tag and the coming-soon page until you switch it off in Admin -> Sections.
insert into public.sections (name, sort_order, soon, visible) values
  ('T-Shirts', 1, false, true),
  ('Hoodies',  2, true,  true),
  ('Joggers',  3, true,  true),
  ('Caps',     4, true,  true),
  ('Casuals',  5, true,  true)
on conflict (name) do nothing;

-- Delivery fees (placeholders: change them in Admin -> Delivery). A state with no zone uses "Everywhere else".
insert into public.delivery_zones (name, states, fee) values
  ('Akwa Ibom',      '{"Akwa Ibom"}', 2000),
  ('Lagos',          '{"Lagos"}',     3500),
  ('Abuja (FCT)',    '{"FCT"}',       4000),
  ('Everywhere else','{}',            5000)
on conflict (name) do nothing;

-- Store wording (edit in Admin -> Store content)
insert into public.site_settings (key, value) values
  ('content', '{
    "announcements": ["Customizing costs nothing extra", "Printed on demand", "Secure payment with Paystack"],
    "hero_eyebrow": "Nova Edge Clothing",
    "hero_title": "Made to wear.",
    "hero_accent": "Made yours.",
    "hero_sub": "Premium everyday pieces with the Nova Edge symbol, or without it. Start clean, add your own design, and we print it on demand.",
    "footer_tagline": "Premium everyday clothing, printed on demand and shipped to you.",
    "contact_email": "",
    "contact_phone": "",
    "instagram": ""
  }'::jsonb)
on conflict (key) do nothing;

-- The plain, designable tee (the price is a placeholder: set the real one in Admin -> Products).
insert into public.products (title, description, category, price, images, sizes, colors, customizable, in_stock, active, featured, sort_order)
select 'Classic Tee',
       'A clean everyday tee with the small Nova Edge symbol on the chest. Keep it, resize it or remove it, or add your own design.',
       'T-Shirts', 15000, '{}', '{S,M,L,XL,XXL}', '{White,Black,Ash}', true, true, true, true, 1
where not exists (select 1 from public.products where title = 'Classic Tee');
