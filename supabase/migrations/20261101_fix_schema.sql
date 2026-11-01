-- Migration: adiciona crm_lead_id em financeiro_lancamentos
-- e cria tabelas logistica_pedidos + logistica_aquisicoes
-- Execute no Supabase Dashboard > SQL Editor

-- ─── 1. Colunas faltantes em financeiro_lancamentos ────────────────────────
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS crm_lead_id  uuid REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacoes  text,
  ADD COLUMN IF NOT EXISTS categoria    text,
  ADD COLUMN IF NOT EXISTS pago         boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS fin_lanc_crm_lead_idx ON financeiro_lancamentos(crm_lead_id);

-- ─── 2. Tabela logistica_pedidos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistica_pedidos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id       uuid REFERENCES crm_leads(id) ON DELETE SET NULL,
  fin_lancamento_id uuid REFERENCES financeiro_lancamentos(id) ON DELETE SET NULL,

  cliente_nome      text,
  cliente_empresa   text,
  cliente_telefone  text,
  cliente_email     text,
  cliente_endereco  text,
  tipo_servico      text,
  valor_venda       numeric(12,2),
  custo_estimado    numeric(12,2),
  margem_pct        numeric(5,2),
  observacoes_crm   text,
  orcamento_id      uuid,
  portas            int,
  parcela_mensal    numeric(12,2),

  etapa             text NOT NULL DEFAULT 'tratamento'
                    CHECK (etapa IN ('tratamento','aguard_material','aguard_cobranca','em_execucao','concluido','cancelado')),

  tipo_cobranca     text DEFAULT 'antes'
                    CHECK (tipo_cobranca IN ('antes','apos','sem_cobranca')),
  cobrado           boolean NOT NULL DEFAULT false,
  cobrado_em        timestamptz,

  responsavel       text,
  observacoes       text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Tabela logistica_aquisicoes ─────────────────────────────────────────
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

-- ─── 4. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS logp_crm_lead_idx  ON logistica_pedidos(crm_lead_id);
CREATE INDEX IF NOT EXISTS logp_etapa_idx     ON logistica_pedidos(etapa);
CREATE INDEX IF NOT EXISTS logp_cobrado_idx   ON logistica_pedidos(cobrado);
CREATE INDEX IF NOT EXISTS logaq_pedido_idx   ON logistica_aquisicoes(pedido_id);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE logistica_pedidos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_aquisicoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'logistica_pedidos' AND policyname = 'auth_logp'
  ) THEN
    CREATE POLICY "auth_logp" ON logistica_pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'logistica_aquisicoes' AND policyname = 'auth_logaq'
  ) THEN
    CREATE POLICY "auth_logaq" ON logistica_aquisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 6. Trigger atualizado_em ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_logistica_pedidos_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_logp_ts ON logistica_pedidos;
CREATE TRIGGER trg_logp_ts
  BEFORE UPDATE ON logistica_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_logistica_pedidos_ts();
