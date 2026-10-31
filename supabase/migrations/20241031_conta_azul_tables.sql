-- Tabelas para integração Conta Azul
-- Rodar no Supabase Dashboard → SQL Editor

-- Vendas (faturamento emitido)
CREATE TABLE IF NOT EXISTS ca_vendas (
  id                TEXT PRIMARY KEY,
  numero            TEXT,
  cliente_nome      TEXT NOT NULL DEFAULT '',
  cliente_documento TEXT,
  valor_total       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'unknown',
  data_emissao      TIMESTAMPTZ,
  data_vencimento   TIMESTAMPTZ,
  observacao        TEXT,
  sincronizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cobranças / Recebíveis (boletos, PIX, etc.)
CREATE TABLE IF NOT EXISTS ca_cobrancas (
  id              TEXT PRIMARY KEY,
  descricao       TEXT NOT NULL DEFAULT '',
  cliente_nome    TEXT,
  valor           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vencimento      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  pago_em         TIMESTAMPTZ,
  valor_pago      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tipo            TEXT NOT NULL DEFAULT 'receita',
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contratos recorrentes
CREATE TABLE IF NOT EXISTS ca_contratos (
  id                  TEXT PRIMARY KEY,
  nome                TEXT NOT NULL DEFAULT '',
  cliente_nome        TEXT NOT NULL DEFAULT '',
  cliente_documento   TEXT,
  valor               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  periodicidade       TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  data_inicio         TIMESTAMPTZ,
  data_fim            TIMESTAMPTZ,
  sincronizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_ca_cobrancas_vencimento ON ca_cobrancas (vencimento);
CREATE INDEX IF NOT EXISTS idx_ca_cobrancas_status     ON ca_cobrancas (status);
CREATE INDEX IF NOT EXISTS idx_ca_vendas_data_emissao  ON ca_vendas (data_emissao);
CREATE INDEX IF NOT EXISTS idx_ca_contratos_status     ON ca_contratos (status);

-- RLS: acesso somente autenticado
ALTER TABLE ca_vendas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_ca_vendas"    ON ca_vendas    FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_ca_cobrancas" ON ca_cobrancas FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_ca_contratos" ON ca_contratos FOR SELECT TO authenticated USING (true);

-- Service role pode escrever (Edge Function usa service role)
CREATE POLICY "service_write_ca_vendas"    ON ca_vendas    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_ca_cobrancas" ON ca_cobrancas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_ca_contratos" ON ca_contratos FOR ALL TO service_role USING (true) WITH CHECK (true);
