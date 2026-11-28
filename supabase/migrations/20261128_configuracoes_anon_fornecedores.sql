-- Permite que a anon key (PWA calculadora) leia a lista de fornecedores
-- A policy existente cfg_authenticated_read cobre apenas usuários autenticados.
-- A PWA usa a anon key, então precisa de policy específica para leitura pública.

CREATE POLICY "cfg_anon_fornecedores_read"
  ON configuracoes FOR SELECT
  TO anon
  USING (chave = 'logistica_fornecedores');
