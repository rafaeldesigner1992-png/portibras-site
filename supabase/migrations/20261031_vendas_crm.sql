-- Vincula lançamentos financeiros ao lead do CRM que originou a venda
-- Execute no Supabase Dashboard > SQL Editor

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES crm_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fin_lanc_crm_lead_idx ON financeiro_lancamentos(crm_lead_id);

-- Categoria padrão "Vendas CRM" para facilitar filtros
-- (se a tabela tiver enum de categorias, adaptar conforme necessário)
