-- Tabelas extras para dados do Conta Azul
-- Execute no Supabase Dashboard > SQL Editor

-- Saldos de contas bancárias
create table if not exists ca_saldos (
  id              text primary key,
  nome            text not null,
  tipo            text,
  saldo           numeric(14,2) default 0,
  banco           text,
  agencia         text,
  conta           text,
  ativo           boolean default true,
  sincronizado_em timestamptz
);

alter table ca_saldos enable row level security;
create policy "Acesso autenticado ca_saldos" on ca_saldos
  for all using (auth.role() = 'authenticated');

-- Contas a pagar
create table if not exists ca_contas_pagar (
  id               text primary key,
  descricao        text not null,
  fornecedor_nome  text,
  valor            numeric(14,2) default 0,
  vencimento       date,
  status           text,
  pago_em          date,
  valor_pago       numeric(14,2) default 0,
  categoria        text,
  sincronizado_em  timestamptz
);

alter table ca_contas_pagar enable row level security;
create policy "Acesso autenticado ca_contas_pagar" on ca_contas_pagar
  for all using (auth.role() = 'authenticated');
