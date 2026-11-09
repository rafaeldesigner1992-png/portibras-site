-- ============================================================
-- Padronização do cadastro de clientes
-- Adiciona campos ausentes + corrige trigger com anon_key hardcoded
-- ============================================================

-- 1. Adicionar campos ausentes à tabela clientes (idempotente)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS perfil_tecnico TEXT;

-- Garantir que os demais campos padronizados existam
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnpj                TEXT,
  ADD COLUMN IF NOT EXISTS sindico             TEXT,
  ADD COLUMN IF NOT EXISTS telefone            TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS email_financeiro    TEXT,
  ADD COLUMN IF NOT EXISTS telefone_financeiro TEXT;

-- 2. Recriar trigger function com anon_key hardcoded (evita erro de permissão no ALTER DATABASE)
CREATE OR REPLACE FUNCTION public.fn_sync_cliente_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload  JSONB;
  v_url      TEXT := 'https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/sync-google-sheets';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbXV1dGlqcWlraHpsZ3pqbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTkzNTYsImV4cCI6MjEwODkzNTM1Nn0.grjNr7wSnvDEvnVT-dzbhezNHdYsDsBLJM-ijoZ4mTE';
BEGIN

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

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := v_payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Recriar trigger (idempotente)
DROP TRIGGER IF EXISTS trg_sync_cliente_sheets ON public.clientes;
CREATE TRIGGER trg_sync_cliente_sheets
  AFTER INSERT OR UPDATE OR DELETE
  ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_cliente_sheets();

-- 4. Atualizar fn_sync_all com anon_key hardcoded também
CREATE OR REPLACE FUNCTION public.fn_sync_all_clientes_sheets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url      TEXT := 'https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/sync-google-sheets';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbXV1dGlqcWlraHpsZ3pqbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTkzNTYsImV4cCI6MjEwODkzNTM1Nn0.grjNr7wSnvDEvnVT-dzbhezNHdYsDsBLJM-ijoZ4mTE';
  v_cliente  RECORD;
BEGIN
  FOR v_cliente IN SELECT * FROM public.clientes LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'type',   'UPSERT',
        'record', row_to_json(v_cliente)::jsonb
      )
    );
  END LOOP;
END;
$$;
