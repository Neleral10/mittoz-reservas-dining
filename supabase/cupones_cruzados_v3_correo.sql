-- Cortesías cruzadas · v3: el cliente puede dejar correo en lugar de WhatsApp
-- Pegar en Supabase (proyecto rtmtoyywvqadxkxadgkp) → SQL Editor → Run. Se puede correr dos veces.

alter table public.cupones_cruzados
  add column if not exists cliente_email text;

create index if not exists cupones_email_idx on public.cupones_cruzados (cliente_email);

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'cupones_cruzados' and column_name = 'cliente_email';
