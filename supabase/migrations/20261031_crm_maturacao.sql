-- Adiciona campos de maturação do lead
-- data_inicio: quando o lead foi criado (entrada no funil)
-- data_fechamento: quando o lead foi marcado como Fechado ou Perdido

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS data_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS data_fechamento timestamptz;

-- Retroativo: preenche data_inicio com criado_em para leads existentes
UPDATE crm_leads
SET data_inicio = criado_em
WHERE data_inicio IS NULL AND criado_em IS NOT NULL;

-- Retroativo: preenche data_fechamento para leads já fechados/perdidos
-- Usa criado_em como fallback pois não temos a data real de fechamento
UPDATE crm_leads
SET data_fechamento = criado_em
WHERE data_fechamento IS NULL
  AND etapa IN ('fechado', 'perdido')
  AND criado_em IS NOT NULL;
