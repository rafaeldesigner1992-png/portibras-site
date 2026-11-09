-- Expande financeiro_dividas com campos do controle Notion
ALTER TABLE financeiro_dividas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'em_dia'
    CHECK (status IN ('em_dia', 'em_atraso', 'quitada', 'negociando')),
  ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS sinal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Atualiza categorias para incluir todas as opções do Notion
-- (a coluna já existe, apenas documenta as novas opções válidas)
-- Novo enum de categorias: Banco/Financeira, Fornecedor, Imposto/Governo,
-- Pessoal, Cartão, Serviço, Jurídico, Outro
