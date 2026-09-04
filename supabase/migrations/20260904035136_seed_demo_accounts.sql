-- Idempotent documented demo accounts for the Spice Garden outlet.
begin;

do $$
declare
  target_outlet_id uuid;
begin
  select id into target_outlet_id from outlets where slug = 'demo-spice-garden';
  if target_outlet_id is null then
    raise exception 'Cannot seed demo accounts: outlet demo-spice-garden is absent';
  end if;

  insert into staff (outlet_id, username, first_name, last_name, role, password_hash, active)
  values
    (target_outlet_id, 'owner', 'Owner', null, 'admin', 'scrypt$v=1$N=16384,r=8,p=5$Xx8lY9bsyavU64sB2ZRvKQ$AaiRbSSaSjE3ZmdIpSPDBtfO7a38GvbAZZ6kKROVO5E', true),
    (target_outlet_id, 'kitchen', 'Demo', 'Kitchen', 'kitchen', 'scrypt$v=1$N=16384,r=8,p=5$LaOjIRSMaHnLLSizOQpXKA$IIXtIcdn8QE8MBoAgfR3X5NNX0QGDJEynFu2RoInv_E', true),
    (target_outlet_id, 'waiter', 'Demo', 'Waiter', 'waiter', 'scrypt$v=1$N=16384,r=8,p=5$dAoY9M6EujCDmZ7hFx75cQ$hBrlcQtMcbowq2qPj5ksBN7PgdZTOanXCx7SD243aes', true),
    (target_outlet_id, 'reception', 'Demo', 'Reception', 'reception', 'scrypt$v=1$N=16384,r=8,p=5$Xq2Qu8wiLKSFghrazwL1fg$3WAcAGvaDHFg7nnWWgvfw0c-IJcqsZwn2d95Kaq75AA', true),
    (target_outlet_id, 'cashier', 'Demo', 'Cashier', 'cashier', 'scrypt$v=1$N=16384,r=8,p=5$kIcRruN7U5BQ-PJIW2Ixkg$xyk3ShXYYXVycCITnMKA3mBUyGanNx2Y3TtMuDypl_0', true)
  on conflict (outlet_id, username) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    password_hash = excluded.password_hash,
    active = excluded.active;
end $$;

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

commit;
