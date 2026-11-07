import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Settings,
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Pencil,
  X,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Suprimento = {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string | null;
  unidade: string;
  custo_unitario: number;
  tempo_instalacao_min: number;
  profissionais_ids: string[] | null;
  link_compra: string | null;
  atualizado_em: string | null;
};

const DIAS_ALERTA_SUP = 90;

function diasDesdeAtualizacaoSup(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const EMPTY_SUP: Partial<Suprimento> = {
  nome: "", codigo: "", categoria: "", unidade: "un",
  custo_unitario: 0, tempo_instalacao_min: 0,
  profissionais_ids: [], link_compra: "",
};

export const Route = createFileRoute("/painel/configuracoes")({
  component: ConfiguracoesPage,
});

// Seções disponíveis
const SECOES = [
  { id: "logistica", label: "Logística", icon: Package },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "crm", label: "CRM", icon: Users },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function useConfiguracao(chave: string, padrao: string[]) {
  const [valores, setValores] = useState<string[]>(padrao);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<"ok" | "erro" | null>(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();
      if (data?.valor) {
        try { setValores(JSON.parse(data.valor)); } catch { /* mantém padrão */ }
      }
      setCarregando(false);
    })();
  }, [chave]);

  async function salvar(novos: string[]) {
    setSalvando(true);
    setFeedback(null);
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave, valor: JSON.stringify(novos) }, { onConflict: "chave" });
    setSalvando(false);
    setFeedback(error ? "erro" : "ok");
    if (!error) setValores(novos);
    setTimeout(() => setFeedback(null), 3000);
  }

  return { valores, setValores, carregando, salvando, feedback, salvar };
}

// ─── Painel de lista editável genérica ───────────────────────────────────────

function ListaEditavel({
  titulo,
  descricao,
  chave,
  padrao,
  placeholder,
}: {
  titulo: string;
  descricao: string;
  chave: string;
  padrao: string[];
  placeholder: string;
}) {
  const { valores, setValores, carregando, salvando, feedback, salvar } =
    useConfiguracao(chave, padrao);
  const [novo, setNovo] = useState("");

  function adicionar() {
    const v = novo.trim();
    if (!v || valores.includes(v)) return;
    setValores((prev) => [...prev, v]);
    setNovo("");
  }

  function remover(item: string) {
    setValores((prev) => prev.filter((x) => x !== item));
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1a6b2f]" />
        Carregando…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{descricao}</p>
      </div>

      {/* Lista atual */}
      <ul className="mb-4 space-y-2">
        {valores.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            <span className="flex-1 text-gray-800">{item}</span>
            <button
              onClick={() => remover(item)}
              className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {valores.length === 0 && (
          <li className="py-3 text-center text-xs text-gray-400">
            Nenhum item cadastrado
          </li>
        )}
      </ul>

      {/* Adicionar novo */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
        />
        <button
          onClick={adicionar}
          disabled={!novo.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f]/10 px-3 py-2 text-xs font-semibold text-[#1a6b2f] hover:bg-[#1a6b2f]/20 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {/* Botão salvar + feedback */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => salvar(valores)}
          disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155825] disabled:opacity-60 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
        {feedback === "ok" && (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo com sucesso
          </span>
        )}
        {feedback === "erro" && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> Erro ao salvar
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Catálogo de Produtos e Serviços ─────────────────────────────────────────

function SecaoSuprimentos() {
  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Suprimento | null>(null);
  const [form, setForm] = useState<Partial<Suprimento>>({ ...EMPTY_SUP });
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<"ok" | "erro" | null>(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("logistica_suprimentos")
      .select("*")
      .order("nome");
    setSuprimentos((data as Suprimento[]) ?? []);
    setCarregando(false);
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...EMPTY_SUP });
    setModal(true);
  }

  function abrirEditar(s: Suprimento) {
    setEditando(s);
    setForm({ ...s });
    setModal(true);
  }

  async function salvar() {
    if (!form.nome?.trim()) return;
    setSalvando(true);
    setFeedback(null);
    const payload = {
      nome: form.nome!.trim(),
      codigo: form.codigo || null,
      categoria: form.categoria || null,
      unidade: form.unidade || "un",
      custo_unitario: Number(form.custo_unitario ?? 0),
      tempo_instalacao_min: Number(form.tempo_instalacao_min ?? 0),
      profissionais_ids: form.profissionais_ids ?? [],
      link_compra: form.link_compra || null,
    };
    let error;
    if (editando) {
      ({ error } = await supabase.from("logistica_suprimentos").update(payload).eq("id", editando.id));
    } else {
      ({ error } = await supabase.from("logistica_suprimentos").insert(payload));
    }
    setSalvando(false);
    if (error) { setFeedback("erro"); return; }
    setFeedback("ok");
    setTimeout(() => setFeedback(null), 2500);
    setModal(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover este suprimento?")) return;
    await supabase.from("logistica_suprimentos").delete().eq("id", id);
    carregar();
  }

  const filtrados = suprimentos.filter(s =>
    !busca || s.nome.toLowerCase().includes(busca.toLowerCase())
      || (s.codigo ?? "").toLowerCase().includes(busca.toLowerCase())
      || (s.categoria ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  const desatualizados = suprimentos.filter(s =>
    s.atualizado_em && diasDesdeAtualizacaoSup(s.atualizado_em) > DIAS_ALERTA_SUP
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <input type="text" placeholder="Buscar por nome, código ou categoria…" value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
          <Plus className="h-4 w-4" /> Novo Produto/Serviço
        </button>
      </div>

      {/* Alerta preços desatualizados */}
      {desatualizados.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              {desatualizados.length} item{desatualizados.length > 1 ? "ns" : ""} com preço não confirmado há mais de {DIAS_ALERTA_SUP} dias
            </p>
            <p className="mt-0.5 text-xs text-amber-600">{desatualizados.map(s => s.nome).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">{busca ? "Nenhum resultado para a busca" : "Nenhum produto ou serviço cadastrado"}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Produto / Serviço</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Categoria</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Custo Unit.</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Tempo Inst.</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Atualização</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Link</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(s => {
                const dias = s.atualizado_em ? diasDesdeAtualizacaoSup(s.atualizado_em) : 9999;
                const desatualizado = dias > DIAS_ALERTA_SUP;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">{s.nome}</p>
                      {s.codigo && <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 hidden md:table-cell">{s.categoria || "—"}</td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-gray-800">
                        {s.custo_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">/{s.unidade}</span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {s.tempo_instalacao_min > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {s.tempo_instalacao_min < 60
                            ? `${s.tempo_instalacao_min}min`
                            : `${Math.floor(s.tempo_instalacao_min / 60)}h${s.tempo_instalacao_min % 60 > 0 ? `${s.tempo_instalacao_min % 60}min` : ""}`}
                          <span className="text-gray-400">/{s.unidade}</span>
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      {s.atualizado_em ? (
                        <div className="flex items-center gap-2">
                          <span className={cn("flex items-center gap-1 text-xs", desatualizado ? "text-amber-600 font-medium" : "text-gray-400")}>
                            <Clock className="h-3 w-3" />
                            {new Date(s.atualizado_em).toLocaleDateString("pt-BR")}
                            {desatualizado && ` (${dias}d)`}
                          </span>
                          {desatualizado && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              Atualizar preço
                            </span>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      {s.link_compra ? (
                        <a href={s.link_compra} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
                          <ExternalLink className="h-3 w-3" /> Ver link
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => abrirEditar(s)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => excluir(s.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Feedback salvo */}
      {feedback === "ok" && (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso
        </p>
      )}
      {feedback === "erro" && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> Erro ao salvar. Tente novamente.
        </p>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editando ? "Editar Produto/Serviço" : "Novo Produto/Serviço"}</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={form.nome || ""}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Dobradiça Corta-Fogo 3/4"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Código / Ref.</label>
                  <input type="text" value={form.codigo || ""}
                    onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                  <input type="text" value={form.categoria || ""}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ex: Ferragens"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
                  <input type="number" min={0} step={0.01} value={form.custo_unitario ?? 0}
                    onChange={e => setForm(f => ({ ...f, custo_unitario: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={form.unidade || "un"}
                    onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo", "par", "jg"].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tempo de instalação (min/unidade)
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} step={1} value={form.tempo_instalacao_min ?? 0}
                    onChange={e => setForm(f => ({ ...f, tempo_instalacao_min: Number(e.target.value) }))}
                    className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                  <span className="text-sm text-gray-400">min/{form.unidade || "un"}</span>
                  {(form.tempo_instalacao_min ?? 0) > 0 && (
                    <span className="text-xs text-[#1a6b2f] font-medium">
                      ≈ {(form.tempo_instalacao_min ?? 0) < 60
                        ? `${form.tempo_instalacao_min}min`
                        : `${Math.floor((form.tempo_instalacao_min ?? 0) / 60)}h${(form.tempo_instalacao_min ?? 0) % 60 > 0 ? `${(form.tempo_instalacao_min ?? 0) % 60}min` : ""}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Usado para estimar dias de roteiro no orçamento</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Link de compra</label>
                <input type="url" value={form.link_compra || ""}
                  onChange={e => setForm(f => ({ ...f, link_compra: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              {editando?.atualizado_em && (
                <p className="text-xs text-gray-400">
                  Última atualização: {new Date(editando.atualizado_em).toLocaleDateString("pt-BR")} — ao salvar, a data será atualizada para hoje.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando || !form.nome?.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                  {salvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Conteúdo por seção ──────────────────────────────────────────────────────

function SecaoLogistica() {
  return (
    <div className="space-y-8">
      {/* Fornecedores */}
      <div>
        <ListaEditavel
          titulo="Fornecedores de Compras"
          descricao="Lista de fornecedores disponíveis ao registrar uma compra na aba Logística → Compras."
          chave="logistica_fornecedores"
          padrao={["G Sardou", "Disafe", "GUBLER", "DW15", "Original Portas"]}
          placeholder="Nome do fornecedor…"
        />
      </div>

      {/* Catálogo de Produtos e Serviços */}
      <div>
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <ShoppingCart className="h-4 w-4 text-[#1a6b2f]" />
            Produtos e Serviços (Catálogo)
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Itens cadastrados no catálogo de suprimentos — usados em orçamentos e Materiais a Comprar.
          </p>
        </div>
        <SecaoSuprimentos />
      </div>
    </div>
  );
}

function SecaoDashboard() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <LayoutDashboard className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">
        Configurações de Dashboard
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: KPIs exibidos, metas e períodos padrão.
      </p>
    </div>
  );
}

function SecaoCRM() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Configurações de CRM</p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: etapas do funil, status de renovação e tipos de cliente.
      </p>
    </div>
  );
}

function SecaoFinanceiro() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <DollarSign className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">
        Configurações Financeiro
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: categorias de receita/despesa e contas bancárias.
      </p>
    </div>
  );
}

const CONTEUDO: Record<SecaoId, React.FC> = {
  logistica: SecaoLogistica,
  dashboard: SecaoDashboard,
  crm: SecaoCRM,
  financeiro: SecaoFinanceiro,
};

// ─── Página principal ─────────────────────────────────────────────────────────

function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoId>("logistica");

  // Só administrador pode acessar
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [usuario, navigate]);

  if (!usuario || usuario.perfil !== "admin") return null;

  const SecaoConteudo = CONTEUDO[secaoAtiva];
  const secaoInfo = SECOES.find((s) => s.id === secaoAtiva)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
            <Settings className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Configurações</h1>
            <p className="text-xs text-gray-500">
              Gerencie as opções do sistema — somente Administrador
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-0 md:gap-6 p-0 md:p-6">
        {/* Sidebar de seções */}
        <nav className="hidden md:block w-52 flex-shrink-0">
          <ul className="space-y-1">
            {SECOES.map((s) => {
              const Icon = s.icon;
              const ativo = secaoAtiva === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSecaoAtiva(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      ativo
                        ? "bg-[#1a6b2f] text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{s.label}</span>
                    {ativo && <ChevronRight className="h-3 w-3 opacity-70" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile: tabs no topo */}
        <div className="md:hidden w-full overflow-x-auto">
          <div className="flex border-b border-gray-200 bg-white px-4 gap-1">
            {SECOES.map((s) => {
              const Icon = s.icon;
              const ativo = secaoAtiva === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSecaoAtiva(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                    ativo
                      ? "border-[#1a6b2f] text-[#1a6b2f]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da seção */}
        <div className="flex-1 min-w-0 p-4 md:p-0">
          <div className="mb-4 hidden md:flex items-center gap-2">
            <secaoInfo.icon className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">
              {secaoInfo.label}
            </h2>
          </div>
          <SecaoConteudo />
        </div>
      </div>
    </div>
  );
}
