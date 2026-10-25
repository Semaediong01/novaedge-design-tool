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

-- ---------------------------------------------------------------- make yourself admin
-- 1. Create your admin user: Supabase -> Authentication -> Users -> Add user (email + password).
-- 2. Then run this with your admin email:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com'
-- on conflict (user_id) do nothing;
