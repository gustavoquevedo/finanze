-- Iconos para categorías y tipos de activo (id del catálogo lib/icons/catalog.ts).
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega este archivo → Run. Una sola vez.
-- (Un proyecto nuevo no lo necesita: schema.sql ya lo incluye.)

alter table categories add column icon text;
alter table asset_types add column icon text;
