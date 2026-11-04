-- ============================================================
-- MARKETING — Google Ads Management
-- ============================================================

-- Configuração OAuth do Google Ads (uma por empresa)
CREATE TABLE IF NOT EXISTS google_ads_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     TEXT,                        -- Ex: "123-456-7890"
  client_id       TEXT,
  client_secret   TEXT,
  refresh_token   TEXT,
  developer_token TEXT,
  login_customer_id TEXT,                      -- MCC account ID se houver
  conectado       BOOLEAN DEFAULT false,
  ultimo_sync     TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);

-- Metas de Marketing (mensais / trimestrais)
CREATE TABLE IF NOT EXISTS marketing_metas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo         TEXT NOT NULL,               -- Ex: "2024-11" ou "2024-Q4"
  tipo_periodo    TEXT DEFAULT 'mensal',       -- 'mensal' | 'trimestral' | 'anual'
  meta_impressoes BIGINT,
  meta_cliques    BIGINT,
  meta_ctr        NUMERIC(5,2),               -- %
  meta_cpc        NUMERIC(10,2),              -- R$
  meta_conversoes BIGINT,
  meta_custo      NUMERIC(10,2),              -- R$ orçamento total
  meta_roas       NUMERIC(5,2),               -- Return on Ad Spend
  meta_leads      BIGINT,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);

-- Snapshot diário das campanhas Google Ads
CREATE TABLE IF NOT EXISTS marketing_campanhas_ads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     TEXT NOT NULL,               -- ID do Google Ads
  nome            TEXT NOT NULL,
  status          TEXT,                        -- ENABLED, PAUSED, REMOVED
  tipo            TEXT,                        -- SEARCH, DISPLAY, etc.
  orcamento_diario NUMERIC(10,2),
  impressoes      BIGINT DEFAULT 0,
  cliques         BIGINT DEFAULT 0,
  ctr             NUMERIC(5,4),               -- ex: 0.0523 = 5.23%
  cpc_medio       NUMERIC(10,2),
  custo_total     NUMERIC(10,2),
  conversoes      NUMERIC(10,2),
  valor_conversao NUMERIC(10,2),
  data_snapshot   DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em       TIMESTAMPTZ DEFAULT now()
);

-- Keywords (positivas e negativas)
CREATE TABLE IF NOT EXISTS marketing_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     TEXT,                        -- ID Google Ads (NULL = nível conta)
  campaign_nome   TEXT,
  keyword         TEXT NOT NULL,
  tipo            TEXT DEFAULT 'positiva',     -- 'positiva' | 'negativa'
  match_type      TEXT DEFAULT 'BROAD',        -- BROAD, PHRASE, EXACT
  status          TEXT DEFAULT 'ENABLED',
  impressoes      BIGINT DEFAULT 0,
  cliques         BIGINT DEFAULT 0,
  ctr             NUMERIC(5,4),
  cpc_medio       NUMERIC(10,2),
  custo_total     NUMERIC(10,2),
  conversoes      NUMERIC(10,2),
  quality_score   SMALLINT,                   -- 1-10
  criado_em       TIMESTAMPTZ DEFAULT now(),
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);

-- Insights gerados pelo Agente IA
CREATE TABLE IF NOT EXISTS marketing_insights_ia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL,               -- 'analise_geral' | 'campanha' | 'keyword' | 'meta'
  referencia_id   TEXT,                        -- campaign_id ou keyword_id
  insight         TEXT NOT NULL,
  recomendacao    TEXT,
  prioridade      TEXT DEFAULT 'media',        -- 'alta' | 'media' | 'baixa'
  status          TEXT DEFAULT 'pendente',     -- 'pendente' | 'aplicado' | 'ignorado'
  aplicado_em     TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT now()
);

-- RLS: somente admin e marketing
ALTER TABLE google_ads_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_metas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campanhas_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_keywords     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_insights_ia  ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados (via serviço) leem e escrevem
CREATE POLICY "auth_full" ON google_ads_config      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full" ON marketing_metas         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full" ON marketing_campanhas_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full" ON marketing_keywords      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full" ON marketing_insights_ia   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mkt_campanhas_data   ON marketing_campanhas_ads(data_snapshot);
CREATE INDEX IF NOT EXISTS idx_mkt_campanhas_id     ON marketing_campanhas_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_keywords_tipo    ON marketing_keywords(tipo);
CREATE INDEX IF NOT EXISTS idx_mkt_keywords_camp    ON marketing_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_insights_status  ON marketing_insights_ia(status);
