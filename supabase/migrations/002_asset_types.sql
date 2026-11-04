-- Tipos de activo (definidos por el usuario) para los gráficos de reparto.
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega este archivo → Run.
-- Una sola vez, en la base de datos creada con supabase/schema.sql antes de este cambio.
-- (Un proyecto nuevo no lo necesita: schema.sql ya lo incluye.)

create table asset_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- null = «Sin tipo». Deleting a type leaves its assets untyped.
alter table assets add column asset_type_id uuid references asset_types (id) on delete set null;

alter table asset_types enable row level security;
create policy "own rows" on asset_types for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index asset_types_user_idx on asset_types (user_id);

revoke all on asset_types from anon;
grant select, insert, update, delete on asset_types to authenticated;
