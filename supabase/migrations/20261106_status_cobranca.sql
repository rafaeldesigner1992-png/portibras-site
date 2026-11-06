-- Adiciona coluna status_cobranca à tabela logistica_pedidos
-- Substitui o boolean simples `cobrado` por um status de 3 estados

alter table logistica_pedidos
  add column if not exists status_cobranca text not null default 'aguardando'
  check (status_cobranca in ('aguardando', 'cobrado_parcial', 'cobrado_total'));

-- Migra os registros já marcados como cobrado para o novo campo
update logistica_pedidos
  set status_cobranca = 'cobrado_total'
  where cobrado = true and status_cobranca = 'aguardando';

-- Índice para facilitar filtros na tela A Faturar
create index if not exists idx_logistica_pedidos_status_cobranca
  on logistica_pedidos (status_cobranca);
