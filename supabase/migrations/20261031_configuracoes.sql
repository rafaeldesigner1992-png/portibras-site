-- Tabela de configurações do sistema (chave/valor)
CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text UNIQUE NOT NULL,
  valor text NOT NULL,
  atualizado_em timestamptz DEFAULT now()
);

-- RLS: apenas service role pode ler/escrever (tokens OAuth são sensíveis)
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Política para service role (Edge Functions usam service key)
CREATE POLICY IF NOT EXISTS "service_role_all" ON configuracoes
  FOR ALL USING (true);
