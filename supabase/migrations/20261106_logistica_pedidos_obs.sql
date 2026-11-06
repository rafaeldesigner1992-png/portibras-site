-- Adiciona campos de observação de cobrança e data de faturamento
alter table logistica_pedidos
  add column if not exists obs_cobranca text,
  add column if not exists cobrado_em timestamptz;

-- Migra registros já cobrados sem data
update logistica_pedidos
  set cobrado_em = atualizado_em
  where cobrado = true and cobrado_em is null;
