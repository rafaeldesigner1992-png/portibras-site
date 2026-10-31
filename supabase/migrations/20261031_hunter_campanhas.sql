-- Hunter: Campanhas de prospecção e leads salvos
-- Execute no Supabase Dashboard > SQL Editor

-- Campanhas: cada busca vira uma campanha salva
create table if not exists hunter_campanhas (
  id          uuid primary key default gen_random_uuid(),
  cidade      text not null,
  bairro      text,
  segmento    text not null,
  total       int default 0,
  criado_em   timestamptz default now()
);

create index if not exists hunter_campanhas_cidade_idx on hunter_campanhas(cidade, segmento);

alter table hunter_campanhas enable row level security;
create policy "Acesso autenticado hunter_campanhas" on hunter_campanhas
  for all using (auth.role() = 'authenticated');

-- Leads do Hunter: cada empresa encontrada numa campanha
create table if not exists hunter_leads (
  id            uuid primary key default gen_random_uuid(),
  campanha_id   uuid references hunter_campanhas(id) on delete cascade,
  -- Dados do Google Maps
  nome          text not null,
  telefone      text,
  email         text,
  endereco      text,
  categoria     text,
  rating        numeric(3,1),
  reviews       int,
  website       text,
  maps_url      text,
  lat           numeric,
  lon           numeric,
  -- Status do lead
  status        text not null default 'novo'
                check (status in ('novo','contatado','negado','convertido')),
  motivo_negado text,
  -- Chave de deduplicação: nome + cidade para evitar repuxar
  chave_dedup   text generated always as (lower(trim(nome))) stored,
  cidade        text not null,
  -- Vínculo com CRM quando convertido
  crm_lead_id   uuid references crm_leads(id) on delete set null,
  -- Metadados
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists hunter_leads_campanha_idx on hunter_leads(campanha_id);
create index if not exists hunter_leads_status_idx on hunter_leads(status);
create index if not exists hunter_leads_dedup_idx on hunter_leads(chave_dedup, cidade);

alter table hunter_leads enable row level security;
create policy "Acesso autenticado hunter_leads" on hunter_leads
  for all using (auth.role() = 'authenticated');

-- Trigger atualizado_em
create or replace function update_hunter_leads_timestamp()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger hunter_leads_updated_at
  before update on hunter_leads
  for each row execute function update_hunter_leads_timestamp();
