-- ============================================================
-- Webhook: sincroniza tabela clientes → Google Sheets
-- Dispara em INSERT, UPDATE e DELETE
-- ============================================================

-- 1. Habilita extensão pg_net (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Função que chama a Edge Function via HTTP
CREATE OR REPLACE FUNCTION public.fn_sync_cliente_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload  JSONB;
  v_url      TEXT := 'https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/sync-google-sheets';
  v_anon_key TEXT := current_setting('app.settings.anon_key', true);
BEGIN

  -- Monta payload no mesmo formato do Supabase Webhook
  IF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object(
      'type',       'DELETE',
      'old_record', row_to_json(OLD)::jsonb
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_payload := jsonb_build_object(
      'type',   'INSERT',
      'record', row_to_json(NEW)::jsonb
    );
  ELSE
    v_payload := jsonb_build_object(
      'type',       'UPDATE',
      'record',     row_to_json(NEW)::jsonb,
      'old_record', row_to_json(OLD)::jsonb
    );
  END IF;

  -- Dispara HTTP assíncrono (não bloqueia a transação)
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body    := v_payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Remove trigger anterior se existir (idempotente)
DROP TRIGGER IF EXISTS trg_sync_cliente_sheets ON public.clientes;

-- 4. Cria trigger em INSERT, UPDATE, DELETE
CREATE TRIGGER trg_sync_cliente_sheets
  AFTER INSERT OR UPDATE OR DELETE
  ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_cliente_sheets();

-- ============================================================
-- IMPORTANTE: Após rodar esta migration, configurar no Supabase:
--
-- Dashboard → Settings → Edge Functions → Environment variables:
--   GOOGLE_SERVICE_ACCOUNT_JSON = { conteúdo do JSON da Service Account }
--
-- E em SQL Editor, definir a anon key para o trigger usar:
--   ALTER DATABASE postgres SET app.settings.anon_key = 'sua_anon_key_aqui';
--
-- Para sincronizar todos os clientes existentes de uma vez:
--   SELECT public.fn_sync_all_clientes_sheets();  (ver função abaixo)
-- ============================================================

-- 5. Função de sync completo (para primeira carga / reprocessar tudo)
CREATE OR REPLACE FUNCTION public.fn_sync_all_clientes_sheets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url      TEXT := 'https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/sync-google-sheets';
  v_anon_key TEXT := current_setting('app.settings.anon_key', true);
  v_cliente  RECORD;
BEGIN
  FOR v_cliente IN SELECT * FROM public.clientes LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
      ),
      body    := jsonb_build_object(
        'type',   'UPSERT',
        'record', row_to_json(v_cliente)::jsonb
      )
    );
  END LOOP;
END;
$$;
