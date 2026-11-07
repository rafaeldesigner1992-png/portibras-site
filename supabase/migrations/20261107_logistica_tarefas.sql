-- Tarefas por pedido logístico
-- Checklist com percentual de entrega

CREATE TABLE IF NOT EXISTS logistica_tarefas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   uuid NOT NULL REFERENCES logistica_pedidos(id) ON DELETE CASCADE,
  descricao   text NOT NULL,
  concluida   boolean NOT NULL DEFAULT false,
  ordem       integer NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lt_pedido ON logistica_tarefas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lt_ordem  ON logistica_tarefas(pedido_id, ordem);
