-- Finanzas y pisos — esquema para la fase 2 (Supabase / Postgres).
-- No se ejecuta todavía. Refleja los tipos de lib/domain/types.ts.
-- Importes en céntimos (bigint). Fechas como date.

create type transaction_type as enum ('ingreso', 'gasto');
create type category_scope as enum ('personal', 'piso');
create type frequency as enum ('mensual', 'trimestral', 'anual');

create table properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  address text not null default '',
  purchase_date date not null,
  acquisition_price bigint not null check (acquisition_price >= 0),
  construction_percentage numeric(5, 2) not null check (construction_percentage between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type transaction_type not null,
  scope category_scope not null,
  deductible boolean not null default false,
  created_at timestamptz not null default now()
);

create table recurrings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept text not null,
  amount bigint not null check (amount > 0),
  type transaction_type not null,
  category_id uuid not null references categories (id),
  property_id uuid references properties (id) on delete cascade,
  frequency frequency not null,
  day smallint not null check (day between 1 and 31),
  start_date date not null,
  end_date date,
  -- Occurrences up to this date have already been generated.
  generated_until date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount bigint not null check (amount > 0),
  type transaction_type not null,
  category_id uuid not null references categories (id),
  property_id uuid references properties (id) on delete cascade,
  concept text not null default '',
  recurring_id uuid references recurrings (id) on delete set null,
  -- false = generated automatically and pending confirmation (already counts in totals).
  confirmed boolean not null default true,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on transactions (user_id, date desc);
create index transactions_property_idx on transactions (property_id);
create index transactions_category_idx on transactions (category_id);

-- RLS: cada fila pertenece a su usuario.
alter table properties enable row level security;
alter table categories enable row level security;
alter table recurrings enable row level security;
alter table transactions enable row level security;

create policy "own rows" on properties for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on recurrings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
