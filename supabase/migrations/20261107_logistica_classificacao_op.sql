-- Classificação operacional do pedido logístico
ALTER TABLE logistica_pedidos
  ADD COLUMN IF NOT EXISTS classificacao_op text
    CHECK (classificacao_op IN ('fornecimento', 'instalacao'))
    DEFAULT 'instalacao';
