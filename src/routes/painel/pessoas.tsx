import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase, PERFIS } from "@/lib/supabase";
import type { Usuario, Perfil } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Search, MoreVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pessoas")({
  component: PessoasPage,
});

type ModalMode = "criar" | "editar" | null;

function PessoasPage() {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [selecionado, setSelecionado] = useState<Usuario | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    perfil: "vendedor" as Perfil,
    ativo: true,
  });

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    setCarregando(true);
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .order("criado_em", { ascending: false });
    if (data) setUsuarios(data as Usuario[]);
    setCarregando(false);
  }

  function abrirCriar() {
    setForm({ nome: "", email: "", senha: "", perfil: "vendedor", ativo: true });
    setSelecionado(null);
    setErro(null);
    setModal("criar");
  }

  function abrirEditar(u: Usuario) {
    setForm({ nome: u.nome, email: u.email, senha: "", perfil: u.perfil, ativo: u.ativo });
    setSelecionado(u);
    setErro(null);
    setModal("editar");
    setMenuAberto(null);
  }

  async function salvar() {
    setErro(null);
    if (!form.nome.trim() || !form.email.trim()) {
      setErro("Nome e e-mail são obrigatórios.");
      return;
    }

    if (modal === "criar") {
      if (!form.senha || form.senha.length < 6) {
        setErro("Senha deve ter pelo menos 6 caracteres.");
        return;
      }
      // Cria usuário no Supabase Auth via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: { data: { nome: form.nome } },
      });
      if (authError) {
        setErro("Erro ao criar usuário: " + authError.message);
        return;
      }
      const userId = authData.user?.id;
      if (!userId) {
        setErro("Erro ao obter ID do usuário criado.");
        return;
      }
      // Insere na tabela usuarios
      const { error: dbError } = await supabase.from("usuarios").insert({
        id: userId,
        email: form.email,
        nome: form.nome,
        perfil: form.perfil,
        ativo: form.ativo,
      });
      if (dbError) {
        setErro("Erro ao salvar perfil: " + dbError.message);
        return;
      }
      setSucesso("Usuário criado com sucesso!");
    } else if (modal === "editar" && selecionado) {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome: form.nome, perfil: form.perfil, ativo: form.ativo })
        .eq("id", selecionado.id);
      if (error) {
        setErro("Erro ao atualizar: " + error.message);
        return;
      }
      setSucesso("Usuário atualizado!");
    }

    setModal(null);
    carregarUsuarios();
    setTimeout(() => setSucesso(null), 3000);
  }

  async function alternarAtivo(u: Usuario) {
    await supabase.from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    setMenuAberto(null);
    carregarUsuarios();
  }

  const filtrados = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  const podeGerenciar = usuarioLogado?.perfil === "admin";

  return (
    <div className="p-8">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Pessoas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {usuarios.length} colaborador{usuarios.length !== 1 ? "es" : ""} cadastrado{usuarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        {podeGerenciar && (
          <button
            onClick={abrirCriar}
            className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155824]"
          >
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Sucesso */}
      {sucesso && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="h-4 w-4" />
          {sucesso}
        </div>
      )}

      {/* Busca */}
      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserPlus className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">E-mail</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                {podeGerenciar && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{u.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", PERFIS[u.perfil]?.cor)}>
                      {PERFIS[u.perfil]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      u.ativo ? "text-green-600" : "text-gray-400"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", u.ativo ? "bg-green-500" : "bg-gray-300")} />
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {podeGerenciar && (
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setMenuAberto(menuAberto === u.id ? null : u.id);
                          }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Criar / Editar */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {modal === "criar" ? "Novo Usuário" : "Editar Usuário"}
              </h2>
              <button onClick={() => setModal(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome completo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={modal === "editar"}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {modal === "criar" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Senha inicial</label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Perfil de acesso</label>
                <select
                  value={form.perfil}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
                >
                  {Object.entries(PERFIS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-[#1a6b2f]"
                />
                <label htmlFor="ativo" className="text-sm text-gray-700">Usuário ativo</label>
              </div>

              {erro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155824]"
                >
                  {modal === "criar" ? "Criar Usuário" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown menu via portal — escapa do overflow:hidden da tabela */}
      {menuAberto && createPortal(
        <>
          {/* Overlay invisível para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(null)} />
          {/* Menu posicionado com fixed nas coords reais do botão */}
          <div
            className="fixed z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {filtrados.filter(u => u.id === menuAberto).map(u => (
              <div key={u.id}>
                <button
                  onClick={() => abrirEditar(u)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  ✏️ Editar usuário
                </button>
                <button
                  onClick={() => alternarAtivo(u)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  {u.ativo
                    ? <span className="text-red-600">🔴 Desativar</span>
                    : <span className="text-green-600">🟢 Ativar</span>}
                </button>
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
