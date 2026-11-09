-- Adiciona ca_cliente_id em ca_vendas para cruzamento mais preciso com clientes
ALTER TABLE public.ca_vendas
  ADD COLUMN IF NOT EXISTS ca_cliente_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ca_vendas_ca_cliente_id ON public.ca_vendas(ca_cliente_id);

-- Adiciona ca_cliente_id na tabela clientes para rastrear o ID do cliente no Conta Azul
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ca_cliente_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_clientes_ca_cliente_id ON public.clientes(ca_cliente_id);

-- ============================================================
-- Atualiza fn_atualizar_status_clientes para usar ca_cliente_id
-- quando disponível, com fallback por nome
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_atualizar_status_clientes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff DATE := CURRENT_DATE - INTERVAL '6 months';
  v_ativos   INT;
  v_inativos INT;
BEGIN

  -- ATIVA clientes com venda de serviço nos últimos 6 meses
  -- Prioridade: cruzamento por ca_cliente_id; fallback por nome
  UPDATE public.clientes c
  SET status = 'ativo'
  WHERE c.status = 'inativo'
    AND EXISTS (
      SELECT 1
      FROM public.ca_vendas v
      WHERE (
        -- Cruzamento por ID do CA (mais preciso) quando disponível
        (c.ca_cliente_id <> '' AND v.ca_cliente_id <> '' AND v.ca_cliente_id = c.ca_cliente_id)
        OR
        -- Fallback por nome (normalizado)
        (LOWER(TRIM(v.cliente_nome)) = LOWER(TRIM(c.nome)))
      )
        AND v.data_emissao::DATE >= v_cutoff
      LIMIT 1
    );

  GET DIAGNOSTICS v_ativos = ROW_COUNT;

  -- INATIVA clientes sem venda de serviço nos últimos 6 meses
  UPDATE public.clientes c
  SET status = 'inativo'
  WHERE c.status = 'ativo'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ca_vendas v
      WHERE (
        (c.ca_cliente_id <> '' AND v.ca_cliente_id <> '' AND v.ca_cliente_id = c.ca_cliente_id)
        OR
        (LOWER(TRIM(v.cliente_nome)) = LOWER(TRIM(c.nome)))
      )
        AND v.data_emissao::DATE >= v_cutoff
      LIMIT 1
    );

  GET DIAGNOSTICS v_inativos = ROW_COUNT;

  RAISE NOTICE 'Clientes → ativados: %, inativados: %', v_ativos, v_inativos;

END;
$$;

-- Executa imediatamente com a lógica atualizada
SELECT public.fn_atualizar_status_clientes();
