-- Adiciona campos faltantes na tabela ca_contratos
-- proximo_vencimento: data da próxima cobrança/vencimento do contrato

ALTER TABLE ca_contratos
  ADD COLUMN IF NOT EXISTS proximo_vencimento TIMESTAMPTZ;
