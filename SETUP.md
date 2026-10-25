# Nova Edge setup

Next.js 16 storefront with Supabase (database, login, file storage) and Paystack (payments).

## 1. Database
Supabase → SQL Editor → paste all of `supabase/schema.sql` → Run. It creates the tables, security rules and the three storage buckets (`product-images`, `design-uploads`, `print-files`). It is safe to run again.

## 2. Admin account
1. Supabase → Authentication → Users → **Add user** → enter the admin email and a strong password (tick "Auto confirm").
2. SQL Editor, run (with your admin email):
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com'
   on conflict (user_id) do nothing;
   ```
3. Log in at `/admin/login`. Only emails in the `admins` table get in; customer accounts cannot.

To add another admin later, create their user the same way and run the insert with their email.

## 3. Customer login
- Supabase → Authentication → Providers: enable **Email** and **Google** (Google Client ID and Secret from Google Cloud Console; the redirect URI is the Supabase callback URL).
- Supabase → Authentication → URL Configuration: set **Site URL** to your live domain and add these under **Redirect URLs**: `http://localhost:3000/**` and `https://YOUR-DOMAIN/**`.
- Before launch, turn **Confirm email** back on.

## 4. Environment variables
Copy `.env.example` to `.env.local` locally, and add the same names in Vercel → Project → Settings → Environment Variables. Remove the old `SHOPIFY_*` variables.

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon or publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (secret key, server only) |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys (start with the test key) |
| `NEXT_PUBLIC_SITE_URL` | your live address, no trailing slash |

## 5. Paystack
- Paystack → Settings → API Keys & Webhooks → set the **Webhook URL** to `https://YOUR-DOMAIN/api/paystack/webhook`.
- Test with the test key and a Paystack test card, then switch to the live key.

## How it fits together
- Shop, product and cart pages are public. Checkout, the designer and My orders need a customer login.
- Prices are always re-read from the database at checkout; the browser's prices are never trusted.
- An order is marked paid only after Paystack confirms the exact amount (on return to the site, and again by webhook). Paying also locks the order's designs so they can't be edited.
- Each customized cart item holds one saved design. Deleting the design in the cart removes it from the database. Print-ready PNGs are saved in the `print-files` bucket and appear on the order in `/admin/orders`.

## Product photos
The first photo of a customizable product is the garment in the designer. Use a square, front-facing photo of the plain garment on a clean background. The print area is a fixed box on that square, so keep the garment centered the same way for every product.
