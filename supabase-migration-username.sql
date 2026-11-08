-- Jalankan sekali untuk project Supabase yang sudah dibuat sebelumnya.
alter table public.profiles add column if not exists username text;
update public.profiles set username = lower(regexp_replace(laundry_name, '[^a-zA-Z0-9]+', '-', 'g')) where username is null;
alter table public.profiles alter column username set not null;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, laundry_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'laundry_name', 'LaundryKu'),
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  );
  return new;
end;
$$;

create or replace function public.get_login_email(login_username text)
returns text language sql security definer set search_path = public as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(login_username)) limit 1;
$$;
revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;
