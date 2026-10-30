-- Apenas recria as policies que faltam (tabela já existe)
-- Execute no SQL Editor do Supabase

-- Remove policies existentes para evitar conflito
drop policy if exists "Usuários autenticados lêem propostas" on public.crm_propostas;
drop policy if exists "Usuários autenticados inserem propostas" on public.crm_propostas;
drop policy if exists "Usuários autenticados atualizam propostas" on public.crm_propostas;
drop policy if exists "Usuários autenticados excluem propostas" on public.crm_propostas;

-- Garante RLS ativo
alter table public.crm_propostas enable row level security;

-- Recria as policies
create policy "Usuários autenticados lêem propostas"
  on public.crm_propostas for select
  using (auth.role() = 'authenticated');

create policy "Usuários autenticados inserem propostas"
  on public.crm_propostas for insert
  with check (auth.role() = 'authenticated');

create policy "Usuários autenticados atualizam propostas"
  on public.crm_propostas for update
  using (auth.role() = 'authenticated');

create policy "Usuários autenticados excluem propostas"
  on public.crm_propostas for delete
  using (auth.role() = 'authenticated');

-- Garante que o trigger existe
create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_propostas_atualizado_em on public.crm_propostas;
create trigger trg_crm_propostas_atualizado_em
  before update on public.crm_propostas
  for each row execute function public.set_atualizado_em();

-- Bucket (já existe, o on conflict garante)
insert into storage.buckets (id, name, public)
values ('propostas', 'propostas', false)
on conflict (id) do nothing;

-- Policies de Storage (remove antes para evitar conflito)
drop policy if exists "Leitura autenticada" on storage.objects;
drop policy if exists "Upload autenticado" on storage.objects;
drop policy if exists "Exclusão autenticada" on storage.objects;

create policy "Leitura autenticada"
  on storage.objects for select
  using (bucket_id = 'propostas' and auth.role() = 'authenticated');

create policy "Upload autenticado"
  on storage.objects for insert
  with check (bucket_id = 'propostas' and auth.role() = 'authenticated');

create policy "Exclusão autenticada"
  on storage.objects for delete
  using (bucket_id = 'propostas' and auth.role() = 'authenticated');
