-- Nova Edge schema. Run the whole file once in Supabase -> SQL Editor.
-- Safe to re-run: uses "if not exists" / "drop policy if exists".

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.admins enable row level security;
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'T-Shirts',
  price numeric(12,2) not null check (price >= 0),          -- Naira
  images text[] not null default '{}',                      -- first image is the main one + the designer garment photo
  sizes text[] not null default '{S,M,L,XL}',
  colors text[] not null default '{}',
  customizable boolean not null default true,
  in_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (active or public.is_admin());
drop policy if exists "products admin insert" on public.products;
create policy "products admin insert" on public.products
  for insert to authenticated with check (public.is_admin());
drop policy if exists "products admin update" on public.products;
create policy "products admin update" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products admin delete" on public.products;
create policy "products admin delete" on public.products
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- designs
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  elements jsonb not null default '[]'::jsonb,
  print_url text,                                           -- print-ready PNG in the print-files bucket
  locked boolean not null default false,                    -- set true once the order is paid
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.designs enable row level security;
drop policy if exists "designs read own" on public.designs;
create policy "designs read own" on public.designs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "designs insert own" on public.designs;
create policy "designs insert own" on public.designs
  for insert to authenticated with check (user_id = auth.uid() and locked = false);
drop policy if exists "designs update own unlocked" on public.designs;
create policy "designs update own unlocked" on public.designs
  for update to authenticated
  using (user_id = auth.uid() and locked = false)
  with check (user_id = auth.uid() and locked = false);
drop policy if exists "designs delete own unlocked" on public.designs;
create policy "designs delete own unlocked" on public.designs
  for delete to authenticated using (user_id = auth.uid() and locked = false);

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  reference text not null unique,                           -- Paystack reference
  status text not null default 'pending'
    check (status in ('pending','paid','printing','shipped','delivered','cancelled')),
  total numeric(12,2) not null,
  shipping jsonb not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  image text,
  size text,
  color text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  design_id uuid references public.designs(id) on delete set null,
  print_url text
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders read own" on public.orders;
create policy "orders read own" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order items read own" on public.order_items;
create policy "order items read own" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );
-- Orders and items are created only by the server (service role) after the price is re-checked.

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('design-uploads', 'design-uploads', true),
  ('print-files', 'print-files', true)
on conflict (id) do nothing;

-- Admins manage product photos
drop policy if exists "product images admin write" on storage.objects;
create policy "product images admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- Customers write only into their own folder: <user id>/<file>
drop policy if exists "customer files write own folder" on storage.objects;
create policy "customer files write own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('design-uploads', 'print-files')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================ PIPELINE 3: full admin
-- Everything below is safe to re-run.

-- ---------------------------------------------------------------- admins: roles
alter table public.admins add column if not exists role text not null default 'admin';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'admins_role_check') then
    alter table public.admins add constraint admins_role_check check (role in ('owner','admin'));
  end if;
  -- admins that already exist: the first one becomes the owner (owners can add and remove other admins)
  if not exists (select 1 from public.admins where role = 'owner') then
    update public.admins set role = 'owner'
    where user_id = (select user_id from public.admins order by created_at asc limit 1);
  end if;
end $$;

-- ...and while there is no owner yet, the next admin you add becomes the owner.
create or replace function public.first_admin_is_owner()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.admins where role = 'owner') then new.role := 'owner'; end if;
  return new;
end $$;
drop trigger if exists admins_first_owner on public.admins;
create trigger admins_first_owner before insert on public.admins
  for each row execute function public.first_admin_is_owner();

-- ---------------------------------------------------------------- products: price promo, affiliate rate, homepage, variants
alter table public.products
  add column if not exists featured boolean not null default false,            -- shown on the home page
  add column if not exists sort_order int not null default 0,                  -- order on the home page and in the shop
  add column if not exists promo_price numeric(12,2) check (promo_price is null or promo_price >= 0),
  add column if not exists promo_label text,
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz,
  add column if not exists affiliate_rate numeric(5,2) check (affiliate_rate is null or (affiliate_rate >= 0 and affiliate_rate <= 100)),
  add column if not exists sold_out_variants text[] not null default '{}',     -- "Black|XL" = that combination, "Black|*" = a whole colour, "*|XL" = a whole size
  add column if not exists symbol_default boolean not null default true,       -- starts with the NE symbol on the chest
  add column if not exists allow_uploads boolean not null default true;        -- customers may upload their own images

create index if not exists products_featured_idx on public.products (featured, sort_order);

-- ---------------------------------------------------------------- shop sections (the menu)
create table if not exists public.sections (
  name text primary key,
  sort_order int not null default 0,
  soon boolean not null default false,          -- shows the "Soon" tag and the coming-soon page
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.sections enable row level security;
drop policy if exists "sections public read" on public.sections;
create policy "sections public read" on public.sections for select using (true);
drop policy if exists "sections admin write" on public.sections;
create policy "sections admin write" on public.sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- editable store content
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings for select using (true);
drop policy if exists "settings admin write" on public.site_settings;
create policy "settings admin write" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- discount codes (validated by the server only)
create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text not null default '',
  type text not null check (type in ('percent','fixed')),
  value numeric(12,2) not null check (value > 0),
  min_order numeric(12,2) not null default 0,
  product_ids uuid[],                                   -- null = every product
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 100)
);
alter table public.discounts enable row level security;
drop policy if exists "discounts admin all" on public.discounts;
create policy "discounts admin all" on public.discounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- delivery zones
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  states text[] not null default '{}',                  -- the "Everywhere else" zone has an empty list
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.delivery_zones enable row level security;
drop policy if exists "zones public read" on public.delivery_zones;
create policy "zones public read" on public.delivery_zones for select using (active or public.is_admin());
drop policy if exists "zones admin write" on public.delivery_zones;
create policy "zones admin write" on public.delivery_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- affiliates
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  code text not null unique check (code = upper(code)),
  commission_rate numeric(5,2) not null default 12 check (commission_rate >= 0 and commission_rate <= 100),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
drop policy if exists "affiliates admin all" on public.affiliates;
create policy "affiliates admin all" on public.affiliates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- design templates (built with the designer by admins)
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'T-Shirts',
  elements jsonb not null default '[]'::jsonb,           -- same shape as designs.elements
  preview_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.templates enable row level security;
drop policy if exists "templates public read" on public.templates;
create policy "templates public read" on public.templates for select using (active or public.is_admin());
drop policy if exists "templates admin write" on public.templates;
create policy "templates admin write" on public.templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop trigger if exists templates_touch on public.templates;
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- orders: money, payment vs fulfillment, affiliate
alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists fulfillment_status text not null default 'new',
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists delivery_fee numeric(12,2) not null default 0,
  add column if not exists delivery_zone text,
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists affiliate_code text,
  add column if not exists affiliate_commission numeric(12,2) not null default 0,
  add column if not exists affiliate_paid boolean not null default false,
  add column if not exists admin_note text not null default '';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending','paid','failed','refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfillment_status_check') then
    alter table public.orders add constraint orders_fulfillment_status_check
      check (fulfillment_status in ('new','printing','shipped','delivered','cancelled'));
  end if;

  -- Move the old single "status" into the two separate statuses, then retire it.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'orders' and column_name = 'status') then
    update public.orders set
      payment_status = case
        when status = 'pending' then 'pending'
        when status = 'cancelled' and paid_at is null then 'failed'
        else 'paid' end,
      fulfillment_status = case
        when status in ('printing','shipped','delivered','cancelled') then status
        else 'new' end;
    alter table public.orders drop column status;
  end if;
  update public.orders set subtotal = total where subtotal is null;
end $$;

create index if not exists orders_payment_idx on public.orders (payment_status, created_at desc);
create index if not exists orders_affiliate_idx on public.orders (affiliate_id);

-- Each order keeps its own copy of the artwork, so it survives even if the design is later changed or removed.
alter table public.order_items
  add column if not exists design_elements jsonb,
  add column if not exists production_url text,                  -- transparent print artwork (no garment)
  add column if not exists discount_share numeric(12,2) not null default 0,
  add column if not exists commission numeric(12,2) not null default 0;

-- The designer also saves a transparent, garment-free copy for the printer.
alter table public.designs add column if not exists production_url text;

-- ---------------------------------------------------------------- discount use counter (server only)
-- Counts one use of a code. Returns false when the code is no longer usable (limit reached, switched off or expired),
-- so a limited code can never be used more times than its limit.
drop function if exists public.bump_discount_use(text);
create or replace function public.bump_discount_use(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.discounts set used_count = used_count + 1
  where code = upper(p_code) and active
    and (usage_limit is null or used_count < usage_limit)
    and (ends_at is null or ends_at >= now() - interval '1 day')
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.bump_discount_use(text) from public, anon, authenticated;
grant execute on function public.bump_discount_use(text) to service_role;

-- ---------------------------------------------------------------- audit log (append-only for admins)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  admin_email text,
  action text not null,                                   -- e.g. "product.update"
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select to authenticated using (public.is_admin());
drop policy if exists "audit admin insert" on public.audit_log;
create policy "audit admin insert" on public.audit_log for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());
create index if not exists audit_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------- make yourself admin
-- 1. Create your admin user: Supabase -> Authentication -> Users -> Add user (email + password).
-- 2. Then run this with your admin email:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com'
-- on conflict (user_id) do nothing;
