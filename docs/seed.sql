-- Seed: one demo restaurant with a realistic Indian menu + 4 tables
-- Idempotent-ish: skips if the restaurant slug already exists.

do $$
declare
  rid uuid;
  c_starters uuid; c_mains uuid; c_breads uuid; c_biryani uuid; c_desserts uuid; c_drinks uuid;
begin
  if exists (select 1 from restaurants where slug = 'demo-spice-garden') then
    raise notice 'seed already applied, skipping';
    return;
  end if;

  insert into restaurants (name, slug, upi_vpa)
  values ('Spice Garden', 'demo-spice-garden', 'demo@upi')
  returning id into rid;

  insert into tables (restaurant_id, label, code) values
    (rid, 'Table 1', 't1-demo'),
    (rid, 'Table 2', 't2-demo'),
    (rid, 'Table 3', 't3-demo'),
    (rid, 'Table 4', 't4-demo');

  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Starters', '🍢', 1) returning id into c_starters;
  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Main Course', '🍛', 2) returning id into c_mains;
  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Breads', '🫓', 3) returning id into c_breads;
  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Biryani & Rice', '🍚', 4) returning id into c_biryani;
  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Desserts', '🍮', 5) returning id into c_desserts;
  insert into menu_categories (restaurant_id, name, emoji, sort_order) values
    (rid, 'Drinks', '🥤', 6) returning id into c_drinks;

  insert into menu_items (restaurant_id, category_id, name, description, price_inr, is_veg, spice_level, allergens, tags, sort_order) values
    -- Starters
    (rid, c_starters, 'Paneer Tikka', 'Char-grilled cottage cheese cubes marinated in yogurt, ginger-garlic and kasuri methi, served with mint chutney.', 280, true, 2, '{dairy}', '{bestseller}', 1),
    (rid, c_starters, 'Veg Manchurian', 'Crispy vegetable dumplings tossed in a garlicky Indo-Chinese sauce.', 240, true, 2, '{soy,gluten}', '{}', 2),
    (rid, c_starters, 'Chicken 65', 'Deep-fried chicken bites with curry leaves, dried red chilli and a hint of ginger.', 320, false, 3, '{}', '{bestseller,spicy}', 3),
    (rid, c_starters, 'Tandoori Mushroom', 'Button mushrooms in smoky tandoori masala, finished with chaat masala.', 260, true, 1, '{dairy}', '{}', 4),
    -- Mains
    (rid, c_mains, 'Paneer Butter Masala', 'Cottage cheese simmered in a silky tomato-cashew gravy with butter and cream. Mildly sweet.', 320, true, 1, '{dairy,nuts}', '{bestseller}', 1),
    (rid, c_mains, 'Dal Makhani', 'Black lentils slow-cooked overnight with butter and cream.', 280, true, 0, '{dairy}', '{chef-special}', 2),
    (rid, c_mains, 'Butter Chicken', 'Tandoor-smoked chicken in a rich tomato-butter gravy. Our signature.', 380, false, 1, '{dairy,nuts}', '{bestseller}', 3),
    (rid, c_mains, 'Andhra Chicken Curry', 'Fiery country-style chicken curry with guntur chillies. Properly hot.', 360, false, 3, '{}', '{spicy}', 4),
    (rid, c_mains, 'Palak Paneer', 'Fresh spinach purée with soft paneer cubes and a touch of garlic.', 300, true, 1, '{dairy}', '{}', 5),
    -- Breads
    (rid, c_breads, 'Butter Naan', 'Tandoor-baked, brushed with butter.', 60, true, 0, '{gluten,dairy}', '{}', 1),
    (rid, c_breads, 'Garlic Naan', 'Naan topped with garlic and coriander.', 75, true, 0, '{gluten,dairy}', '{bestseller}', 2),
    (rid, c_breads, 'Tandoori Roti', 'Whole-wheat, baked in the tandoor.', 40, true, 0, '{gluten}', '{}', 3),
    -- Biryani & Rice
    (rid, c_biryani, 'Hyderabadi Chicken Biryani', 'Dum-cooked basmati layered with marinated chicken, saffron and fried onions. Served with raita and salan.', 380, false, 2, '{dairy}', '{bestseller,chef-special}', 1),
    (rid, c_biryani, 'Veg Dum Biryani', 'Seasonal vegetables and basmati dum-cooked with mint and saffron.', 300, true, 2, '{dairy}', '{}', 2),
    (rid, c_biryani, 'Jeera Rice', 'Basmati tempered with cumin and ghee.', 180, true, 0, '{dairy}', '{}', 3),
    -- Desserts
    (rid, c_desserts, 'Gulab Jamun (2 pcs)', 'Soft khoya dumplings soaked in cardamom-rose syrup. Served warm.', 120, true, 0, '{dairy,gluten}', '{bestseller}', 1),
    (rid, c_desserts, 'Rasmalai (2 pcs)', 'Chenna discs in chilled saffron-pistachio milk.', 140, true, 0, '{dairy,nuts}', '{}', 2),
    -- Drinks
    (rid, c_drinks, 'Sweet Lassi', 'Thick churned yogurt, lightly sweetened.', 90, true, 0, '{dairy}', '{}', 1),
    (rid, c_drinks, 'Masala Chaas', 'Spiced buttermilk with roasted cumin and coriander.', 70, true, 1, '{dairy}', '{}', 2),
    (rid, c_drinks, 'Fresh Lime Soda', 'Sweet, salted, or mixed.', 80, true, 0, '{}', '{}', 3);
end $$;
