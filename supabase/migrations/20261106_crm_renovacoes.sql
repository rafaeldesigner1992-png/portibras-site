-- Tabela de renovações de certificado (garantia 6 meses)
create table if not exists crm_renovacoes (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid references logistica_pedidos(id) on delete set null,
  cliente_nome    text,
  cliente_empresa text,
  cliente_telefone text,
  cliente_email   text,
  cliente_endereco text,
  emitido_em      date not null default current_date,
  vence_em        date not null,
  status          text not null default 'pendente',  -- pendente | contatado | renovado | perdido
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- RLS: acesso total para usuários autenticados
alter table crm_renovacoes enable row level security;
create policy "renovacoes_all" on crm_renovacoes for all using (auth.role() = 'authenticated');

-- Atualiza atualizado_em automaticamente
create or replace function touch_renovacao()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;
create trigger trg_touch_renovacao
  before update on crm_renovacoes
  for each row execute function touch_renovacao();
