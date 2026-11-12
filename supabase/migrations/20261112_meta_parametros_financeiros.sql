-- Parâmetros do modelo financeiro da PORTIBRAS para cálculo da meta comercial
-- pct_recebimento: % do valor bruto da NFS-e que a empresa recebe (50% do pedido total)
-- pct_custo_material: % do valor bruto que vai para material (~40% do pedido total)
-- margem_meta_pct: margem de lucro líquida alvo sobre o valor bruto da NFS-e (38%)

insert into public.configuracoes (chave, valor, descricao)
values
  ('pct_recebimento',    '50', 'Percentual do valor bruto da NFS-e que a PORTIBRAS efetivamente recebe (padrão 50%)'),
  ('pct_custo_material', '40', 'Percentual do valor bruto da NFS-e destinado ao custo de materiais (padrão 40%)'),
  ('margem_meta_pct',    '38', 'Margem de lucro líquida alvo sobre o valor bruto da NFS-e (padrão 38%)')
on conflict (chave) do update
  set descricao = excluded.descricao;
  -- Não sobrescreve o valor para preservar customizações feitas pelo usuário
