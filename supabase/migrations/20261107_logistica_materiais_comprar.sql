-- Tabela de materiais a serem comprados, vinculados a atendimentos
create table if not exists logistica_materiais_comprar (
  id              uuid primary key default gen_random_uuid(),
  descricao       text not null,
  quantidade      numeric(10,2) not null default 1,
  unidade         text not null default 'un',
  fornecedor      text,
  urgencia        text not null default 'normal' check (urgencia in ('baixa','normal','urgente')),
  status          text not null default 'Pendente' check (status in ('Pendente','Comprado','Recebido')),
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- Junction: materiais <-> atendimentos
create table if not exists logistica_materiais_comprar_atendimentos (
  material_id   uuid references logistica_materiais_comprar(id) on delete cascade,
  atendimento_id uuid references atendimentos(id) on delete cascade,
  primary key (material_id, atendimento_id)
);

-- Trigger para atualizar atualizado_em
create or replace function set_logistica_materiais_updated()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_logistica_materiais_updated on logistica_materiais_comprar;
create trigger trg_logistica_materiais_updated
  before update on logistica_materiais_comprar
  for each row execute function set_logistica_materiais_updated();

-- RLS: acesso irrestrito para usuários autenticados (padrão do sistema)
alter table logistica_materiais_comprar enable row level security;
alter table logistica_materiais_comprar_atendimentos enable row level security;

create policy "autenticados podem tudo em materiais_comprar"
  on logistica_materiais_comprar for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "autenticados podem tudo em materiais_comprar_atendimentos"
  on logistica_materiais_comprar_atendimentos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
