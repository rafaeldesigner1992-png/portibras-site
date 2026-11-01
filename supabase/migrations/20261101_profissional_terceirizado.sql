-- Adiciona campo terceirizado em logistica_profissionais
-- false = profissional próprio (Rafael Nunes) — tempo conta mas custo = R$0
-- true  = terceirizado (Pedreiro, Ajudante, Pintor, Placa fotoluminescente)
ALTER TABLE logistica_profissionais
  ADD COLUMN IF NOT EXISTS terceirizado boolean NOT NULL DEFAULT true;
