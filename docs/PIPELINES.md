# Nova Edge build: pipelines and shared contract

Four pipelines, built strictly one at a time: finish one, get Sema's confirmation, deploy, then start the next. Each only edits the files it owns. Anything outside your list: do not touch it unless the pipeline needs it, and say so in the report.

READ FIRST: AGENTS.md says this Next.js version has breaking changes. Check `node_modules/next/dist/docs/` for anything you are unsure about before writing code. Run `npm install` in your worktree first.

## Brand (all pipelines)
- Brand green (sampled from the logo): **#2C4A29** (deepened Oct 29; the logo itself samples at #365532). Black: **#030302**. White: #FFFFFF.
- The old greens (#2FA36B, #4FD98C, #1c5c3e) were WRONG and must not remain anywhere. Derive tints/shades from #365532 only (e.g. hover #213A20, light tint #E6EEE4, soft border #D0DDCD. Dark mode lives in `app/globals.css` under `:root[data-theme="dark"]`).
- Logo files in `public/brand/`: `ne-monogram*.png` (symbol) and `novaedge-logo*.png` (full logo with NOVAEDGE CLOTHING). Variants: default = green, `-white`, `-black`, all transparent PNG.
- Store look: bright, light theme (white background, black text, green accents), inspired by Zazzle and TeePublic. Fonts already wired: Bricolage Grotesque (display) and IBM Plex Sans (body).
- Launch products: T-shirts (white, black, ash) and caps. Every garment carries a small NE symbol on the left chest by default; customers can remove, enlarge or move it.

## File ownership
**P1 Website polish**: `app/globals.css`, `app/layout.tsx`, `app/(store)/layout.tsx`, `app/(store)/page.tsx`, `app/(store)/shop/**`, `app/(store)/login/**`, `app/(store)/signup/**`, `app/(store)/orders/**`, `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/ProductCard.tsx`, `components/AuthForm.tsx`, `components/CartLink.tsx`, `public/brand/**`, `app/icon.png`. May add CSS classes for cart/checkout pages inside `app/globals.css` only; do not edit the cart/checkout/product/design/admin markup.

**P2 Tee preview and products**: `app/(store)/design/**`, `app/(store)/product/**`, `components/ProductActions.tsx`, `components/mockups/**` (new), `public/mockups/**` (new), `lib/mockups.ts` (new), `lib/catalog.ts` (new: launch product definitions, no DB access). Put your CSS in your own files (CSS modules or a local `design.css` imported by your pages), not in `app/globals.css`.

**P3 Database and admin**: `supabase/**`, `lib/types.ts`, `lib/products.ts`, `lib/orders.ts`, `lib/auth.ts`, `lib/supabase/**`, `app/admin/**`, `app/auth/**`, `app/api/paystack/**`, `proxy.ts`, `SETUP.md`, `.env.example`. Admin CSS goes in `app/admin/admin.css`.

**P4 Cart and checkout**: `app/(store)/cart/**`, `app/(store)/checkout/**`, `app/api/checkout/**`, `components/CartProvider.tsx`, `lib/checkout.ts` (new), `lib/paystack.ts`, `lib/format.ts`. CSS in its own file, not `app/globals.css`.

## Database contract (P3 builds it, P4 and P2 consume it)
Keep every existing table and policy. Add:

- `products`: new column `kind text not null default 'tshirt'` (values `tshirt`, `cap`), `color_options jsonb not null default '[]'` (array of `{name, hex}`), `featured boolean not null default false`, `sort_order int not null default 0`.
- `discounts(id uuid pk, code text unique not null (stored uppercase), type text check in ('percent','fixed'), value numeric not null, min_order numeric default 0, starts_at timestamptz, ends_at timestamptz, usage_limit int, used_count int default 0, active boolean default true, created_at)`.
- `delivery_zones(id uuid pk, name text not null, states text[] not null, fee numeric(12,2) not null, active boolean default true, created_at)`. A state not covered by any active zone uses a `default` zone row named exactly `Everywhere else` with `states = '{}'`.
- `affiliates(id uuid pk, name text not null, email text, code text unique not null (uppercase), commission_rate numeric not null default 12, active boolean default true, created_at)`.
- `templates(id uuid pk, title text not null, kind text not null default 'tshirt', elements jsonb not null default '[]', preview_url text, active boolean default true, created_at)`. Admin-uploaded designs customers can personalize; `elements` uses the same shape the designer already saves in `designs.elements`.
- `orders`: new columns `subtotal numeric(12,2)`, `discount_code text`, `discount_amount numeric(12,2) default 0`, `delivery_fee numeric(12,2) default 0`, `affiliate_id uuid references affiliates(id)`, `affiliate_commission numeric(12,2) default 0`. `total = subtotal - discount_amount + delivery_fee`.
- RLS: public can read active `discounts`? No. Discounts, affiliates: admin only. `delivery_zones` and `templates` (active): public read, admin write. Server (service role) validates discount codes and affiliate codes at checkout.
- Types for all of these live in `lib/types.ts` (P3 owns it): `Discount`, `DeliveryZone`, `Affiliate`, `Template`, plus the new Product and Order fields. P2 and P4 import these types; until P3 lands, code against the shapes above.
- Data access helpers (P3 writes in `lib/products.ts` / `lib/orders.ts`, plus new `lib/store-data.ts` for zones, templates and discounts): `getProducts`, `getProduct`, `getDeliveryZones`, `getTemplates`, `findActiveDiscount(code)`, `findActiveAffiliate(code)`.
- Seed: `supabase/seed.sql` inserts the launch catalog (white, black, ash tee and a cap, with color_options hex values), the delivery zones (Akwa Ibom, Lagos, Abuja FCT, Everywhere else) with sensible naira fees, and one example discount. Re-runnable.

## Rules for everyone
- No Firebase Storage. Supabase only.
- Mobile-first and fully responsive.
- Do not commit secrets. `npm run lint` and `npm run build` must pass in your worktree (build may need dummy env vars from `.env.example`; the app already shows a clear message when Supabase env vars are missing, keep that).
- Commit to your own branch with clear messages. Do not push. Final report: what you built, files changed, anything you needed from another pipeline.
