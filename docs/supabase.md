# Configurar Supabase (fase 2)

Sin las variables de entorno de Supabase la app sigue usando `localStorage` (útil en local y en los tests).
Con ellas, pide login por enlace mágico y guarda los datos en Supabase.

## 1. Crear las tablas

Supabase → **SQL Editor** → **New query** → pega todo [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
Una sola vez, en el proyecto vacío. Crea las tablas, los tipos, los índices y las políticas RLS
(cada usuario solo ve y modifica sus filas).

## 2. Login por enlace mágico

Supabase → **Authentication**:

- **Sign In / Providers → Email**: activado (por defecto). «Confirm email» puede quedarse activado.
- **URL Configuration**:
  - **Site URL**: `https://finanze-weld.vercel.app` (producción en Vercel).
  - **Redirect URLs** (añade las tres):
    - `https://finanze-weld.vercel.app/**`
    - `https://finanze-git-*-gusk1.vercel.app/**` (previews de cada PR)
    - `http://localhost:3000/**`

El enlace abre la app en el dispositivo donde lo pulses y deja la sesión iniciada en ese navegador.

**Límite de emails**: el servidor de correo incluido en Supabase envía pocos emails por hora. Para uso personal basta;
si se queda corto, configura un SMTP propio en Authentication → Emails.

## 3. Variables en Vercel

Vercel → proyecto → **Settings → Environment Variables**, para **Production** y **Preview**:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clave `sb_publishable_…` (Project Settings → API Keys) |

Son valores públicos: viajan al navegador y la seguridad la dan las políticas RLS.
**Nunca** pongas la `service_role` / secret key en Vercel ni en el repo.
Después, **Redeploy** para que la build los incluya.

## 4. Primer acceso

1. Abre la app, escribe tu email y pulsa el enlace que recibes.
2. La cuenta empieza vacía. En **Datos y copia** puedes subir los datos de ese navegador (los de la fase 1),
   importar una copia `.json` o cargar los datos de prueba.

## 5. Cerrar el registro (recomendado)

La app es para un único usuario. Cuando hayas entrado la primera vez, en Supabase → **Authentication → Sign In / Providers**
desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta (aunque, si lo hiciera, RLS
le impediría ver tus datos).

## En local

Copia `.env.example` a `.env.local` y rellena las dos variables. Sin ese archivo, la app usa `localStorage`.

## Cambios de esquema (migraciones)

`supabase/schema.sql` es siempre el esquema completo, para proyectos nuevos. Cuando un PR cambia la base de datos,
incluye además un archivo en `supabase/migrations/` para la base de datos que ya tienes: ejecútalo una vez en el
SQL Editor **antes** (o justo después) de fusionar el PR, en orden de número.

| Archivo | Qué hace |
|---|---|
| `002_asset_types.sql` | Tipos de activo: tabla `asset_types` y columna `assets.asset_type_id` |
