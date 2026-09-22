-- Sitios de competidores declarados por la empresa en el formulario.
-- Correr una sola vez en el SQL editor de Supabase.
--
-- Por qué text[] y no jsonb: lo que se guarda es una lista corta de strings
-- sueltos (nombre o sitio, texto libre). text[] la tipa de verdad, se consulta
-- con los operadores de array (@>, = any, unnest) y el cliente de Supabase la
-- devuelve como string[] sin parseo. jsonb recién convendría si cada
-- competidor pasara a ser un objeto (nombre + url + hallazgos); el resultado
-- del benchmark, que sí es una estructura, ya tiene su lugar en
-- diagnostics.results.

alter table public.companies
  add column if not exists competidores text[];

comment on column public.companies.competidores is
  'Sitios de competidores declarados en el formulario. Hasta 3, sin vacíos ni repetidos. null = no cargaron ninguno.';

-- Red de seguridad: la app ya recorta a 3 (sanitizarCompetidores), esto
-- impide que un bug o una carga manual meta más.
alter table public.companies
  drop constraint if exists companies_competidores_max;

alter table public.companies
  add constraint companies_competidores_max
  check (competidores is null or array_length(competidores, 1) <= 3);
