AEM BAKERY — WEBSITE (NETLIFY READY)

Pages
  index.html            Home (original hero, now with a 3D depth layer)
  shop.html             All 19 daily bakes: filter, search, sort, quick add
  holiday-baskets.html  Holiday baskets: dates, how it works, request form
  our-kitchen.html      Story, gallery, values, order-to-pickup timeline
  contact.html          Contact cards, message form, FAQs
  checkout.html         Pickup details and order summary
  order-confirmed.html  Shown after an order is placed
  404.html              Page-not-found

Files you'll edit most
  products.js   Names, prices, photos, descriptions, badges, lead time.
  site.css      All styling except the homepage hero.
  hero.css      The original homepage hero, preserved exactly. Avoid editing.
  hero-3d.css   3D tilt, slide turn and floating spheres on the hero.
  app.js        Cart, checkout, menus, forms and the hero slideshow.

PUBLISH
  Drag this folder onto https://app.netlify.com/drop
  (or connect a Git repo: build command blank, publish directory ".").

HOW ONLINE ORDERING WORKS
  1. Customers add bakes to the cart (saved in their browser).
  2. Cinnamon rolls ask for a frosting style (out of the oven, after
     cooling, or none). At checkout customers choose Pickup (17955 Roanoke
     Street NW) or Delivery (address required), a date and time window.
  3. The order is submitted with Netlify Forms (form name: "order").
     Every order appears in Netlify > your site > Forms > order,
     with the item list, total and an order reference such as AEM-K3F9Q.
  4. Turn on email alerts: Netlify > Site configuration > Notifications >
     Form submission notifications > Email notification → AEMBakery@gmail.com
  5. Reply to confirm the time (and any delivery fee). They pay on receipt.

  If the site is ever hosted somewhere other than Netlify, checkout falls
  back to opening the customer's email app with the full order filled in,
  so no order is lost.

  Card payments online are not connected. To take payment at checkout,
  add Stripe Payment Links, Square or Snipcart later — the cart and
  checkout are ready to extend.

  Holiday basket requests ("holiday-basket"), the contact form ("contact")
  and newsletter sign-up ("newsletter") also
  use Netlify Forms and appear in the same Forms dashboard.

IMAGES
  All images are bundled in assets/ (no outside image requests).
  Baking photos are in assets/stock/ (Unsplash License). See ASSET-NOTES.md.

FONTS
  Fraunces (headings) and DM Sans (body), self-hosted in assets/fonts
  under the SIL Open Font License. No Google Fonts request needed.

OWNER DASHBOARD (yoursite.com/admin.html)
Every change shows on the live website within seconds. You don't need to redeploy.
- Home: new orders waiting to be confirmed, orders due today, sales for the last 7 days, and what's coming up this week.
- Orders: appear the moment they're placed. One tap moves an order along: Confirm, then Start baking, then Mark as ready,
  then Completed. You can also email the customer (the message is pre-written), call them, or print the order.
- Products: change the name, price, photo, description or category.
  Category "Holiday specials" = items sold only for the holidays: shown on the Holiday baskets page and inside baskets, never in the daily shop.
  For a daily bake, switch on "Also in holiday baskets" to offer it inside baskets too. Switch a product off to hide it, add a new one, or delete one.
- Website: change any heading, paragraph, button or photo on every page, then press Save.
- Settings:
  - pause ordering
  - announcement bar
  - preparation time (minimum notice, plus extra notice for big orders)
  - delivery areas by ZIP code, each with its own fee, and an optional free-delivery amount
  - holiday basket price, and how many items fit in one basket
  - payment link

One-time setup (about 10 minutes, free Supabase tier):
1. Create a project at supabase.com.
2. Open SQL Editor, paste all of supabase/schema.sql and click Run.
3. Go to Project Settings > API. Copy the Project URL and the anon public key into config.js.
4. Go to Authentication > Users > Add user and create the owner's email and password.
   Then go to Authentication > Providers > Email and turn OFF "Allow new users to sign up".
5. Redeploy to Netlify, open /admin.html and sign in.

PAYMENTS
Checkout ends with "Continue to payment". Paste a Stripe or Square Payment Link into Dashboard > Settings > Payment link,
and customers are sent there to pay by card, Apple Pay or Google Pay. Stripe and Square email the customer a receipt.
You can put {ref} and {total} in the link. Orders are still emailed to you through Netlify Forms as a backup.

ORDER CONFIRMATION EMAIL TO THE CUSTOMER (optional, free)
The file netlify/functions/order-email.mjs emails the customer a confirmation with their items, date and total.
To switch it on, add these in Netlify > Site configuration > Environment variables, then redeploy:
  RESEND_API_KEY             from resend.com (verify your sending domain there)
  EMAIL_FROM                 e.g. AEM Bakery <orders@yourdomain.com>
  SUPABASE_URL               same as in config.js
  SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API > service_role. Keep it secret: never put it in config.js.
