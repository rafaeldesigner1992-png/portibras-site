-- Fix: RLS da tabela configuracoes bloqueava leitura pelo frontend autenticado
-- A policy "service_role_all" sem "TO service_role" não cobria usuários autenticados.
-- Também corrige service_role write em ca_saldos e ca_contas_pagar.

-- ─── configuracoes: adiciona coluna descricao se não existir ─────────────────
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS descricao text;

-- ─── configuracoes ────────────────────────────────────────────────────────────
-- Remove policies conflitantes criadas pelas migrations anteriores
DROP POLICY IF EXISTS "service_role_all"  ON configuracoes;
DROP POLICY IF EXISTS "config_read"       ON configuracoes;
DROP POLICY IF EXISTS "config_write"      ON configuracoes;

-- Usuários autenticados podem ler qualquer chave de configuração
CREATE POLICY "cfg_authenticated_read"
  ON configuracoes FOR SELECT
  TO authenticated
  USING (true);

-- Apenas service_role (Edge Functions) pode inserir/atualizar/deletar
CREATE POLICY "cfg_service_write"
  ON configuracoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ca_saldos ────────────────────────────────────────────────────────────────
-- Recria policy para separar read (authenticated) e write (service_role)
DROP POLICY IF EXISTS "Acesso autenticado ca_saldos" ON ca_saldos;

CREATE POLICY "ca_saldos_read"
  ON ca_saldos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ca_saldos_service_write"
  ON ca_saldos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ca_contas_pagar ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Acesso autenticado ca_contas_pagar" ON ca_contas_pagar;

CREATE POLICY "ca_contas_pagar_read"
  ON ca_contas_pagar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ca_contas_pagar_service_write"
  ON ca_contas_pagar FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
