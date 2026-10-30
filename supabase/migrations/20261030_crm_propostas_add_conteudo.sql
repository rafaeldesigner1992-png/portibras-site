-- Adiciona coluna conteudo se não existir
alter table public.crm_propostas
  add column if not exists conteudo jsonb;

-- Recarrega schema cache do PostgREST (necessário após ALTER TABLE)
notify pgrst, 'reload schema';
