-- Migration: adiciona coluna para vincular orçamento do Conta Azul ao lead
-- O campo armazena o ID do orçamento (UUID) extraído do link colado pelo usuário

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS orcamento_conta_azul_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.crm_leads.orcamento_conta_azul_id IS
  'ID do orçamento no Conta Azul (UUID extraído do link). Ex: app.contaazul.com/sales/quotes/{id}';
