create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  laundry_name text not null check (char_length(laundry_name) between 3 and 120),
  username text unique not null check (char_length(username) between 3 and 60),
  created_at timestamptz not null default now()
);

create table public.laundry_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  received_date date not null,
  laundry_type text not null,
  weight numeric(7,1) not null check (weight > 0 and weight <= 160),
  price integer not null default 0 check (price >= 0),
  picked_up boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.laundry_orders enable row level security;
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own orders" on public.laundry_orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, laundry_name, username) values (new.id, coalesce(new.raw_user_meta_data->>'laundry_name', 'LaundryKu'), lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.get_login_email(login_username text)
returns text language sql security definer set search_path = public as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(login_username)) limit 1;
$$;
revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;
