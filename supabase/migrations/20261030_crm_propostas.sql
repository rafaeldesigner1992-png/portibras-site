-- ─── Tabela de propostas geradas ─────────────────────────────────────────────
create table if not exists public.crm_propostas (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  tipo        text not null check (tipo in ('orcamento', 'manutencao')),
  nome_arquivo text not null,
  storage_path text not null,
  status      text not null default 'criado' check (status in ('criado', 'enviado', 'fechado', 'descontinuado')),
  conteudo    jsonb,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Trigger para atualizar atualizado_em automaticamente
create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_crm_propostas_atualizado_em
  before update on public.crm_propostas
  for each row execute function public.set_atualizado_em();

-- RLS
alter table public.crm_propostas enable row level security;

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

-- ─── Bucket no Storage ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('propostas', 'propostas', false)
on conflict (id) do nothing;

create policy "Leitura autenticada"
  on storage.objects for select
  using (bucket_id = 'propostas' and auth.role() = 'authenticated');

create policy "Upload autenticado"
  on storage.objects for insert
  with check (bucket_id = 'propostas' and auth.role() = 'authenticated');

create policy "Exclusão autenticada"
  on storage.objects for delete
  using (bucket_id = 'propostas' and auth.role() = 'authenticated');
