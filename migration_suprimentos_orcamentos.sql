-- =============================================================
-- Migration: logistica_suprimentos + crm_orcamentos
-- Projeto: Portibras
-- Data: 2026-10-30
-- =============================================================

-- ------------------------------------------------------------
-- 1. TABELA: logistica_suprimentos
--    Catálogo de materiais/peças com custo e link de compra
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistica_suprimentos (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT          NOT NULL,
  codigo        TEXT,
  categoria     TEXT,
  unidade       TEXT          NOT NULL DEFAULT 'un',
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  link_compra   TEXT,
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_logistica_suprimentos_nome
  ON public.logistica_suprimentos (nome);

CREATE INDEX IF NOT EXISTS idx_logistica_suprimentos_codigo
  ON public.logistica_suprimentos (codigo);

-- RLS
ALTER TABLE public.logistica_suprimentos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado pode ver o catálogo
CREATE POLICY "suprimentos_select" ON public.logistica_suprimentos
  FOR SELECT TO authenticated USING (true);

-- Escrita: apenas usuários com role logistica ou admin
CREATE POLICY "suprimentos_insert" ON public.logistica_suprimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'logistica')
    )
  );

CREATE POLICY "suprimentos_update" ON public.logistica_suprimentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'logistica')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'logistica')
    )
  );

CREATE POLICY "suprimentos_delete" ON public.logistica_suprimentos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'logistica')
    )
  );

-- ------------------------------------------------------------
-- 2. TABELA: crm_orcamentos
--    Orçamento calculado por vendedor, vinculado a um lead
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_orcamentos (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID          NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  itens         JSONB         NOT NULL DEFAULT '[]'::jsonb,
  custo_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  margem_pct    NUMERIC(5,2)  NOT NULL DEFAULT 30,
  imposto_pct   NUMERIC(5,2)  NOT NULL DEFAULT 10,
  preco_final   NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes   TEXT          NOT NULL DEFAULT '',
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para busca rápida por lead
CREATE INDEX IF NOT EXISTS idx_crm_orcamentos_lead_id
  ON public.crm_orcamentos (lead_id);

-- RLS
ALTER TABLE public.crm_orcamentos ENABLE ROW LEVEL SECURITY;

-- Leitura: autenticados podem ver todos os orçamentos
CREATE POLICY "orcamentos_select" ON public.crm_orcamentos
  FOR SELECT TO authenticated USING (true);

-- Criação: vendedores, admin e financeiro podem criar
CREATE POLICY "orcamentos_insert" ON public.crm_orcamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'vendedor', 'financeiro')
    )
  );

-- Atualização: mesmos roles podem atualizar
CREATE POLICY "orcamentos_update" ON public.crm_orcamentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'vendedor', 'financeiro')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'vendedor', 'financeiro')
    )
  );

-- Deleção: apenas admin
CREATE POLICY "orcamentos_delete" ON public.crm_orcamentos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 3. DADOS INICIAIS (opcional)
--    Alguns suprimentos de exemplo para testar
-- ------------------------------------------------------------
INSERT INTO public.logistica_suprimentos (nome, codigo, categoria, unidade, custo_unitario, atualizado_em)
VALUES
  ('Cabo elétrico 2,5mm²',   'CAB-025',  'Elétrico',  'm',   3.50,  NOW()),
  ('Cabo elétrico 4mm²',     'CAB-040',  'Elétrico',  'm',   5.20,  NOW()),
  ('Disjuntor 20A',          'DIS-020',  'Elétrico',  'un',  22.90, NOW()),
  ('Disjuntor 30A',          'DIS-030',  'Elétrico',  'un',  25.50, NOW()),
  ('Eletroduto corrugado',   'ELE-COR',  'Elétrico',  'm',   2.80,  NOW()),
  ('Tomada 2P+T 10A',        'TOM-10A',  'Elétrico',  'un',  8.90,  NOW()),
  ('Interruptor simples',    'INT-SIM',  'Elétrico',  'un',  7.50,  NOW()),
  ('Parafuso M6 x 20',       'PAR-M6',   'Fixação',   'cx',  18.00, NOW()),
  ('Abraçadeira plástica',   'ABR-P',    'Fixação',   'cx',  12.00, NOW()),
  ('Fita isolante 20m',      'FIT-ISO',  'Proteção',  'un',  6.50,  NOW())
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Fim do migration
-- ------------------------------------------------------------
