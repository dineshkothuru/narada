-- Outlet QR Ordering — Supabase schema
-- Applied via Supabase Management API / SQL editor.

create extension if not exists "pgcrypto";

-- One row per outlet (multi-tenant ready, single tenant to start)
create table if not exists outlets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  upi_vpa     text,                       -- for upi:// deep-link payments
  currency    text not null default 'INR',
  tables_enabled boolean not null default false,
  -- admin setting: 'post' = order fires first, pay at the end (default; leaves
  -- room to engage the customer between order and bill); 'pre' = pay to order
  payment_timing text not null default 'post' check (payment_timing in ('pre','post')),
  active        boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Physical tables in the outlet; QR encodes /t/<table.code>
create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  label         text not null,            -- "Table 12"
  code          text not null unique,     -- short random slug in the QR URL
  created_at    timestamptz not null default now()
);

create table if not exists menu_categories (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  name          text not null,
  emoji         text,
  sort_order    int not null default 0
);

create table if not exists menu_items (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  category_id   uuid not null references menu_categories(id) on delete cascade,
  name          text not null,
  description   text,
  price_inr     numeric(10,2) not null,
  is_veg        boolean not null default true,
  spice_level   int not null default 0 check (spice_level between 0 and 3),
  allergens     text[] not null default '{}',
  tags          text[] not null default '{}',   -- "bestseller", "chef-special"
  image_url     text,
  is_available  boolean not null default true,
  sort_order    int not null default 0
);

-- Optional customer account. Ordering remains guest-capable; this identity is
-- only attached to visits created while the account cookie is present.
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique
                check (phone ~ '^\+[0-9]{8,15}$'),
  first_name    text not null
                check (first_name = btrim(first_name) and char_length(first_name) between 1 and 60),
  last_name     text
                check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60)),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- A dining session: created on QR scan, holds the running tab for that table visit
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid references tables(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,
  service_type  text not null default 'dine_in'
                check (service_type in ('dine_in','takeaway')),
  status        text not null default 'active'   -- active | billed | closed
                check (status in ('active','billed','closed')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

-- One order = one round fired to the kitchen (a session can have many)
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  status        text not null default 'placed'   -- placed | preparing | served | cancelled
                check (status in ('placed','preparing','served','cancelled')),
  total_inr     numeric(10,2) not null default 0,
  placed_via    text not null default 'ui'       -- ui | anna | waiter
                check (placed_via in ('ui','anna','waiter')),
  created_at    timestamptz not null default now()
);

create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  name         text not null,               -- denormalized: menu edits must not rewrite history
  unit_price   numeric(10,2) not null,
  qty          int not null check (qty > 0),
  notes        text,                         -- "less spicy", "no onion"
  status       text not null default 'queued'
               check (status in ('queued','preparing','ready','served','cancelled')),
  cancelled_at timestamptz,
  cancelled_by text
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  amount_inr  numeric(10,2) not null,
  method      text not null default 'upi_intent'
              check (method in ('upi_intent','cash','card')),
  status      text not null default 'pending'
              check (status in ('pending','confirmed','failed')),
  reference   text,                                 -- gateway payment id / staff note
  created_at  timestamptz not null default now()
);

create index if not exists idx_menu_items_outlet on menu_items(outlet_id, category_id, sort_order);
create index if not exists idx_orders_session on orders(session_id);
create index if not exists idx_sessions_table on sessions(table_id) where status = 'active';
create index if not exists idx_sessions_outlet on sessions(outlet_id, status, created_at desc);
-- Row Level Security: the browser uses the API only. Keep RLS enabled and do
-- not grant anon/authenticated direct table access.
alter table outlets          enable row level security;
alter table tables          enable row level security;
alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table customers       enable row level security;
alter table sessions        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;

-- Kitchen dashboard live updates
alter publication supabase_realtime add table orders;

-- ============================================================
-- v2 additions (applied to the live project; needed for fresh installs)
-- ============================================================

alter table outlets
  add column if not exists tables_enabled boolean not null default false,
  add column if not exists payment_timing text not null default 'post'
    check (payment_timing in ('pre','post')),
  add column if not exists gemini_api_key text,
  add column if not exists sarvam_api_key text,
  add column if not exists comp_item_id uuid references menu_items(id);

alter table menu_categories
  add column if not exists name_hi text,
  add column if not exists name_te text;

alter table menu_items
  add column if not exists name_hi text,
  add column if not exists name_te text,
  add column if not exists description_hi text,
  add column if not exists description_te text,
  add column if not exists emoji text;

alter table sessions
  add column if not exists service_type text not null default 'dine_in'
    check (service_type in ('dine_in','takeaway')),
  add column if not exists discount_pct int not null default 0
    check (discount_pct between 0 and 50),
  add column if not exists comp_awarded boolean not null default false;

alter table sessions drop constraint if exists sessions_service_type_table_check;
alter table sessions add constraint sessions_service_type_table_check
  check ((service_type = 'dine_in' and table_id is not null)
      or (service_type = 'takeaway' and table_id is null));

alter table orders add column if not exists placed_by text;

alter table order_items add column if not exists status text not null default 'queued'
  check (status in ('queued','preparing','served'));

create table if not exists waiter_calls (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references tables(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  status        text not null default 'open' check (status in ('open','done')),
  created_at    timestamptz not null default now()
);
alter table waiter_calls enable row level security;
create index if not exists idx_waiter_calls_open on waiter_calls(table_id) where status = 'open';

create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  username      text not null check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  first_name    text not null check (first_name = btrim(first_name) and char_length(first_name) between 1 and 60),
  last_name     text check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60)),
  role          text not null check (role in ('admin','kitchen','waiter','reception','cashier')),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table staff enable row level security;
create unique index if not exists idx_staff_username on staff(outlet_id, username);

-- one active session per table (order/reward races resolve on this)
create unique index if not exists uniq_active_session_per_table
  on sessions(table_id) where status = 'active';

-- ============================================================
-- v3 additions (live columns; see docs/migrate-live-columns.sql for the
-- migration that brings a pre-existing DB up to this shape)
-- ============================================================

alter table outlets
  add column if not exists service_charge_pct numeric(5,2) not null default 0,
  add column if not exists gstin text,
  add column if not exists bill_seq int not null default 0; -- monotonic invoice counter

alter table tables
  add column if not exists ui_variant text not null default 'classic'
    check (ui_variant in ('classic','stories')),
  add column if not exists capacity int not null default 4,
  add column if not exists zone text,
  add column if not exists needs_cleaning boolean not null default false;

alter table menu_categories
  add column if not exists kind text not null default 'food'
    check (kind in ('food','drink'));

alter table menu_items
  add column if not exists gst_pct numeric(5,2) not null default 5;

alter table sessions
  add column if not exists guests int,
  add column if not exists attendant text,             -- waiter who claimed the table
  add column if not exists merged_into uuid references sessions(id),
  add column if not exists service_waived boolean not null default false,
  add column if not exists bill_no text,                -- minted once, at bill time
  add column if not exists bill_gross numeric(10,2),
  add column if not exists bill_discount numeric(10,2),
  add column if not exists bill_gst numeric(10,2),
  add column if not exists bill_service numeric(10,2),
  add column if not exists bill_tip numeric(10,2),
  add column if not exists bill_net numeric(10,2),
  add column if not exists tip_to text,                 -- attendant frozen at bill time
  add column if not exists settled_at timestamptz;

alter table orders
  add column if not exists lang text; -- en | hi | te

alter table order_items
  add column if not exists gst_pct numeric(5,2) not null default 5; -- frozen from the menu item

alter table waiter_calls
  add column if not exists acked_at timestamptz,
  add column if not exists acked_by text;

-- kitchen/waiter screens move orders and order_items through a 'ready' state
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed','preparing','ready','served','cancelled'));

alter table order_items drop constraint if exists order_items_status_check;
alter table order_items add constraint order_items_status_check
  check (status in ('queued','preparing','ready','served','cancelled'));

alter table orders drop constraint if exists orders_placed_via_check;
alter table orders add constraint orders_placed_via_check
  check (placed_via in ('ui','anna','waiter'));

alter table order_items
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

-- Audit events are outlet-owned so a staff member can never inspect another
-- outlet's operational history through a shared database connection.
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references outlets(id) on delete cascade,
  staff_id    uuid references staff(id) on delete set null,
  role        text,
  actor_name  text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
alter table audit_log enable row level security;
create index if not exists idx_audit_log_outlet_created
  on audit_log(outlet_id, created_at desc);

-- No anon/authenticated grants: all application reads and writes go through
-- the API's privileged database connection.

-- Dish photos live in a public Supabase Storage bucket named "menu";
-- menu_items.image_url points at the public object URL. Create it once with:
--   POST /storage/v1/bucket {"id":"menu","public":true,
--     "file_size_limit":5242880,
--     "allowed_mime_types":["image/jpeg","image/png","image/webp","image/avif"]}

begin;

-- Seed: one demo outlet with a realistic Indian menu + 4 tables.
-- Idempotent: menu/table data is created only with a new demo outlet.

do $$
declare
  oid uuid;
  c_starters uuid; c_mains uuid; c_breads uuid; c_biryani uuid; c_desserts uuid; c_drinks uuid;
begin
  select id into oid from outlets where slug = 'demo-spice-garden';

  if oid is null then
    insert into outlets (name, slug, upi_vpa, tables_enabled)
    values ('Spice Garden', 'demo-spice-garden', 'demo@upi', true)
    returning id into oid;

    insert into tables (outlet_id, label, code) values
      (oid, 'Table 1', 't1-demo'),
      (oid, 'Table 2', 't2-demo'),
      (oid, 'Table 3', 't3-demo'),
      (oid, 'Table 4', 't4-demo');

    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Starters', '🍢', 1) returning id into c_starters;
    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Main Course', '🍛', 2) returning id into c_mains;
    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Breads', '🫓', 3) returning id into c_breads;
    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Biryani & Rice', '🍚', 4) returning id into c_biryani;
    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Desserts', '🍮', 5) returning id into c_desserts;
    insert into menu_categories (outlet_id, name, emoji, sort_order) values
      (oid, 'Drinks', '🥤', 6) returning id into c_drinks;

    insert into menu_items (outlet_id, category_id, name, description, price_inr, is_veg, spice_level, allergens, tags, sort_order) values
    -- Starters
    (oid, c_starters, 'Paneer Tikka', 'Char-grilled cottage cheese cubes marinated in yogurt, ginger-garlic and kasuri methi, served with mint chutney.', 280, true, 2, '{dairy}', '{bestseller}', 1),
    (oid, c_starters, 'Veg Manchurian', 'Crispy vegetable dumplings tossed in a garlicky Indo-Chinese sauce.', 240, true, 2, '{soy,gluten}', '{}', 2),
    (oid, c_starters, 'Chicken 65', 'Deep-fried chicken bites with curry leaves, dried red chilli and a hint of ginger.', 320, false, 3, '{}', '{bestseller,spicy}', 3),
    (oid, c_starters, 'Tandoori Mushroom', 'Button mushrooms in smoky tandoori masala, finished with chaat masala.', 260, true, 1, '{dairy}', '{}', 4),
    -- Mains
    (oid, c_mains, 'Paneer Butter Masala', 'Cottage cheese simmered in a silky tomato-cashew gravy with butter and cream. Mildly sweet.', 320, true, 1, '{dairy,nuts}', '{bestseller}', 1),
    (oid, c_mains, 'Dal Makhani', 'Black lentils slow-cooked overnight with butter and cream.', 280, true, 0, '{dairy}', '{chef-special}', 2),
    (oid, c_mains, 'Butter Chicken', 'Tandoor-smoked chicken in a rich tomato-butter gravy. Our signature.', 380, false, 1, '{dairy,nuts}', '{bestseller}', 3),
    (oid, c_mains, 'Andhra Chicken Curry', 'Fiery country-style chicken curry with guntur chillies. Properly hot.', 360, false, 3, '{}', '{spicy}', 4),
    (oid, c_mains, 'Palak Paneer', 'Fresh spinach purée with soft paneer cubes and a touch of garlic.', 300, true, 1, '{dairy}', '{}', 5),
    -- Breads
    (oid, c_breads, 'Butter Naan', 'Tandoor-baked, brushed with butter.', 60, true, 0, '{gluten,dairy}', '{}', 1),
    (oid, c_breads, 'Garlic Naan', 'Naan topped with garlic and coriander.', 75, true, 0, '{gluten,dairy}', '{bestseller}', 2),
    (oid, c_breads, 'Tandoori Roti', 'Whole-wheat, baked in the tandoor.', 40, true, 0, '{gluten}', '{}', 3),
    -- Biryani & Rice
    (oid, c_biryani, 'Hyderabadi Chicken Biryani', 'Dum-cooked basmati layered with marinated chicken, saffron and fried onions. Served with raita and salan.', 380, false, 2, '{dairy}', '{bestseller,chef-special}', 1),
    (oid, c_biryani, 'Veg Dum Biryani', 'Seasonal vegetables and basmati dum-cooked with mint and saffron.', 300, true, 2, '{dairy}', '{}', 2),
    (oid, c_biryani, 'Jeera Rice', 'Basmati tempered with cumin and ghee.', 180, true, 0, '{dairy}', '{}', 3),
    -- Desserts
    (oid, c_desserts, 'Gulab Jamun (2 pcs)', 'Soft khoya dumplings soaked in cardamom-rose syrup. Served warm.', 120, true, 0, '{dairy,gluten}', '{bestseller}', 1),
    (oid, c_desserts, 'Rasmalai (2 pcs)', 'Chenna discs in chilled saffron-pistachio milk.', 140, true, 0, '{dairy,nuts}', '{}', 2),
    -- Drinks
    (oid, c_drinks, 'Sweet Lassi', 'Thick churned yogurt, lightly sweetened.', 90, true, 0, '{dairy}', '{}', 1),
    (oid, c_drinks, 'Masala Chaas', 'Spiced buttermilk with roasted cumin and coriander.', 70, true, 1, '{dairy}', '{}', 2),
      (oid, c_drinks, 'Fresh Lime Soda', 'Sweet, salted, or mixed.', 80, true, 0, '{}', '{}', 3);
  end if;

end $$;


commit;

-- Multilingual menu content (Hindi + Telugu) and per-item emoji.
-- Menu text is admin data: the app renders name/description in the customer's
-- language, falling back to English when a translation is missing.

alter table menu_categories
  add column if not exists name_hi text,
  add column if not exists name_te text;

alter table menu_items
  add column if not exists name_hi text,
  add column if not exists name_te text,
  add column if not exists description_hi text,
  add column if not exists description_te text,
  add column if not exists emoji text;

update menu_categories c set name_hi = v.hi, name_te = v.te
from (values
  ('Starters', 'स्टार्टर्स', 'స్టార్టర్స్'),
  ('Main Course', 'मुख्य व्यंजन', 'మెయిన్ కోర్స్'),
  ('Breads', 'रोटियाँ', 'రొట్టెలు'),
  ('Biryani & Rice', 'बिरयानी और चावल', 'బిర్యానీ & రైస్'),
  ('Desserts', 'मिठाइयाँ', 'డెజర్ట్స్'),
  ('Drinks', 'पेय', 'పానీయాలు')
) as v(name, hi, te)
where c.name = v.name;

update menu_items m set
  name_hi = v.name_hi, name_te = v.name_te,
  description_hi = v.desc_hi, description_te = v.desc_te,
  emoji = v.emoji
from (values
  ('Paneer Tikka', 'पनीर टिक्का', 'పనీర్ టిక్కా',
   'दही, अदरक-लहसुन और कसूरी मेथी में मैरीनेट किए तंदूरी पनीर के टुकड़े, पुदीने की चटनी के साथ।',
   'పెరుగు, అల్లం-వెల్లుల్లి, కసూరి మేతిలో ఊరబెట్టి కాల్చిన పనీర్ ముక్కలు, పుదీనా చట్నీతో.', '🧀'),
  ('Veg Manchurian', 'वेज मंचूरियन', 'వెజ్ మంచూరియా',
   'कुरकुरे सब्ज़ी के पकौड़े, लहसुनी इंडो-चाइनीज़ सॉस में।',
   'కరకరలాడే కూరగాయల బాల్స్, వెల్లుల్లి ఇండో-చైనీస్ సాస్‌లో.', '🥟'),
  ('Chicken 65', 'चिकन 65', 'చికెన్ 65',
   'करी पत्ता, सूखी लाल मिर्च और अदरक के साथ तले हुए चिकन के टुकड़े।',
   'కరివేపాకు, ఎండు మిర్చి, అల్లంతో వేయించిన చికెన్ ముక్కలు.', '🍗'),
  ('Tandoori Mushroom', 'तंदूरी मशरूम', 'తందూరీ మష్రూమ్',
   'धुएँदार तंदूरी मसाले में मशरूम, चाट मसाले के साथ।',
   'పొగబెట్టిన తందూరీ మసాలాలో మష్రూమ్స్, చాట్ మసాలాతో.', '🍄'),
  ('Paneer Butter Masala', 'पनीर बटर मसाला', 'పనీర్ బటర్ మసాలా',
   'मक्खन-क्रीम वाली टमाटर-काजू ग्रेवी में पनीर। हल्का मीठा।',
   'వెన్న-క్రీమ్ టమోటా-జీడిపప్పు గ్రేవీలో పనీర్. కాస్త తీపి.', '🍛'),
  ('Dal Makhani', 'दाल मखनी', 'దాల్ మఖనీ',
   'रात भर धीमी आँच पर पकी काली दाल, मक्खन और क्रीम के साथ।',
   'రాత్రంతా నెమ్మదిగా ఉడికించిన నల్ల పప్పు, వెన్న-క్రీమ్‌తో.', '🫘'),
  ('Butter Chicken', 'बटर चिकन', 'బటర్ చికెన్',
   'तंदूर का धुएँदार चिकन, गाढ़ी टमाटर-मक्खन ग्रेवी में। हमारी खासियत।',
   'తందూరీ పొగ రుచి చికెన్, టమోటా-వెన్న గ్రేవీలో. మా సిగ్నేచర్.', '🍗'),
  ('Andhra Chicken Curry', 'आंध्रा चिकन करी', 'ఆంధ్రా కోడి కూర',
   'गुंटूर मिर्च वाली तीखी देसी चिकन करी। सच में तीखी।',
   'గుంటూరు మిర్చితో ఘాటైన నాటు కోడి కూర. నిజంగా కారం.', '🌶️'),
  ('Palak Paneer', 'पालक पनीर', 'పాలక్ పనీర్',
   'ताज़ी पालक की प्यूरी में नरम पनीर, हल्के लहसुन के साथ।',
   'తాజా పాలకూర ప్యూరీలో మెత్తని పనీర్, కొద్దిగా వెల్లుల్లితో.', '🥬'),
  ('Butter Naan', 'बटर नान', 'బటర్ నాన్',
   'तंदूर में बेक, मक्खन लगा।', 'తందూర్లో కాల్చి, వెన్న రాసినది.', '🫓'),
  ('Garlic Naan', 'गार्लिक नान', 'గార్లిక్ నాన్',
   'लहसुन-धनिया वाला नान।', 'వెల్లుల్లి-కొత్తిమీరతో నాన్.', '🧄'),
  ('Tandoori Roti', 'तंदूरी रोटी', 'తందూరీ రోటీ',
   'गेहूँ की, तंदूर में सिकी।', 'గోధుమతో, తందూర్లో కాల్చినది.', '🫓'),
  ('Hyderabadi Chicken Biryani', 'हैदराबादी चिकन बिरयानी', 'హైదరాబాదీ చికెన్ బిర్యానీ',
   'दम बासमती, मैरीनेट चिकन, केसर और तली प्याज़; रायता-सालन के साथ।',
   'దమ్ బాస్మతి, మ్యారినేట్ చికెన్, కుంకుమపువ్వు, వేయించిన ఉల్లిపాయలతో; రైతా-సాలన్‌తో.', '🍚'),
  ('Veg Dum Biryani', 'वेज दम बिरयानी', 'వెజ్ దమ్ బిర్యానీ',
   'मौसमी सब्ज़ियाँ और बासमती, पुदीना-केसर के साथ दम।',
   'సీజనల్ కూరగాయలు, బాస్మతి — పుదీనా, కుంకుమపువ్వుతో దమ్.', '🍚'),
  ('Jeera Rice', 'जीरा राइस', 'జీరా రైస్',
   'जीरे-घी का तड़का लगा बासमती।', 'జీలకర్ర-నెయ్యి తాలింపుతో బాస్మతి.', '🍚'),
  ('Gulab Jamun (2 pcs)', 'गुलाब जामुन (2 पीस)', 'గులాబ్ జామూన్ (2)',
   'इलायची-गुलाब की चाशनी में खोये के गुलाब जामुन। गर्म परोसे।',
   'ఏలకులు-గులాబీ పాకంలో ఖోవా జామూన్లు. వేడిగా.', '🍮'),
  ('Rasmalai (2 pcs)', 'रसमलाई (2 पीस)', 'రస్మలై (2)',
   'केसर-पिस्ता दूध में छैना, ठंडी।', 'కుంకుమపువ్వు-పిస్తా పాలలో చెన్నా, చల్లగా.', '🥛'),
  ('Sweet Lassi', 'मीठी लस्सी', 'స్వీట్ లస్సీ',
   'गाढ़ा मीठा दही शेक।', 'చిక్కని తీపి పెరుగు లస్సీ.', '🥤'),
  ('Masala Chaas', 'मसाला छाछ', 'మసాలా మజ్జిగ',
   'भुना जीरा-धनिया वाली छाछ।', 'వేయించిన జీలకర్ర-కొత్తిమీరతో మజ్జిగ.', '🥛'),
  ('Fresh Lime Soda', 'फ्रेश लाइम सोडा', 'ఫ్రెష్ లైమ్ సోడా',
   'मीठा, नमकीन या मिक्स।', 'తీపి, ఉప్పు లేదా మిక్స్.', '🍋')
) as v(name, name_hi, name_te, desc_hi, desc_te, emoji)
where m.name = v.name;

-- Foreign-key indexes recommended by Supabase database advisors.
create index if not exists idx_tables_outlet on tables(outlet_id);
create index if not exists idx_menu_categories_outlet on menu_categories(outlet_id);
create index if not exists idx_menu_items_category on menu_items(category_id);
create index if not exists idx_sessions_customer on sessions(customer_id);
create index if not exists idx_orders_outlet on orders(outlet_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_menu_item on order_items(menu_item_id);
create index if not exists idx_payments_session on payments(session_id);
create index if not exists idx_outlets_comp_item on outlets(comp_item_id);
create index if not exists idx_waiter_calls_outlet on waiter_calls(outlet_id);
create index if not exists idx_sessions_merged_into on sessions(merged_into);
create index if not exists idx_audit_log_staff on audit_log(staff_id);
