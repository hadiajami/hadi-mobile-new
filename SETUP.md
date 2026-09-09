# HADI MOBILE — Setup Guide

This package is ready for GitHub Pages. The store works immediately in demo mode.
To make the Admin Dashboard save changes for everyone, connect the free Supabase backend.

## 1. Create Supabase
1. Go to Supabase and create a project.
2. Open **SQL Editor**.
3. Open `supabase/setup.sql` from this package.
4. Paste the entire SQL file and run it.

## 2. Create the one admin account
1. In Supabase open **Authentication → Users**.
2. Click **Add user** / create user.
3. Enter the admin email and password you want.
4. Copy the created user's UUID.
5. In SQL Editor run:

```sql
insert into public.admins(user_id)
values ('PASTE-THE-ADMIN-USER-UUID-HERE');
```

Only a user whose UUID exists in `public.admins` can use the dashboard.

## 3. Connect the website
In Supabase open **Project Settings → API**.
Copy:
- Project URL
- anon / public key

Open `assets/js/config.js` and replace:

```js
SUPABASE_URL: "YOUR_SUPABASE_URL",
SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
```

Do NOT place a Supabase service-role key in this website.

## 4. Admin login
After deployment:
`YOUR-WEBSITE/admin/login.html`

The admin can:
- Add/edit/delete categories
- Add subcategories
- Reorder categories
- Add/edit/delete products
- Upload product images
- Change price and description
- Mark products in/out of stock
- Feature products on the homepage
- Hide/show products

## 5. WhatsApp checkout
Already configured for:
**+961 76 150 404**

Customers add products to the cart and press **Continue on WhatsApp**.
The message contains product names, quantities and total in USD.

## 6. GitHub Pages
1. Create a GitHub repository.
2. Upload everything INSIDE the `hadi-mobile-shop` folder.
3. Commit to `main`.
4. GitHub → repository **Settings → Pages**.
5. Source: **Deploy from a branch**.
6. Branch: `main`, folder `/root`.
7. Save.

## Important
The included product/category data shown before Supabase is configured is only demo data.
After Supabase is connected, the live store reads from the database.

## Later upgrades already supported by this architecture
- Customer accounts
- Loyalty points
- Order history
- Coupons
- Online payment
- Desktop/tablet layout expansion
- Multiple admin/staff accounts
- Product variants (color/storage)
