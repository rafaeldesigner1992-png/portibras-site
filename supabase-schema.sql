-- ============================================================
-- PORTIBRAS — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- Pode ser executado múltiplas vezes sem erros (idempotente)
-- ============================================================

-- ───────────────────────────────────────────
-- 1. TABELA DE USUÁRIOS (perfis internos)
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  perfil      TEXT NOT NULL CHECK (perfil IN ('admin','vendedor','tecnico','financeiro','logistica')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.usuarios u2
      WHERE u2.id = auth.uid() AND u2.perfil = 'admin'
    )
  );

CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u2
      WHERE u2.id = auth.uid() AND u2.perfil = 'admin'
    )
  );

CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.usuarios u2
      WHERE u2.id = auth.uid() AND u2.perfil = 'admin'
    )
  );


-- ───────────────────────────────────────────
-- 2. CRM — LEADS / PIPELINE
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  empresa         TEXT,
  telefone        TEXT,
  email           TEXT,
  etapa           TEXT NOT NULL DEFAULT 'prospecto'
                  CHECK (etapa IN ('prospecto','contato','proposta','negociacao','fechado','perdido')),
  valor_estimado  NUMERIC(12,2),
  observacoes     TEXT,
  responsavel_id  UUID REFERENCES public.usuarios(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_leads_all" ON public.crm_leads;

CREATE POLICY "crm_leads_all" ON public.crm_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil IN ('admin','vendedor')
    )
  );

-- ───────────────────────────────────────────
-- 3. CONTRATOS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contratos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT,
  cliente_nome    TEXT NOT NULL,
  cliente_cnpj    TEXT,
  cliente_end     TEXT,
  valor_total     NUMERIC(12,2),
  parcelas        INTEGER DEFAULT 12,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviado','assinado','cancelado')),
  pdf_url         TEXT,
  criado_por      UUID REFERENCES public.usuarios(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_all" ON public.contratos;

CREATE POLICY "contratos_all" ON public.contratos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil IN ('admin','vendedor')
    )
  );

-- ───────────────────────────────────────────
-- 4. ORÇAMENTOS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT,
  cliente_nome    TEXT NOT NULL,
  itens           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(12,2),
  desconto        NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2),
  observacoes     TEXT,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviado','aprovado','recusado')),
  criado_por      UUID REFERENCES public.usuarios(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamentos_all" ON public.orcamentos;

CREATE POLICY "orcamentos_all" ON public.orcamentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil IN ('admin','vendedor')
    )
  );

-- ───────────────────────────────────────────
-- 5. LOGÍSTICA — ESTOQUE
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistica_estoque (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  codigo          TEXT,
  categoria       TEXT,
  quantidade      NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidade         TEXT NOT NULL DEFAULT 'un',
  localizacao     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.logistica_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistica_all" ON public.logistica_estoque;

CREATE POLICY "logistica_all" ON public.logistica_estoque
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil IN ('admin','logistica','tecnico')
    )
  );

-- ───────────────────────────────────────────
-- 6. FINANCEIRO — LANÇAMENTOS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao   TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  valor       NUMERIC(12,2) NOT NULL,
  categoria   TEXT,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  pago        BOOLEAN NOT NULL DEFAULT false,
  criado_por  UUID REFERENCES public.usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_all" ON public.financeiro_lancamentos;

CREATE POLICY "financeiro_all" ON public.financeiro_lancamentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil IN ('admin','financeiro')
    )
  );

-- ───────────────────────────────────────────
-- 7. STORAGE — Bucket para documentos
-- ───────────────────────────────────────────
-- Execute no painel do Supabase > Storage > New Bucket
-- Nome: portibras-docs
-- Public: false
-- Allowed MIME types: application/pdf, image/*, application/msword,
--   application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- ───────────────────────────────────────────
-- 8. PRIMEIRO USUÁRIO ADMIN (Rafael)
-- ───────────────────────────────────────────
-- Após criar o usuário pelo painel Auth > Users do Supabase,
-- copie o UUID gerado e execute:
--
-- INSERT INTO public.usuarios (id, email, nome, perfil)
-- VALUES (
--   '<UUID_DO_USUARIO_RAFAEL>',
--   'rafaeldesigner1992@gmail.com',
--   'Rafael',
--   'admin'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────
-- 9. TRIGGER: atualiza atualizado_em
-- ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_leads_atualizado ON public.crm_leads;
DROP TRIGGER IF EXISTS trg_logistica_atualizado ON public.logistica_estoque;

CREATE TRIGGER trg_crm_leads_atualizado
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trg_logistica_atualizado
  BEFORE UPDATE ON public.logistica_estoque
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
