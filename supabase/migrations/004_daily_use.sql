-- Cuentas del día a día (efectivo) para estimar el gasto no registrado.
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega este archivo → Run. Una sola vez.
-- (Un proyecto nuevo no lo necesita: schema.sql ya lo incluye.)

alter table assets add column daily_use boolean not null default true;
