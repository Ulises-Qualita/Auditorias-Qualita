-- ============================================================
-- RLS — exigir el dominio @qualita.studio en todas las policies
-- Correr en el SQL Editor de Supabase. Tiene 3 partes: correrlas en orden.
-- ============================================================
--
-- El agujero: las policies de la consola daban acceso a cualquier rol
-- `authenticated` (`using (true)`). El login con Google está limitado al
-- dominio (OAuth Client "Internal" + chequeo en /auth/callback), pero el
-- proveedor Email de Supabase está habilitado: cualquiera puede registrarse
-- con la anon key —que es pública, viaja al browser— y con esa sesión leer y
-- editar leads y diagnósticos directo por la API de Supabase, sin pasar por
-- la consola.
--
-- Esto cierra el agujero en la base, que es donde tiene que estar: aunque
-- alguien consiga una sesión por otra vía, sin un email @qualita.studio las
-- policies no le devuelven ni le dejan tocar nada.
--
-- Qué NO cambia:
--   * El pipeline, el form público y /d/[token] usan la secret key (service
--     role), que ignora RLS. Siguen funcionando igual.
--   * Las condiciones que ya tenía cada policy (por ejemplo, que un
--     diagnóstico interno salga con origen 'consola' y firmado por quien lo
--     crea) se CONSERVAN: el dominio se suma con AND, no las reemplaza.
--
-- Además de correr esto: Supabase → Authentication → Providers → Email →
-- deshabilitarlo. El equipo entra solo con Google.


-- ------------------------------------------------------------
-- PARTE 1 — Diagnóstico (solo lectura). Cómo están hoy.
-- ------------------------------------------------------------
-- Mirá las columnas `roles`, `qual` (USING) y `with_check`. Si ves `true` en
-- policies de `authenticated` o `public`, es el agujero.

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- ------------------------------------------------------------
-- PARTE 2 — Endurecer.
-- ------------------------------------------------------------

begin;

-- ¿La sesión es de alguien del equipo? Lee el email del JWT de Supabase.
-- `stable`: Postgres la evalúa una vez por consulta, no por fila.
create or replace function public.es_equipo_qualita()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@qualita.studio'
$$;

revoke all on function public.es_equipo_qualita() from public;
grant execute on function public.es_equipo_qualita() to authenticated, anon;

-- A cada policy de las tablas de la app que aplique a `authenticated` o a
-- `public` le suma "y además es del equipo". Se salta las que ya lo exigen,
-- así correr el script dos veces no duplica la condición.
--
-- ALTER POLICY no deja poner WITH CHECK en SELECT ni DELETE, ni USING en
-- INSERT: por eso cada comando toca solo las cláusulas que admite.
do $$
declare
  p record;
  usando text;
  chequeo text;
begin
  for p in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('companies', 'diagnostics', 'share_tokens', 'app_settings', 'analysis_costs')
      and (roles && array['authenticated', 'public']::name[])
  loop
    usando := case
      when p.qual is null then 'public.es_equipo_qualita()'
      when p.qual like '%es_equipo_qualita%' then null
      else format('(%s) and public.es_equipo_qualita()', p.qual)
    end;
    chequeo := case
      when p.with_check is null then 'public.es_equipo_qualita()'
      when p.with_check like '%es_equipo_qualita%' then null
      else format('(%s) and public.es_equipo_qualita()', p.with_check)
    end;

    if p.cmd in ('SELECT', 'DELETE') and usando is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, usando);
      raise notice 'endurecida: %.% (%)', p.tablename, p.policyname, p.cmd;

    elsif p.cmd = 'INSERT' and chequeo is not null then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, chequeo);
      raise notice 'endurecida: %.% (%)', p.tablename, p.policyname, p.cmd;

    elsif p.cmd in ('UPDATE', 'ALL') and (usando is not null or chequeo is not null) then
      execute format(
        'alter policy %I on public.%I using (%s) with check (%s)',
        p.policyname,
        p.tablename,
        coalesce(usando, p.qual),
        coalesce(chequeo, p.with_check)
      );
      raise notice 'endurecida: %.% (%)', p.tablename, p.policyname, p.cmd;

    else
      raise notice 'ya exigía el dominio: %.% (%)', p.tablename, p.policyname, p.cmd;
    end if;
  end loop;
end
$$;

commit;


-- ------------------------------------------------------------
-- PARTE 3 — Verificación.
-- ------------------------------------------------------------
-- 3.a) Ninguna policy de estas tablas debería quedar sin la función.
--      Resultado esperado: cero filas.

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('companies', 'diagnostics', 'share_tokens', 'app_settings', 'analysis_costs')
  and (roles && array['authenticated', 'public']::name[])
  and not (
    (cmd in ('SELECT', 'DELETE') and qual like '%es_equipo_qualita%')
    or (cmd = 'INSERT' and with_check like '%es_equipo_qualita%')
    or (cmd in ('UPDATE', 'ALL') and qual like '%es_equipo_qualita%' and with_check like '%es_equipo_qualita%')
  );

-- 3.b) Simular una sesión de afuera del equipo y una del equipo, sin tocar
--      datos (todo dentro de una transacción que se deshace).
--      Esperado: "ajeno" ve 0 filas en todas; "equipo" ve las filas reales.

begin;
set local role authenticated;

select set_config('request.jwt.claims', '{"email":"alguien@gmail.com","role":"authenticated"}', true);
select 'ajeno' as sesion,
  (select count(*) from public.companies) as companies,
  (select count(*) from public.diagnostics) as diagnostics,
  (select count(*) from public.share_tokens) as share_tokens,
  (select count(*) from public.app_settings) as app_settings,
  (select count(*) from public.analysis_costs) as analysis_costs;

select set_config('request.jwt.claims', '{"email":"ulises@qualita.studio","role":"authenticated"}', true);
select 'equipo' as sesion,
  (select count(*) from public.companies) as companies,
  (select count(*) from public.diagnostics) as diagnostics,
  (select count(*) from public.share_tokens) as share_tokens,
  (select count(*) from public.app_settings) as app_settings,
  (select count(*) from public.analysis_costs) as analysis_costs;

rollback;
