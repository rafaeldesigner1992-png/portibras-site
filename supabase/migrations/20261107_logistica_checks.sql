-- Registro de checks de preenchimento por pedido e aba
CREATE TABLE IF NOT EXISTS logistica_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   uuid NOT NULL REFERENCES logistica_pedidos(id) ON DELETE CASCADE,
  aba         text NOT NULL CHECK (aba IN ('info', 'aquisicao', 'tarefas')),
  checked     boolean NOT NULL DEFAULT true,
  checked_em  timestamptz NOT NULL DEFAULT now(),
  checked_por text
);

CREATE INDEX IF NOT EXISTS idx_lc_pedido ON logistica_checks(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lc_aba    ON logistica_checks(pedido_id, aba);
