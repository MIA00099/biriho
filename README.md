# Biriho Shop

Responsive electronics and home-appliance catalog with WhatsApp ordering and a Supabase-backed admin dashboard.

## Files

- `index.html` — public storefront
- `biriho-admin.html` — private admin dashboard for products and departments
- `assets/shop.css` — storefront styles
- `assets/shop.js` — storefront logic
- `assets/admin.css` — admin styles
- `assets/admin.js` — admin logic
- `supabase/setup.sql` — database tables, Row Level Security policies, and admin registration

## Setup

1. Create the admin user in Supabase Authentication.
2. Run `supabase/setup.sql` in the Supabase SQL Editor.
3. Open `biriho-admin.html` and sign in.
4. Deploy the repository with GitHub Pages, Netlify, or another static host.

The Supabase anon key is a browser-side public key. Database protection depends on the Row Level Security policies in `supabase/setup.sql`. The ImgBB upload key is also used in the browser and can be seen by visitors with access to the admin page.
