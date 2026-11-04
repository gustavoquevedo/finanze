-- Finanzas y pisos — esquema de la base de datos (Supabase / Postgres).
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se ejecuta una sola vez, en un proyecto vacío.
--
-- Refleja los tipos de lib/domain/types.ts. Importes en céntimos (bigint); fechas como date.
-- Cada fila lleva user_id = auth.uid() y RLS impide ver o tocar filas de otros usuarios.

create type transaction_type as enum ('ingreso', 'gasto');
create type category_scope as enum ('personal', 'piso');
create type frequency as enum ('mensual', 'trimestral', 'anual');
create type recurring_kind as enum ('fijo', 'hipoteca');
create type interest_method as enum ('mensual', 'dias365', 'dias360');

create table properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  address text not null default '',
  purchase_date date not null,
  acquisition_price bigint not null check (acquisition_price >= 0),
  purchase_costs bigint not null default 0 check (purchase_costs >= 0),
  cadastral_value bigint check (cadastral_value >= 0),
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
  -- Money out that is not an expense (mortgage principal).
  not_expense boolean not null default false,
  -- Counts towards the Renta limit of interest + repairs <= income.
  limited_deduction boolean not null default false,
  -- Icon id from lib/icons/catalog.ts.
  icon text,
  created_at timestamptz not null default now(),
  check (not (not_expense and deductible)),
  check (not limited_deduction or deductible)
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
  -- 'hipoteca': French-system mortgage; category_id is the interest category.
  kind recurring_kind not null default 'fijo',
  mortgage_principal bigint check (mortgage_principal > 0),
  mortgage_annual_rate numeric(6, 3) check (mortgage_annual_rate between 0 and 30),
  mortgage_installments smallint check (mortgage_installments between 1 and 600),
  -- mensual = TIN/12; dias365/dias360 = by days since the previous installment.
  mortgage_interest_method interest_method,
  mortgage_principal_category_id uuid references categories (id),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (
    (kind = 'fijo' and mortgage_principal is null)
    or (kind = 'hipoteca' and frequency = 'mensual' and mortgage_principal is not null
        and mortgage_annual_rate is not null and mortgage_installments is not null
        and mortgage_principal_category_id is not null and end_date is not null)
  )
);

-- Bank corrections from a date: real outstanding principal and/or the bank's installment.
create table mortgage_adjustments (
  recurring_id uuid not null references recurrings (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  balance bigint check (balance >= 0),
  payment bigint check (payment > 0),
  primary key (recurring_id, date),
  check (balance is not null or payment is not null)
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

-- Inversiones -------------------------------------------------------------

create type asset_kind as enum ('fondo', 'etf', 'efectivo', 'inmobiliario');

-- User-defined classification of assets (e.g. «Renta variable»).
create table asset_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Icon id from lib/icons/catalog.ts.
  icon text,
  created_at timestamptz not null default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind asset_kind not null,
  -- Real estate assets come from a flat (one per flat).
  property_id uuid unique references properties (id) on delete cascade,
  -- null = «Sin tipo». Deleting a type leaves its assets untyped.
  asset_type_id uuid references asset_types (id) on delete set null,
  -- Cash only: everyday account used to estimate unrecorded spending.
  daily_use boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'inmobiliario') = (property_id is not null))
);

-- Value at a date; purchase value and fiscal cost are kept from the previous snapshot when null.
create table asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  date date not null,
  value bigint not null check (value >= 0),
  purchase_value bigint check (purchase_value >= 0),
  -- Acquisition value for tax purposes (kept across fund transfers).
  fiscal_cost bigint check (fiscal_cost >= 0),
  unique (asset_id, date)
);

create table portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  -- Sub-portfolios; cycles are prevented by the app.
  parent_id uuid references portfolios (id) on delete set null,
  created_at timestamptz not null default now()
);

-- An asset can be in several portfolios.
create table portfolio_assets (
  portfolio_id uuid not null references portfolios (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (portfolio_id, asset_id)
);

-- RLS: cada fila pertenece a su usuario.
alter table properties enable row level security;
alter table categories enable row level security;
alter table recurrings enable row level security;
alter table transactions enable row level security;
alter table mortgage_adjustments enable row level security;
alter table asset_types enable row level security;
alter table assets enable row level security;
alter table asset_snapshots enable row level security;
alter table portfolios enable row level security;
alter table portfolio_assets enable row level security;

create policy "own rows" on properties for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on recurrings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on mortgage_adjustments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on asset_types for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on asset_snapshots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on portfolios for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on portfolio_assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Índices por usuario (las políticas RLS filtran por user_id).
create index properties_user_idx on properties (user_id);
create index categories_user_idx on categories (user_id);
create index recurrings_user_idx on recurrings (user_id);
create index mortgage_adjustments_user_idx on mortgage_adjustments (user_id);
create index asset_types_user_idx on asset_types (user_id);
create index assets_user_idx on assets (user_id);
create index asset_snapshots_user_idx on asset_snapshots (user_id);
create index portfolios_user_idx on portfolios (user_id);
create index portfolio_assets_user_idx on portfolio_assets (user_id);

-- Acceso solo para usuarios con sesión (RLS limita además a sus propias filas).
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
