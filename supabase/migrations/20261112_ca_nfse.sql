-- Tabela para armazenar NFS-e emitidas sincronizadas do Conta Azul
-- Fonte de verdade para o cálculo do "Realizado" na meta comercial

create table if not exists public.ca_nfse (
  id                  text primary key,
  numero              text,
  numero_rps          text,
  cliente_nome        text not null default '—',
  cliente_documento   text,
  valor_servicos      numeric(12,2) not null default 0,
  situacao            text not null default 'EMITIDA',
  data_emissao        date,
  numero_nota         text,
  codigo_verificacao  text,
  sincronizado_em     timestamptz not null default now()
);

-- Índice para consultas por mês (usado no bpo-chat)
create index if not exists idx_ca_nfse_data_emissao on public.ca_nfse (data_emissao);
create index if not exists idx_ca_nfse_situacao      on public.ca_nfse (situacao);

-- RLS: leitura para usuários autenticados, escrita só via service role
alter table public.ca_nfse enable row level security;

create policy "ca_nfse_select" on public.ca_nfse
  for select to authenticated using (true);
