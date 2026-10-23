-- AEM Bakery — Supabase setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It creates the tables, security rules, live updates and the starting product list.

-- ---------- tables ----------
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  price       numeric(8,2) not null check (price >= 0),
  category    text not null check (category in ('rolls','treats','bakes','holiday')),
  image       text not null default 'studio-rolls.webp',
  tagline     text not null default '',
  description text not null default '',
  badge       text,
  has_frosting_options boolean not null default false,
  in_basket   boolean not null default false,
  active      boolean not null default true,
  sort        int not null default 100,
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null,
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  fulfilment    text not null default 'Pickup',
  address       text,
  pickup_date   date,
  pickup_window text,
  notes         text,
  items         jsonb not null,
  delivery_fee  numeric(10,2) not null default 0,
  total         numeric(10,2) not null,
  status        text not null default 'new' check (status in ('new','confirmed','baking','ready','completed','cancelled'))
);

-- upgrade older installs
alter table public.products add column if not exists in_basket boolean not null default false;
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in ('rolls','treats','bakes','holiday'));
alter table public.orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table public.orders add column if not exists confirmation_sent boolean not null default false;

-- ---------- security ----------
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders   enable row level security;

-- Anyone can read the menu and public settings; only the signed-in owner can change them.
drop policy if exists "menu is public" on public.products;
create policy "menu is public" on public.products for select using (true);
drop policy if exists "owner edits menu" on public.products;
create policy "owner edits menu" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "settings are public" on public.settings;
create policy "settings are public" on public.settings for select using (true);
drop policy if exists "owner edits settings" on public.settings;
create policy "owner edits settings" on public.settings for all to authenticated using (true) with check (true);

-- Customers can place orders; only the owner can read and update them.
drop policy if exists "customers place orders" on public.orders;
create policy "customers place orders" on public.orders for insert to anon, authenticated with check (status = 'new');
drop policy if exists "owner reads orders" on public.orders;
create policy "owner reads orders" on public.orders for select to authenticated using (true);
drop policy if exists "owner updates orders" on public.orders;
create policy "owner updates orders" on public.orders for update to authenticated using (true) with check (true);

-- ---------- live updates ----------
alter table public.products replica identity full;
alter table public.settings replica identity full;
alter table public.orders   replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders;   exception when duplicate_object then null; end;
end $$;

-- ---------- product photos (optional uploads from the dashboard) ----------
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
  on conflict (id) do nothing;
drop policy if exists "photos are public" on storage.objects;
create policy "photos are public" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "owner uploads photos" on storage.objects;
create policy "owner uploads photos" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');

-- ---------- starting settings ----------
insert into public.settings (key, value) values
  ('lead_time_hours', '6'),
  ('accepting_orders', 'true'),
  ('announcement', '"Baked fresh to order. Pickup or delivery."'),
  ('basket_price', '5'),
  ('payment_url', '""'),
  ('basket_capacity', '12'),
  ('prep_tiers', '[{"items":12,"hours":24},{"items":36,"hours":48}]'),
  ('delivery_enabled', 'true'),
  ('delivery_zones', '[{"name":"Ramsey and Anoka","zips":"55303","fee":5},{"name":"Nearby towns","zips":"55304, 55316, 55327, 55330, 55433, 55448","fee":10}]'),
  ('free_delivery_over', '0'),
  ('content', '{}')
on conflict (key) do nothing;

-- ---------- starting menu (from the current site) ----------
insert into public.products (id, name, price, category, image, tagline, description, badge, has_frosting_options, sort) values
  ('vanilla-bean-cinnamon-rolls', 'Vanilla Bean Cinnamon Rolls', 12, 'rolls', 'studio-rolls.webp', 'Soft, frosted and full of comfort', 'A 4-pack of cinnamon rolls with vanilla bean flavoring you can see and taste, baked in an 8 × 8 pan.', 'Bestseller', true, 10),
  ('chocolate-chip-toffee-cookies', 'Chocolate Chip Toffee Cookies', 3, 'treats', 'studio-cookies.webp', 'A little chocolate. A little crunch.', 'Golden-edged cookies loaded with chocolate chips and crunchy toffee bits. Soft in the middle, just how they should be.', 'Fan favorite', false, 20),
  ('mini-french-baguettes', 'Mini French Baguettes', 8, 'bakes', 'studio-bread.webp', 'Golden little loaves for your table', 'Crisp golden crust and a soft, airy centre. Perfect for dinner, sandwiches or tearing and sharing.', 'Bread basket', false, 30),
  ('brown-butter-banana-cake-with-caramel-cream-cheese-frosting', 'Brown Butter Banana Cake', 15, 'bakes', 'studio-cake.webp', 'With caramel cream cheese frosting', 'Moist brown butter banana cake topped with a ribbon of caramel cream cheese frosting.', 'Something sweet', false, 40),
  ('biscoff-cinnamon-rolls', 'Biscoff Cinnamon Rolls', 12, 'rolls', 'menu-14.webp', 'Cookie butter meets a cozy swirl', 'Soft cinnamon rolls with cookie butter frosting and a Biscoff cookie on top.', null, true, 50),
  ('strawberry-cinnamon-rolls', 'Strawberry Cinnamon Rolls', 12, 'rolls', 'studio-strawberry.webp', 'A sweet little berry moment', 'Pink strawberry frosting on our soft, fluffy cinnamon swirl.', null, true, 60),
  ('maple-cinnamon-scones-with-maple-frosting', 'Maple Cinnamon Scones', 15, 'bakes', 'studio-scones.webp', 'Finished with maple frosting', 'Tender cinnamon scones finished with a sweet maple glaze.', null, false, 70),
  ('rice-crispy-bars', 'Rice Crispy Bars', 2, 'treats', 'studio-crispy.webp', 'A little crispy, a little chewy', 'Classic, chewy marshmallow rice crispy bars.', null, false, 80),
  ('pound-cake', 'Pound Cake', 3, 'bakes', 'menu-0.webp', 'Simple homemade sweetness', 'A buttery, tight-crumbed slice of simple homemade pound cake.', null, false, 90),
  ('sandwich-bread', 'Sandwich Bread', 8, 'bakes', 'menu-3.webp', 'For toast, sandwiches and sharing', 'A soft homemade loaf for toast, sandwiches and everything in between.', null, false, 100),
  ('filled-chocolate', 'Filled Chocolate', 6, 'treats', 'menu-4.webp', 'A little chocolate indulgence', 'Filled chocolates — a small treat for you or someone you love.', null, false, 110),
  ('puppy-chow', 'Puppy Chow', 5, 'treats', 'menu-5.webp', 'A sweet snack to share', 'The Midwest classic snack mix — sweet, crunchy and made for sharing.', null, false, 120),
  ('rice-crispy-pan', 'Rice Crispy Pan', 15, 'treats', 'menu-7.webp', 'More crispy happiness to go around', 'A whole pan of rice crispy treats — made for parties and sharing.', null, false, 130),
  ('roasted-marshmallow-pumpkin-spice-cinnamon-roll', 'Roasted Marshmallow Pumpkin Spice Cinnamon Roll', 12, 'rolls', 'menu-10.webp', 'A cozy pumpkin spice bake', 'Pumpkin spice cinnamon rolls topped with toasted marshmallow frosting.', 'Seasonal', true, 140),
  ('lemon-poppyseed-cinnamon-roll', 'Lemon Poppyseed Cinnamon Roll', 12, 'rolls', 'menu-11.webp', 'A bright little twist', 'Bright lemon frosting with poppyseeds on a soft cinnamon swirl.', null, true, 150),
  ('oreo-cinnamon-rolls', 'Oreo Cinnamon Rolls', 12, 'rolls', 'menu-12.webp', 'Cookies and cinnamon, together', 'Cookies-and-cream frosting with Oreo cookies on a soft cinnamon swirl.', null, true, 160),
  ('orange-cinnamon-roll', 'Orange Cinnamon Roll', 12, 'rolls', 'menu-13.webp', 'A cheerful citrus swirl', 'Sunny orange frosting on a soft, buttery cinnamon roll.', null, true, 170),
  ('sprinkles-cinnamon-roll', 'Sprinkles Cinnamon Roll', 12, 'rolls', 'menu-15.webp', 'A sprinkle of celebration', 'Vanilla frosting and rainbow sprinkles — birthday-ready.', null, true, 180),
  ('hazelnut-chocolate-chip-cinnamon-rolls', 'Hazelnut Chocolate Chip Cinnamon Rolls', 12, 'rolls', 'menu-17.webp', 'Chocolate and hazelnut happiness', 'Chocolate hazelnut frosting and chocolate chips on a soft swirl.', null, true, 190)
on conflict (id) do nothing;

-- ---------- holiday basket items (only shown in the basket builder) ----------
insert into public.products (id, name, price, category, image, tagline, description, badge, has_frosting_options, sort) values
  ('vanilla-bean-paste', 'Homemade Vanilla Bean Paste', 14, 'holiday', 'holiday-vanilla.webp', 'Rich, speckled and homemade', 'Real vanilla beans in a thick, spoonable paste for baking and drinks.', null, false, 1000),
  ('simmer-pot-mix', 'Simmer Pot Mix', 8, 'holiday', 'holiday-simmer-pot.webp', 'Makes the whole house smell like the holidays', 'Dried citrus, cinnamon, cloves and spices to simmer on the stove.', null, false, 1010),
  ('homemade-caramel', 'Homemade Caramel', 10, 'holiday', 'holiday-caramel.webp', 'Buttery, slow-cooked caramel', 'Silky caramel for drizzling, dipping or eating by the spoon.', null, false, 1020),
  ('infused-olive-oil', 'Infused Olive Oil', 15, 'holiday', 'holiday-olive-oil.webp', 'Herb-infused, for cooking and dipping', 'Olive oil infused with herbs and garlic. Lovely with fresh bread.', null, false, 1030),
  ('infused-honey', 'Infused Honey', 12, 'holiday', 'holiday-honey.webp', 'Golden honey with a gentle twist', 'Local-style honey infused with warm flavors like cinnamon or vanilla.', null, false, 1040)
on conflict (id) do nothing;

-- popular daily bakes also offered inside holiday baskets (owner can change this in the dashboard)
update public.products set in_basket = true where id in ('vanilla-bean-cinnamon-rolls', 'chocolate-chip-toffee-cookies', 'brown-butter-banana-cake-with-caramel-cream-cheese-frosting', 'roasted-marshmallow-pumpkin-spice-cinnamon-roll') and not exists (select 1 from public.settings where key = 'basket_items_seeded');
insert into public.settings (key, value) values ('basket_items_seeded', 'true') on conflict (key) do nothing;
