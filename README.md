# Biriho Shop

Responsive electronics and home-appliance catalog with WhatsApp ordering and a Supabase-backed admin dashboard.

## Files

- `index.html` — public storefront
- `admin.html` — password-protected admin dashboard
- `assets/catalog.js` — storefront products, prices, search and WhatsApp logic
- `assets/shop.css` — storefront styles
- `assets/admin.css` — admin styles
- `assets/admin.js` — product and department management
- `supabase/setup.sql` — non-destructive database setup
- `supabase/add-price.sql` — safe price-column and performance upgrade

## Setup

1. Run `supabase/setup.sql` in the Supabase SQL Editor.
2. Open `admin.html`.
3. Enter the admin password: `biriho2026`.
4. Add, edit or delete products and departments.

The setup does not drop existing products or departments. The Supabase anon key is used in the browser so the storefront and simple admin can communicate with the database.
