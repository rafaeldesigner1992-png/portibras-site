-- ============================================================
-- Auto-atualização de status de clientes via CA Vendas
-- Regra: cliente com venda nos últimos 6 meses → ativo
--        cliente SEM venda nos últimos 6 meses → inativo
--        (clientes com status 'prospect' nunca são alterados aqui)
-- ============================================================

-- 1. Função principal
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

  -- Ativa clientes que tiveram venda nos últimos 6 meses
  -- e que ainda não estão ativos (evita writes desnecessários)
  UPDATE public.clientes c
  SET status = 'ativo'
  WHERE c.status = 'inativo'
    AND EXISTS (
      SELECT 1
      FROM public.ca_vendas v
      WHERE LOWER(TRIM(v.cliente_nome)) = LOWER(TRIM(c.nome))
        AND v.data_emissao::DATE >= v_cutoff
      LIMIT 1
    );

  GET DIAGNOSTICS v_ativos = ROW_COUNT;

  -- Inativa clientes que NÃO tiveram venda nos últimos 6 meses
  -- (somente quem está ativo; prospects ficam intocados)
  UPDATE public.clientes c
  SET status = 'inativo'
  WHERE c.status = 'ativo'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ca_vendas v
      WHERE LOWER(TRIM(v.cliente_nome)) = LOWER(TRIM(c.nome))
        AND v.data_emissao::DATE >= v_cutoff
      LIMIT 1
    );

  GET DIAGNOSTICS v_inativos = ROW_COUNT;

  -- Log opcional (remove se não quiser)
  RAISE NOTICE 'Clientes atualizados → ativados: %, inativados: %', v_ativos, v_inativos;

END;
$$;

-- 2. Concede permissão de execução para o service_role (usado pelo cron)
GRANT EXECUTE ON FUNCTION public.fn_atualizar_status_clientes() TO service_role;

-- 3. Habilita pg_cron (já vem disponível no Supabase)
-- Se não estiver habilitado: Dashboard → Extensions → pg_cron → Enable
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Remove cron anterior se existir (idempotente)
SELECT cron.unschedule('atualizar-status-clientes')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'atualizar-status-clientes'
  );

-- 5. Agenda execução diária às 03:00 (horário Supabase / UTC)
--    03:00 UTC = meia-noite em Brasília (UTC-3)
SELECT cron.schedule(
  'atualizar-status-clientes',
  '0 3 * * *',
  $job$
    SELECT public.fn_atualizar_status_clientes();
  $job$
);

-- 6. Executa imediatamente para sincronizar agora
SELECT public.fn_atualizar_status_clientes();

-- ============================================================
-- Para verificar agendamentos ativos:
--   SELECT * FROM cron.job;
-- Para executar manualmente:
--   SELECT public.fn_atualizar_status_clientes();
-- ============================================================
