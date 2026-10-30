-- ══════════════════════════════════════════════════════════════════════════
-- PORTIBRAS — Migration: Fluxo Cliente → CRM → Logística
-- Execute no Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. TABELA CLIENTES (banco de dados central de clientes)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  cnpj                TEXT,
  endereco            TEXT,
  bairro              TEXT,
  cidade              TEXT DEFAULT 'Rio de Janeiro',
  uf                  TEXT DEFAULT 'RJ',
  cep                 TEXT,
  -- Contato principal
  sindico             TEXT,
  telefone            TEXT,
  whatsapp            TEXT,
  email               TEXT,
  -- Contato financeiro
  email_financeiro    TEXT,
  telefone_financeiro TEXT,
  -- Dados técnicos
  tipo_edificio       TEXT,                         -- Residencial / Comercial / Hotel / Shopping / ...
  qtd_andares         INTEGER,
  qtd_portas_cf       INTEGER,                      -- qtd de portas corta-fogo no edifício
  -- Status e controle
  status              TEXT NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo','inativo','prospect')),
  data_ultima_vistoria DATE,
  observacoes         TEXT,
  -- Auditoria
  criado_por          UUID REFERENCES public.usuarios(id),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger atualizado_em
DROP TRIGGER IF EXISTS trg_clientes_atualizado ON public.clientes;
CREATE TRIGGER trg_clientes_atualizado
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. VINCULAR CRM_PROPOSTAS AO CLIENTE (opção A — sem quebrar dados)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.crm_propostas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- Campo para indicar se foi enviado para logística e quando
ALTER TABLE public.crm_propostas
  ADD COLUMN IF NOT EXISTS enviado_logistica BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.crm_propostas
  ADD COLUMN IF NOT EXISTS enviado_logistica_em TIMESTAMPTZ;

ALTER TABLE public.crm_propostas
  ADD COLUMN IF NOT EXISTS atendimento_id UUID; -- será preenchido ao criar atendimento


-- ─────────────────────────────────────────────────────────────────────────
-- 3. TABELA ATENDIMENTOS (logística — gestão de campo)
--    Espelha "Gestão de Atividades" do Notion
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atendimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculo
  cliente_id            UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  proposta_id           UUID REFERENCES public.crm_propostas(id) ON DELETE SET NULL,
  -- Dados do atendimento
  titulo                TEXT NOT NULL,
  classificacao         TEXT NOT NULL DEFAULT 'Serviço'
                        CHECK (classificacao IN ('Serviço','Vistoria','Retorno','Operacional','Terceirizados')),
  status                TEXT NOT NULL DEFAULT 'Programado'
                        CHECK (status IN ('Programado','Em andamento','Concluído','Cancelado')),
  -- Agendamento
  data_agendada         DATE,
  hora_inicio           TIME,
  hora_fim              TIME,
  -- Execução
  responsaveis          TEXT[] NOT NULL DEFAULT '{}',  -- nomes dos técnicos
  endereco              TEXT,                          -- puxado do cliente, pode sobrescrever
  atividade             TEXT,                          -- descrição rápida da atividade
  descricao             TEXT,                          -- descrição detalhada
  -- Campos do Notion (campo)
  agendado_com_cliente  BOOLEAN NOT NULL DEFAULT false,
  em_sistema            BOOLEAN NOT NULL DEFAULT false,  -- lançado no AppSheet
  -- Resultado
  relatorio_campo       TEXT,                          -- observações pós-atendimento
  fotos_urls            TEXT[] DEFAULT '{}',
  -- Auditoria
  criado_por            UUID REFERENCES public.usuarios(id),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atendimentos_select" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_insert" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_update" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_delete" ON public.atendimentos;

CREATE POLICY "atendimentos_select" ON public.atendimentos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "atendimentos_insert" ON public.atendimentos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "atendimentos_update" ON public.atendimentos
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "atendimentos_delete" ON public.atendimentos
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger atualizado_em
DROP TRIGGER IF EXISTS trg_atendimentos_atualizado ON public.atendimentos;
CREATE TRIGGER trg_atendimentos_atualizado
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Fechar o FK circular (atendimento_id em crm_propostas)
ALTER TABLE public.crm_propostas
  ADD CONSTRAINT fk_crm_propostas_atendimento
  FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE SET NULL
  NOT VALID;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. TABELA MATERIAIS DO ATENDIMENTO (compras vinculadas ao campo)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atendimentos_materiais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id    UUID NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  -- O que foi comprado
  descricao         TEXT NOT NULL,
  codigo            TEXT,                     -- código interno (D1, F1, PCF1 etc.)
  quantidade        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade           TEXT NOT NULL DEFAULT 'un',
  valor_unitario    NUMERIC(12,2),
  valor_total       NUMERIC(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  fornecedor        TEXT,
  link_compra       TEXT,
  -- Fluxo do material
  status            TEXT NOT NULL DEFAULT 'Solicitado'
                    CHECK (status IN ('Solicitado','Comprado','Chegou no escritório','Enviado ao campo','Instalado')),
  data_solicitacao  DATE DEFAULT CURRENT_DATE,
  data_compra       DATE,
  data_chegada      DATE,
  data_envio        DATE,
  -- Notas
  observacoes       TEXT,
  -- Auditoria
  criado_por        UUID REFERENCES public.usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.atendimentos_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mat_select" ON public.atendimentos_materiais;
DROP POLICY IF EXISTS "mat_insert" ON public.atendimentos_materiais;
DROP POLICY IF EXISTS "mat_update" ON public.atendimentos_materiais;
DROP POLICY IF EXISTS "mat_delete" ON public.atendimentos_materiais;

CREATE POLICY "mat_select" ON public.atendimentos_materiais
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "mat_insert" ON public.atendimentos_materiais
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "mat_update" ON public.atendimentos_materiais
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "mat_delete" ON public.atendimentos_materiais
  FOR DELETE USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_materiais_atualizado ON public.atendimentos_materiais;
CREATE TRIGGER trg_materiais_atualizado
  BEFORE UPDATE ON public.atendimentos_materiais
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();


-- ─────────────────────────────────────────────────────────────────────────
-- 5. VERIFICAÇÃO FINAL
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c2
   WHERE c2.table_name = t.table_name AND c2.table_schema = 'public') AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('clientes','atendimentos','atendimentos_materiais','crm_propostas')
ORDER BY table_name;
