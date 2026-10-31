-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANOGRAMA / RH — PORTIBRAS
-- Tabelas: cargos (vagas), funcionarios_cargos (vínculo usuário ↔ cargo)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. CARGOS / VAGAS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              TEXT NOT NULL,                    -- Nome do cargo (ex: "Técnico em Manutenção")
  cbo                 TEXT,                             -- Código Brasileiro de Ocupações (CBO)
  cbo_descricao       TEXT,                             -- Descrição oficial do CBO
  nivel               TEXT NOT NULL DEFAULT 'operacional'
                      CHECK (nivel IN ('diretoria','gerencia','coordenacao','operacional','estagio','terceirizado')),
  departamento        TEXT,                             -- Área/setor
  vagas_total         INTEGER NOT NULL DEFAULT 1,       -- Qtd de vagas previstas
  sindicato_nome      TEXT,                             -- Nome do sindicato responsável
  sindicato_cnpj      TEXT,                             -- CNPJ do sindicato
  convencao_coletiva  TEXT,                             -- Número/ano da CCT
  data_validade_cct   DATE,                             -- Validade da convenção coletiva
  clt_referencia      TEXT,                             -- Artigo CLT aplicável
  -- Salário base
  piso_salarial       NUMERIC(12,2),                   -- Piso da categoria (CCT ou CLT)
  salario_estimado    NUMERIC(12,2),                   -- Salário praticado estimado
  -- Benefícios obrigatórios (calculados automaticamente no front)
  vale_transporte     BOOLEAN NOT NULL DEFAULT true,
  vale_refeicao_valor NUMERIC(8,2) DEFAULT 0,          -- VR/dia em R$
  plano_saude         BOOLEAN NOT NULL DEFAULT false,
  -- Observações e última atualização sindical
  observacoes         TEXT,
  ultima_atualizacao_sindical TIMESTAMPTZ,
  dados_sindicato_json JSONB,                           -- Cache da última busca sindical
  ativo               BOOLEAN NOT NULL DEFAULT true,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cargos_admin_all" ON public.cargos;
CREATE POLICY "cargos_admin_all" ON public.cargos
  FOR ALL USING (
    (SELECT perfil FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "cargos_select_auth" ON public.cargos;
CREATE POLICY "cargos_select_auth" ON public.cargos
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. VÍNCULO USUÁRIO ↔ CARGO ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funcionarios_cargos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cargo_id      UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  data_inicio   DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim      DATE,                                    -- NULL = cargo atual
  salario_real  NUMERIC(12,2),                          -- Salário efetivo (confidencial)
  observacoes   TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, cargo_id, data_inicio)
);

ALTER TABLE public.funcionarios_cargos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fc_admin_all" ON public.funcionarios_cargos;
CREATE POLICY "fc_admin_all" ON public.funcionarios_cargos
  FOR ALL USING (
    (SELECT perfil FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- 3. TRIGGER atualizado_em ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cargos_atualizado ON public.cargos;
CREATE TRIGGER trg_cargos_atualizado
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- 4. SEED — cargos iniciais PORTIBRAS ────────────────────────────────────────
INSERT INTO public.cargos
  (titulo, cbo, nivel, departamento, vagas_total, sindicato_nome, convencao_coletiva, piso_salarial, vale_transporte, vale_refeicao_valor, observacoes)
VALUES
  ('Diretor Geral',            '1231-05', 'diretoria',    'Diretoria',       1, 'SINDESP-RJ',   NULL, 5000.00, false, 0,     'Sócio-proprietário'),
  ('Gerente Operacional',      '1412-05', 'gerencia',     'Operações',       1, 'SINDESP-RJ',   NULL, 3500.00, true,  25.00, NULL),
  ('Técnico em Manutenção',    '7156-10', 'operacional',  'Técnica',         4, 'SINTIMANI-RJ', NULL, 1800.00, true,  22.00, 'SECONCI aplicável'),
  ('Vendedor Externo',         '3542-05', 'operacional',  'Comercial',       2, 'SINDESP-RJ',   NULL, 1800.00, true,  22.00, 'Comissão sobre vendas'),
  ('Assistente Administrativo','4110-05', 'operacional',  'Administrativo',  1, 'SINDESP-RJ',   NULL, 1600.00, true,  22.00, NULL),
  ('Estagiário',               '3513-35', 'estagio',      'Administrativo',  1, NULL,            NULL,  900.00, true,  0,     'Lei de Estágio 11.788/08')
ON CONFLICT DO NOTHING;
