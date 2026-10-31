import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odmuutijqikhzlgzjnwv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbXV1dGlqcWlraHpsZ3pqbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTkzNTYsImV4cCI6MjEwODkzNTM1Nn0.grjNr7wSnvDEvnVT-dzbhezNHdYsDsBLJM-ijoZ4mTE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Perfil =
  | "admin"
  | "vendedor"
  | "tecnico"
  | "financeiro"
  | "logistica";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
  criado_em: string;
}

export const PERFIS: Record<Perfil, { label: string; cor: string }> = {
  admin: { label: "Administrador", cor: "bg-red-100 text-red-800" },
  vendedor: { label: "Vendedor", cor: "bg-blue-100 text-blue-800" },
  tecnico: { label: "Técnico", cor: "bg-yellow-100 text-yellow-800" },
  financeiro: { label: "Financeiro", cor: "bg-green-100 text-green-800" },
  logistica: { label: "Logística", cor: "bg-purple-100 text-purple-800" },
};

export const ACESSO_POR_PERFIL: Record<Perfil, string[]> = {
  admin: ["dashboard", "crm", "contratos", "orcamentos", "pessoas", "logistica", "financeiro", "organograma"],
  vendedor: ["crm", "contratos", "orcamentos"],
  tecnico: ["logistica"],
  financeiro: ["dashboard", "financeiro"],
  logistica: ["logistica"],
};
