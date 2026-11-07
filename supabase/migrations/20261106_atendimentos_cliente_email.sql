-- Adiciona campos de contato do cliente à tabela atendimentos
-- Usados para envio de emails de confirmação, reagendamento, cancelamento e conclusão

alter table atendimentos
  add column if not exists cliente_nome  text,
  add column if not exists cliente_email text,
  add column if not exists cliente_email_cc text; -- emails em cópia separados por vírgula
