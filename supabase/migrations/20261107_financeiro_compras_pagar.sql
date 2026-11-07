-- Contas a pagar de materiais comprados
-- Vinculadas a aquisições de pedidos logísticos

CREATE TABLE IF NOT EXISTS financeiro_compras_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aquisicao_id    uuid REFERENCES logistica_aquisicoes(id) ON DELETE SET NULL,
  pedido_id       uuid REFERENCES logistica_pedidos(id) ON DELETE SET NULL,
  descricao       text NOT NULL,
  fornecedor      text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  vencimento      date,
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  pago_em         date,
  valor_pago      numeric(12,2),
  forma_pagamento text,
  observacoes     text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fcp_pedido    ON financeiro_compras_pagar(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fcp_aquisicao ON financeiro_compras_pagar(aquisicao_id);
CREATE INDEX IF NOT EXISTS idx_fcp_status    ON financeiro_compras_pagar(status);
