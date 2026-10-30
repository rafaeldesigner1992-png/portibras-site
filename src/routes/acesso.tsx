import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/acesso")({
  component: AcessoPage,
});

function AcessoPage() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Se já logado, redireciona
  if (usuario) {
    navigate({ to: "/painel" });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await login(email, senha);
    setCarregando(false);
    if (error) {
      setErro(error);
    } else {
      navigate({ to: "/painel" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a6b2f] shadow-lg">
            <span className="text-2xl font-black text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PORTIBRAS</h1>
          <p className="mt-1 text-sm text-gray-500">Área de Membros</p>
        </div>

        {/* Card de Login */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">Entrar na sua conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>

            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="mt-2 w-full rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155824] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} PORTIBRAS — Acesso restrito
        </p>
      </div>
    </div>
  );
}
