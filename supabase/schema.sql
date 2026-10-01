-- Production schema for Nolefy Design
create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','super_admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(), section text not null unique,
  title text not null default '', subtitle text not null default '', hero_title text not null default '', hero_subtitle text not null default '', about_title text not null default '', about_text text not null default '', cta_text text not null default '', metadata_title text not null default '', metadata_description text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_services (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null, price numeric(12,2), icon text not null default '', sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_portfolio (
  id uuid primary key default gen_random_uuid(), title text not null, category text not null default '', description text not null default '', image_url text not null default '', project_url text not null default '', sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_contact (
  id uuid primary key default gen_random_uuid(), email text not null default '', phone text not null default '', whatsapp text not null default '', address text not null default '', instagram text not null default '', facebook text not null default '', linkedin text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, action text not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists site_services_order_idx on public.site_services(sort_order);
create index if not exists site_portfolio_order_idx on public.site_portfolio(sort_order);
create index if not exists admin_activity_created_idx on public.admin_activity(created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid()); $$;
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'site_content_updated') then create trigger site_content_updated before update on public.site_content for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'site_services_updated') then create trigger site_services_updated before update on public.site_services for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'site_portfolio_updated') then create trigger site_portfolio_updated before update on public.site_portfolio for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'site_contact_updated') then create trigger site_contact_updated before update on public.site_contact for each row execute function public.touch_updated_at(); end if;
end $$;

alter table public.admins enable row level security;
alter table public.site_content enable row level security;
alter table public.site_services enable row level security;
alter table public.site_portfolio enable row level security;
alter table public.site_contact enable row level security;
alter table public.admin_activity enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (auth.uid() = user_id);
drop policy if exists public_content_read on public.site_content;
create policy public_content_read on public.site_content for select using (true);
drop policy if exists public_services_read on public.site_services;
create policy public_services_read on public.site_services for select using (is_active or public.is_admin());
drop policy if exists public_portfolio_read on public.site_portfolio;
create policy public_portfolio_read on public.site_portfolio for select using (is_active or public.is_admin());
drop policy if exists public_contact_read on public.site_contact;
create policy public_contact_read on public.site_contact for select using (true);

create policy content_admin_write on public.site_content for all using (public.is_admin()) with check (public.is_admin());
create policy services_admin_write on public.site_services for all using (public.is_admin()) with check (public.is_admin());
create policy portfolio_admin_write on public.site_portfolio for all using (public.is_admin()) with check (public.is_admin());
create policy contact_admin_write on public.site_contact for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_insert on public.admin_activity for insert with check (public.is_admin() and user_id = auth.uid());
create policy audit_admin_read on public.admin_activity for select using (exists(select 1 from public.admins where user_id = auth.uid() and role = 'super_admin'));

insert into public.site_content(section, title, subtitle, hero_title, hero_subtitle, about_title, about_text, cta_text, metadata_title, metadata_description)
values ('home','O que fazemos','Estúdio criativo','Design que marca.','Identidade visual, materiais gráficos, social media e experiências digitais criadas para transformar ideias em marcas memoráveis.','Ideias fortes. Visual forte.','A Nolefy Design ajuda empresas, profissionais e projetos a se apresentarem melhor através do design.','Solicitar orçamento','Nolefy Design — Design que marca.','Identidade visual, logotipos, fachadas, social media, materiais gráficos e sites.')
on conflict (section) do nothing;

insert into public.site_contact(email, phone, whatsapp) values ('', '', '5538991177228') on conflict do nothing;

insert into storage.buckets(id, name, public) values ('site-assets','site-assets',true) on conflict (id) do nothing;
drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select using (bucket_id = 'site-assets');
drop policy if exists site_assets_admin_insert on storage.objects;
create policy site_assets_admin_insert on storage.objects for insert with check (bucket_id = 'site-assets' and public.is_admin());
drop policy if exists site_assets_admin_delete on storage.objects;
create policy site_assets_admin_delete on storage.objects for delete using (bucket_id = 'site-assets' and public.is_admin());
