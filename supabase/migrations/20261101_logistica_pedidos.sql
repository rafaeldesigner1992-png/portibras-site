-- Pedidos vindos do CRM (lead fechado) para tratamento logístico
-- Execute no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS logistica_pedidos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id     uuid REFERENCES crm_leads(id) ON DELETE SET NULL,
  fin_lancamento_id uuid REFERENCES financeiro_lancamentos(id) ON DELETE SET NULL,

  -- Dados espelhados do lead (snapshot no momento do fechamento)
  cliente_nome    text,
  cliente_empresa text,
  cliente_telefone text,
  cliente_email   text,
  cliente_endereco text,
  tipo_servico    text,          -- 'orcamento' | 'manutencao'
  valor_venda     numeric(12,2),
  custo_estimado  numeric(12,2),
  margem_pct      numeric(5,2),
  observacoes_crm text,

  -- Dados do orçamento (snapshot)
  orcamento_id    uuid,
  portas          int,
  parcela_mensal  numeric(12,2),

  -- Etapa logística
  etapa           text NOT NULL DEFAULT 'tratamento'
                  CHECK (etapa IN ('tratamento','aguard_material','aguard_cobranca','em_execucao','concluido','cancelado')),

  -- Cobrança
  tipo_cobranca   text DEFAULT 'antes'
                  CHECK (tipo_cobranca IN ('antes','apos','sem_cobranca')),
  cobrado         boolean NOT NULL DEFAULT false,
  cobrado_em      timestamptz,

  -- Controle
  responsavel     text,
  observacoes     text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

-- Peças / itens de aquisição vinculados a um pedido logístico
CREATE TABLE IF NOT EXISTS logistica_aquisicoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES logistica_pedidos(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  quantidade      numeric(10,3) NOT NULL DEFAULT 1,
  unidade         text DEFAULT 'un',
  custo_unitario  numeric(12,2),
  fornecedor      text,
  link_compra     text,
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','pedido','recebido')),
  observacoes     text,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS logp_crm_lead_idx  ON logistica_pedidos(crm_lead_id);
CREATE INDEX IF NOT EXISTS logp_etapa_idx     ON logistica_pedidos(etapa);
CREATE INDEX IF NOT EXISTS logp_cobrado_idx   ON logistica_pedidos(cobrado);
CREATE INDEX IF NOT EXISTS logaq_pedido_idx   ON logistica_aquisicoes(pedido_id);

-- RLS
ALTER TABLE logistica_pedidos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_aquisicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_logp"  ON logistica_pedidos    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_logaq" ON logistica_aquisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger: atualiza atualizado_em
CREATE OR REPLACE FUNCTION update_logistica_pedidos_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_logp_ts ON logistica_pedidos;
CREATE TRIGGER trg_logp_ts
  BEFORE UPDATE ON logistica_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_logistica_pedidos_ts();
