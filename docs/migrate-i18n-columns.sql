-- Flatten jsonb i18n into per-language columns (the shape lib/menu.ts reads)
-- and give each item its emoji.

alter table menu_items
  add column if not exists name_hi text,
  add column if not exists name_te text,
  add column if not exists description_hi text,
  add column if not exists description_te text,
  add column if not exists emoji text;

alter table menu_categories
  add column if not exists name_hi text,
  add column if not exists name_te text;

update menu_items set
  name_hi        = coalesce(name_hi,        i18n->'hi'->>'name'),
  name_te        = coalesce(name_te,        i18n->'te'->>'name'),
  description_hi = coalesce(description_hi, i18n->'hi'->>'description'),
  description_te = coalesce(description_te, i18n->'te'->>'description');

update menu_categories set
  name_hi = coalesce(name_hi, i18n->'hi'->>'name'),
  name_te = coalesce(name_te, i18n->'te'->>'name');

update menu_items mi set emoji = v.e from (values
  ('Paneer Tikka', '🧀'),
  ('Veg Manchurian', '🥟'),
  ('Chicken 65', '🍗'),
  ('Tandoori Mushroom', '🍄'),
  ('Paneer Butter Masala', '🍛'),
  ('Dal Makhani', '🫘'),
  ('Butter Chicken', '🍗'),
  ('Andhra Chicken Curry', '🌶️'),
  ('Palak Paneer', '🥬'),
  ('Butter Naan', '🫓'),
  ('Garlic Naan', '🧄'),
  ('Tandoori Roti', '🫓'),
  ('Hyderabadi Chicken Biryani', '🍚'),
  ('Veg Dum Biryani', '🍚'),
  ('Jeera Rice', '🍚'),
  ('Gulab Jamun (2 pcs)', '🍮'),
  ('Rasmalai (2 pcs)', '🥛'),
  ('Sweet Lassi', '🥤'),
  ('Masala Chaas', '🥛'),
  ('Fresh Lime Soda', '🍋')
) as v(n, e)
where mi.name = v.n and mi.emoji is null;

-- flat columns are now the single source of truth
alter table menu_items drop column if exists i18n;
alter table menu_categories drop column if exists i18n;
