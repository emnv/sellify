-- SELLIFY CORE (STAND-IN): global device catalog shared by every shop.
-- Shops attach their own repair and buyback prices to these models.

insert into public.device_brands (name, sort_order) values
  ('Apple', 1),
  ('Samsung', 2),
  ('Google', 3);

insert into public.device_models (brand_id, name, storage_options, release_year, sort_order)
select b.id, m.name, m.storage, m.year, m.sort
from (values
  ('Apple', 'iPhone 11',          array[64, 128, 256],             2019, 10),
  ('Apple', 'iPhone 12',          array[64, 128, 256],             2020, 20),
  ('Apple', 'iPhone 12 Pro',      array[128, 256, 512],            2020, 21),
  ('Apple', 'iPhone 13',          array[128, 256, 512],            2021, 30),
  ('Apple', 'iPhone 13 Pro',      array[128, 256, 512, 1024],      2021, 31),
  ('Apple', 'iPhone 14',          array[128, 256, 512],            2022, 40),
  ('Apple', 'iPhone 14 Pro',      array[128, 256, 512, 1024],      2022, 41),
  ('Apple', 'iPhone 15',          array[128, 256, 512],            2023, 50),
  ('Apple', 'iPhone 15 Pro',      array[128, 256, 512, 1024],      2023, 51),
  ('Apple', 'iPhone 16',          array[128, 256, 512],            2024, 60),
  ('Apple', 'iPhone 16 Pro',      array[128, 256, 512, 1024],      2024, 61),
  ('Apple', 'iPhone 17',          array[256, 512],                 2025, 70),
  ('Apple', 'iPhone 17 Pro',      array[256, 512, 1024],           2025, 71),
  ('Samsung', 'Galaxy S21',       array[128, 256],                 2021, 10),
  ('Samsung', 'Galaxy S22',       array[128, 256],                 2022, 20),
  ('Samsung', 'Galaxy S23',       array[128, 256, 512],            2023, 30),
  ('Samsung', 'Galaxy S24',       array[128, 256, 512],            2024, 40),
  ('Samsung', 'Galaxy S25',       array[128, 256, 512],            2025, 50),
  ('Samsung', 'Galaxy A54',       array[128, 256],                 2023, 60),
  ('Samsung', 'Galaxy A55',       array[128, 256],                 2024, 61),
  ('Google', 'Pixel 7',           array[128, 256],                 2022, 10),
  ('Google', 'Pixel 8',           array[128, 256],                 2023, 20),
  ('Google', 'Pixel 9',           array[128, 256],                 2024, 30),
  ('Google', 'Pixel 10',          array[128, 256],                 2025, 40)
) as m(brand, name, storage, year, sort)
join public.device_brands b on b.name = m.brand;

insert into public.repair_types (name, slug, sort_order) values
  ('Screen replacement',  'screen',       1),
  ('Battery replacement', 'battery',      2),
  ('Charging port',       'charging-port', 3),
  ('Back glass',          'back-glass',   4),
  ('Rear camera',         'rear-camera',  5),
  ('Water damage check',  'water-damage', 6);
