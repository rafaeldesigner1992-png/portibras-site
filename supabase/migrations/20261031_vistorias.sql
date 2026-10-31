-- Tabela de vistorias (fluxo CRM → Logística → CRM)
-- Execute no Supabase Dashboard > SQL Editor

create table if not exists vistorias (
  id                uuid primary key default gen_random_uuid(),
  -- Vínculo com lead/cliente do CRM
  lead_id           uuid references crm_leads(id) on delete set null,
  cliente_nome      text not null,
  cliente_endereco  text,
  cliente_telefone  text,
  cliente_email     text,
  -- Controle de fluxo
  status            text not null default 'pendente'
                    check (status in ('pendente','agendada','em_andamento','concluida','cancelada')),
  -- Agendamento (preenchido em Logística)
  data_agendada     timestamptz,
  tecnico_nome      text,
  observacoes       text,
  -- DTS — Documento Técnico de Segurança
  dts_url           text,          -- URL do arquivo no Supabase Storage
  dts_nome          text,          -- Nome original do arquivo
  dts_resumo_ia     text,          -- Resumo gerado pela IA
  dts_materiais     jsonb,         -- Materiais extraídos estruturados
  -- Quem enviou para vistoria
  enviado_por       text,          -- nome do usuário que enviou
  enviado_em        timestamptz default now(),
  -- Conclusão
  concluida_em      timestamptz,
  -- Metadados
  criado_em         timestamptz default now(),
  atualizado_em     timestamptz default now()
);

-- Índices
create index if not exists vistorias_status_idx on vistorias(status);
create index if not exists vistorias_lead_id_idx on vistorias(lead_id);
create index if not exists vistorias_data_agendada_idx on vistorias(data_agendada);

-- RLS
alter table vistorias enable row level security;
create policy "Acesso autenticado vistorias" on vistorias
  for all using (auth.role() = 'authenticated');

-- Trigger para atualizar atualizado_em
create or replace function update_vistorias_timestamp()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger vistorias_updated_at
  before update on vistorias
  for each row execute function update_vistorias_timestamp();

-- Storage bucket para DTS
insert into storage.buckets (id, name, public)
values ('dts-documentos', 'dts-documentos', false)
on conflict (id) do nothing;

-- Policy de acesso ao storage
create policy "Acesso autenticado dts-documentos" on storage.objects
  for all using (
    bucket_id = 'dts-documentos' and auth.role() = 'authenticated'
  );
