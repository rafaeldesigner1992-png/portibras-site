-- BPO: margem de meta de vendas e histórico de chat
-- Execute no Supabase Dashboard > SQL Editor

-- Insere valor padrão da margem (20%) na tabela configuracoes
INSERT INTO configuracoes (chave, valor)
VALUES ('margem_meta_pct', '20')
ON CONFLICT (chave) DO NOTHING;

-- Histórico de mensagens do chat BPO por usuário/mês
CREATE TABLE IF NOT EXISTS bpo_chat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  conteudo    text NOT NULL,
  criado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bpo_chat_user_idx ON bpo_chat(user_id, criado_em DESC);

ALTER TABLE bpo_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve proprio chat" ON bpo_chat
  FOR ALL USING (auth.uid() = user_id);
