-- ============================================================
-- RLS — Fase 4c: escritura autenticada sobre diagnostics
-- Correr en el SQL Editor de Supabase, después de docs/rls-policies.sql.
-- ============================================================
--
-- Qué habilita: que la consola pueda cambiar `lead_status` y marcar un
-- diagnóstico como revisado (`status` = 'sent') con la sesión del equipo, sin
-- pasar por el service_role.
--
-- Qué NO habilita, a propósito:
--   * INSERT y DELETE sobre diagnostics: nada de la consola los necesita.
--     Las altas siguen entrando por el form público con la secret key.
--   * companies y share_tokens: solo lectura. Editar los datos que cargó la
--     empresa, o rotar un token ya compartido, no es una operación de UI.
--   * el rol anon: sin escritura, nunca.
--
-- USING decide QUÉ filas se pueden tocar; WITH CHECK, CÓMO pueden quedar
-- después del update. Sin WITH CHECK, Postgres rechaza el update igual, así
-- que las dos cláusulas son necesarias.

begin;

drop policy if exists "consola actualiza diagnostics" on public.diagnostics;

create policy "consola actualiza diagnostics"
  on public.diagnostics
  for update
  to authenticated
  using (true)
  with check (true);

commit;

-- ------------------------------------------------------------
-- Endurecimiento futuro (opcional): exigir el dominio también en la DB, para
-- que una sesión creada por otra vía no pueda escribir aunque llegue a
-- `authenticated`. Usa la función esbozada en docs/rls-policies.sql:
--
--   create or replace function public.es_equipo_qualita()
--   returns boolean
--   language sql stable
--   as $$
--     select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@qualita.studio'
--   $$;
--
--   create policy "consola actualiza diagnostics"
--     on public.diagnostics
--     for update
--     to authenticated
--     using (public.es_equipo_qualita())
--     with check (public.es_equipo_qualita());
--
-- Más estricto todavía sería limitar QUÉ columnas se pueden cambiar. RLS no
-- distingue por columna: eso se hace con `grant update (lead_status, status,
-- reviewed_by, updated_at) on public.diagnostics to authenticated` más un
-- `revoke update on public.diagnostics from authenticated` previo.
-- ------------------------------------------------------------

-- Chequeo de lo aplicado:
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, policyname;
