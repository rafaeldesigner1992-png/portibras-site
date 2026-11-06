-- Tabela de configurações do sistema (chave/valor JSON)
create table if not exists configuracoes (
  chave       text primary key,
  valor       text not null,           -- JSON serializado
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Apenas autenticados podem ler/gravar
alter table configuracoes enable row level security;

create policy "config_read"  on configuracoes for select using (auth.role() = 'authenticated');
create policy "config_write" on configuracoes for all    using (auth.role() = 'authenticated');

-- Seed: fornecedores padrão
insert into configuracoes (chave, valor)
values (
  'logistica_fornecedores',
  '["G Sardou","Disafe","GUBLER","DW15","Original Portas"]'
)
on conflict (chave) do nothing;

-- Trigger atualizado_em
create or replace function touch_configuracao()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger trg_touch_configuracao
  before update on configuracoes
  for each row execute function touch_configuracao();
