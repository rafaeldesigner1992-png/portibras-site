-- Nova tabela de compras consolidadas
-- Uma compra pode ser vinculada a vários atendimentos
create table if not exists logistica_compras (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,                          -- ex: "Compra G Sardou 06/11"
  fornecedor        text,                                   -- G Sardou, Disafe, GUBLER, DW15, Original Portas
  materiais         text,                                   -- descrição livre dos materiais
  custo             numeric(10,2),
  status_entrega    text not null default 'Não iniciada',   -- Não iniciada | Em andamento | Concluído
  finalizado        boolean not null default false,
  previsao_chegada  date,
  data_recebido     date,
  quem_recebeu      text,
  observacoes       text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- Tabela de junção: compra ↔ atendimentos (N:N)
create table if not exists logistica_compras_atendimentos (
  id          uuid primary key default gen_random_uuid(),
  compra_id   uuid not null references logistica_compras(id) on delete cascade,
  pedido_id   uuid not null references logistica_pedidos(id) on delete cascade,
  unique(compra_id, pedido_id)
);

-- RLS
alter table logistica_compras enable row level security;
alter table logistica_compras_atendimentos enable row level security;

create policy "compras_all" on logistica_compras for all using (auth.role() = 'authenticated');
create policy "compras_atend_all" on logistica_compras_atendimentos for all using (auth.role() = 'authenticated');

-- Trigger atualizado_em
create or replace function touch_compra()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger trg_touch_compra
  before update on logistica_compras
  for each row execute function touch_compra();
