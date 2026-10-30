import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Usuario, Perfil } from "@/lib/supabase";

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  temAcesso: (modulo: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACESSO_POR_PERFIL: Record<Perfil, string[]> = {
  admin: ["dashboard", "crm", "contratos", "orcamentos", "pessoas", "logistica", "financeiro"],
  vendedor: ["crm", "contratos", "orcamentos"],
  tecnico: ["logistica"],
  financeiro: ["dashboard", "financeiro"],
  logistica: ["logistica"],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        buscarPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Ouvir mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        buscarPerfil(session.user.id);
      } else {
        setUsuario(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function buscarPerfil(userId: string) {
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUsuario(data as Usuario);
    }
    setLoading(false);
  }

  async function login(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      return { error: "E-mail ou senha incorretos." };
    }
    return { error: null };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUsuario(null);
  }

  function temAcesso(modulo: string) {
    if (!usuario) return false;
    return ACESSO_POR_PERFIL[usuario.perfil]?.includes(modulo) ?? false;
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, temAcesso }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
