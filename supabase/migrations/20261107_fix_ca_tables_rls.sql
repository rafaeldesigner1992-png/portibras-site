-- Fix: RLS das tabelas ca_* bloqueando leitura pelo frontend
-- Problema: policies antigas conflitantes impedindo SELECT pelo usuário autenticado
-- Solução: dropar TODAS as policies existentes e recriar corretamente

-- ─── ca_vendas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read_ca_vendas"    ON ca_vendas;
DROP POLICY IF EXISTS "service_write_ca_vendas"         ON ca_vendas;
DROP POLICY IF EXISTS "Acesso autenticado ca_vendas"    ON ca_vendas;
DROP POLICY IF EXISTS "ca_vendas_read"                  ON ca_vendas;
DROP POLICY IF EXISTS "ca_vendas_write"                 ON ca_vendas;

CREATE POLICY "ca_vendas_read"
  ON ca_vendas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ca_vendas_service_write"
  ON ca_vendas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ca_cobrancas ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read_ca_cobrancas" ON ca_cobrancas;
DROP POLICY IF EXISTS "service_write_ca_cobrancas"      ON ca_cobrancas;
DROP POLICY IF EXISTS "Acesso autenticado ca_cobrancas" ON ca_cobrancas;
DROP POLICY IF EXISTS "ca_cobrancas_read"               ON ca_cobrancas;
DROP POLICY IF EXISTS "ca_cobrancas_write"              ON ca_cobrancas;

CREATE POLICY "ca_cobrancas_read"
  ON ca_cobrancas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ca_cobrancas_service_write"
  ON ca_cobrancas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ca_contratos ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read_ca_contratos" ON ca_contratos;
DROP POLICY IF EXISTS "service_write_ca_contratos"      ON ca_contratos;
DROP POLICY IF EXISTS "Acesso autenticado ca_contratos" ON ca_contratos;
DROP POLICY IF EXISTS "ca_contratos_read"               ON ca_contratos;
DROP POLICY IF EXISTS "ca_contratos_write"              ON ca_contratos;

CREATE POLICY "ca_contratos_read"
  ON ca_contratos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ca_contratos_service_write"
  ON ca_contratos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ca_saldos ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_saldos_read"           ON ca_saldos;
DROP POLICY IF EXISTS "ca_saldos_service_write"  ON ca_saldos;
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
DROP POLICY IF EXISTS "ca_contas_pagar_read"          ON ca_contas_pagar;
DROP POLICY IF EXISTS "ca_contas_pagar_service_write" ON ca_contas_pagar;
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
