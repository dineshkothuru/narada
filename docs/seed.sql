-- Seed: one demo outlet with a realistic Indian menu + 4 tables
-- Idempotent: menu/table data is created only with a new demo outlet; staff
-- accounts are ensured on every run.

do $$
declare
  oid uuid;
  c_starters uuid; c_mains uuid; c_breads uuid; c_biryani uuid; c_desserts uuid; c_drinks uuid;
  staff_seed record;
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

  for staff_seed in
    select * from (values
      ('owner'::text, 'Owner'::text, null::text, 'admin'::text, 'owner-demo-password'::text, 'scrypt$v=1$N=16384,r=8,p=5$Xx8lY9bsyavU64sB2ZRvKQ$AaiRbSSaSjE3ZmdIpSPDBtfO7a38GvbAZZ6kKROVO5E'::text),
      ('kitchen'::text, 'Demo'::text, 'Kitchen'::text, 'kitchen'::text, 'kitchen-demo-password'::text, 'scrypt$v=1$N=16384,r=8,p=5$LaOjIRSMaHnLLSizOQpXKA$IIXtIcdn8QE8MBoAgfR3X5NNX0QGDJEynFu2RoInv_E'::text),
      ('waiter'::text, 'Demo'::text, 'Waiter'::text, 'waiter'::text, 'waiter-demo-password'::text, 'scrypt$v=1$N=16384,r=8,p=5$dAoY9M6EujCDmZ7hFx75cQ$hBrlcQtMcbowq2qPj5ksBN7PgdZTOanXCx7SD243aes'::text),
      ('reception'::text, 'Demo'::text, 'Reception'::text, 'reception'::text, 'reception-demo-password'::text, 'scrypt$v=1$N=16384,r=8,p=5$Xq2Qu8wiLKSFghrazwL1fg$3WAcAGvaDHFg7nnWWgvfw0c-IJcqsZwn2d95Kaq75AA'::text),
      ('cashier'::text, 'Demo'::text, 'Cashier'::text, 'cashier'::text, 'cashier-demo-password'::text, 'scrypt$v=1$N=16384,r=8,p=5$kIcRruN7U5BQ-PJIW2Ixkg$xyk3ShXYYXVycCITnMKA3mBUyGanNx2Y3TtMuDypl_0'::text)
    ) as seed(username, first_name, last_name, role, password, password_hash)
  loop
    update staff
    set username = staff_seed.username,
        first_name = staff_seed.first_name,
        last_name = staff_seed.last_name,
        role = staff_seed.role,
        password_hash = staff_seed.password_hash,
        active = true
    where outlet_id = oid
      and (lower(username) = staff_seed.username
        or (lower(first_name) = lower(staff_seed.first_name) and coalesce(lower(last_name), '') = coalesce(lower(staff_seed.last_name), ''))
        or (staff_seed.last_name is not null and lower(first_name) = lower(staff_seed.first_name || ' ' || staff_seed.last_name))
        or (staff_seed.username = 'owner' and lower(first_name) = 'owner'));
    if not found then
      insert into staff (outlet_id, username, first_name, last_name, role, password_hash)
      values (oid, staff_seed.username, staff_seed.first_name, staff_seed.last_name, staff_seed.role, staff_seed.password_hash);
    end if;
  end loop;
end $$;

-- One local-only customer account for testing phone/password auth.
insert into customers (phone, first_name, last_name, password_hash, active)
values (
  '+919876543210',
  'Demo',
  'Customer',
  'scrypt$v=1$N=16384,r=8,p=5$bmFyYWRhLWN1c3RvbWVyMQ$ltCmkMiF6-qnECgzGv4uLg_SL81uy41jhIOnVh0DKRs',
  true
)
on conflict (phone) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  password_hash = excluded.password_hash,
  active = excluded.active;
