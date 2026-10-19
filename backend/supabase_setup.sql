-- Aurevia: run once in Supabase > SQL Editor > New query > Run.
-- Creates the backend's tables and locks them away from Supabase's public Data API.
-- Safe to run more than once. The backend connects as the table owner, so RLS doesn't affect it.

create table if not exists public.docs_users (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_users_gin on public.docs_users using gin (doc jsonb_path_ops);
alter table public.docs_users enable row level security;

create table if not exists public.docs_password_reset_tokens (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_password_reset_tokens_gin on public.docs_password_reset_tokens using gin (doc jsonb_path_ops);
alter table public.docs_password_reset_tokens enable row level security;

create table if not exists public.docs_login_attempts (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_login_attempts_gin on public.docs_login_attempts using gin (doc jsonb_path_ops);
alter table public.docs_login_attempts enable row level security;

create table if not exists public.docs_newsletter (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_newsletter_gin on public.docs_newsletter using gin (doc jsonb_path_ops);
alter table public.docs_newsletter enable row level security;

create table if not exists public.docs_contacts (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_contacts_gin on public.docs_contacts using gin (doc jsonb_path_ops);
alter table public.docs_contacts enable row level security;

create table if not exists public.docs_settings (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_settings_gin on public.docs_settings using gin (doc jsonb_path_ops);
alter table public.docs_settings enable row level security;

create table if not exists public.docs_products (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_products_gin on public.docs_products using gin (doc jsonb_path_ops);
alter table public.docs_products enable row level security;

create table if not exists public.docs_orders (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_orders_gin on public.docs_orders using gin (doc jsonb_path_ops);
alter table public.docs_orders enable row level security;

create table if not exists public.docs_categories (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_categories_gin on public.docs_categories using gin (doc jsonb_path_ops);
alter table public.docs_categories enable row level security;

create table if not exists public.docs_slides (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_slides_gin on public.docs_slides using gin (doc jsonb_path_ops);
alter table public.docs_slides enable row level security;

create table if not exists public.docs_offers (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_offers_gin on public.docs_offers using gin (doc jsonb_path_ops);
alter table public.docs_offers enable row level security;

create table if not exists public.docs_reviews (pk bigserial primary key, doc jsonb not null);
create index if not exists docs_reviews_gin on public.docs_reviews using gin (doc jsonb_path_ops);
alter table public.docs_reviews enable row level security;

-- Uniqueness the shop relies on
create unique index if not exists docs_users_email_idx on public.docs_users ((doc->>'email'));
create unique index if not exists docs_newsletter_email_idx on public.docs_newsletter ((doc->>'email'));
create unique index if not exists docs_products_id_idx on public.docs_products ((doc->>'id'));
create unique index if not exists docs_orders_id_idx on public.docs_orders ((doc->>'id'));
create unique index if not exists docs_orders_number_idx on public.docs_orders ((doc->>'number'));

-- Check: every row should show rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'docs_%' order by 1;
