-- =====================================================================
-- Cortesías cruzadas Mittoz · versión 2  (noviembre 2026)
-- Pegar completo en Supabase → SQL Editor → Run. Se puede correr dos veces.
-- =====================================================================

-- 1) Columnas nuevas ----------------------------------------------------
alter table public.cupones_cruzados
  add column if not exists grupo uuid,                 -- une el cupón de bebida con el de Leonessa
  add column if not exists cliente_nombre text,
  add column if not exists cliente_whatsapp text,
  add column if not exists acepta_promos boolean default false,
  add column if not exists folio_origen text,          -- folio del ticket (o HAB-xxx-AAAAMMDD en hotel)
  add column if not exists personas_max int,
  add column if not exists foto_ticket text,           -- ruta en el bucket tickets-cupones
  add column if not exists lectura_ticket jsonb,       -- lo que leyó la IA
  add column if not exists requiere_revision boolean default false,
  add column if not exists motivo_revision text,
  add column if not exists consumo_alimentos boolean;  -- confirmado por el mesero al canjear

-- 2) Valores permitidos (se reemplazan las reglas anteriores) ---------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cupones_cruzados'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%restaurante_%' or pg_get_constraintdef(oid) ilike '%beneficio%')
  loop
    execute format('alter table public.cupones_cruzados drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cupones_cruzados
  add constraint cupones_origen_valido
    check (restaurante_origen in ('bocamar','soulbox','elnido','leonessa','hotelmittoz')),
  add constraint cupones_destino_valido
    check (restaurante_destino is null or restaurante_destino in ('bocamar','soulbox','elnido','leonessa')),
  add constraint cupones_beneficio_valido
    check (beneficio in ('bebida','combo_leonessa','descuento_10')),
  add constraint cupones_personas_validas
    check (personas_max is null or personas_max between 1 and 10);

-- 3) Una cuenta = un cupón de cada tipo -------------------------------
create unique index if not exists cupones_folio_unico
  on public.cupones_cruzados (restaurante_origen, folio_origen, beneficio)
  where folio_origen is not null;

create index if not exists cupones_whatsapp_idx on public.cupones_cruzados (cliente_whatsapp);

-- 4) Bucket privado para las fotos de los tickets ---------------------
insert into storage.buckets (id, name, public)
values ('tickets-cupones', 'tickets-cupones', false)
on conflict (id) do nothing;

drop policy if exists "tickets_cupones_subir_anon" on storage.objects;
create policy "tickets_cupones_subir_anon" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'tickets-cupones');

drop policy if exists "tickets_cupones_ver_staff" on storage.objects;
create policy "tickets_cupones_ver_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets-cupones');

-- 5) Revisión rápida: debe mostrar las columnas nuevas ---------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'cupones_cruzados'
order by ordinal_position;
