import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, Plus, AlertTriangle, X, ShoppingCart,
  ExternalLink, Clock, Pencil, Trash2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/logistica")({
  component: LogisticaPage,
});

// ─── Estoque ──────────────────────────────────────────────────────────────────
interface ItemEstoque {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  localizacao: string;
}

// ─── Suprimentos ──────────────────────────────────────────────────────────────
interface Suprimento {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  unidade: string;
  custo_unitario: number;
  link_compra: string;
  atualizado_em: string;
}

const DIAS_ALERTA = 15;

function diasDesdeAtualizacao(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function LogisticaPage() {
  const [aba, setAba] = useState<"estoque" | "suprimentos">("estoque");

  // ── Estoque ────────────────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(true);
  const [modalEstoque, setModalEstoque] = useState(false);
  const [selEstoque, setSelEstoque] = useState<ItemEstoque | null>(null);
  const [formEstoque, setFormEstoque] = useState<Partial<ItemEstoque>>({
    nome: "", codigo: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, unidade: "un", localizacao: "",
  });

  useEffect(() => { carregarEstoque(); }, []);

  async function carregarEstoque() {
    setCarregandoEstoque(true);
    const { data } = await supabase.from("logistica_estoque").select("*").order("nome");
    if (data) setItens(data as ItemEstoque[]);
    setCarregandoEstoque(false);
  }

  function abrirEstoque(item?: ItemEstoque) {
    if (item) { setSelEstoque(item); setFormEstoque({ ...item }); }
    else { setSelEstoque(null); setFormEstoque({ nome: "", codigo: "", categoria: "", quantidade: 0, estoque_minimo: 0, unidade: "un", localizacao: "" }); }
    setModalEstoque(true);
  }

  async function salvarEstoque() {
    if (!formEstoque.nome?.trim()) return;
    if (selEstoque) await supabase.from("logistica_estoque").update(formEstoque).eq("id", selEstoque.id);
    else await supabase.from("logistica_estoque").insert(formEstoque);
    setModalEstoque(false);
    carregarEstoque();
  }

  const abaixoMinimo = itens.filter(i => i.quantidade <= i.estoque_minimo);

  // ── Suprimentos ────────────────────────────────────────────────────────────
  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [carregandoSup, setCarregandoSup] = useState(true);
  const [modalSup, setModalSup] = useState(false);
  const [selSup, setSelSup] = useState<Suprimento | null>(null);
  const [buscaSup, setBuscaSup] = useState("");
  const [formSup, setFormSup] = useState<Partial<Suprimento>>({
    nome: "", codigo: "", categoria: "", unidade: "un",
    custo_unitario: 0, link_compra: "",
  });

  useEffect(() => { if (aba === "suprimentos") carregarSuprimentos(); }, [aba]);

  async function carregarSuprimentos() {
    setCarregandoSup(true);
    const { data } = await supabase.from("logistica_suprimentos").select("*").order("nome");
    if (data) setSuprimentos(data as Suprimento[]);
    setCarregandoSup(false);
  }

  function abrirSup(s?: Suprimento) {
    if (s) { setSelSup(s); setFormSup({ ...s }); }
    else { setSelSup(null); setFormSup({ nome: "", codigo: "", categoria: "", unidade: "un", custo_unitario: 0, link_compra: "" }); }
    setModalSup(true);
  }

  async function salvarSup() {
    if (!formSup.nome?.trim()) return;
    const payload = { ...formSup, atualizado_em: new Date().toISOString() };
    if (selSup) await supabase.from("logistica_suprimentos").update(payload).eq("id", selSup.id);
    else await supabase.from("logistica_suprimentos").insert(payload);
    setModalSup(false);
    carregarSuprimentos();
  }

  async function excluirSup(id: string) {
    if (!confirm("Excluir este suprimento?")) return;
    await supabase.from("logistica_suprimentos").delete().eq("id", id);
    carregarSuprimentos();
  }

  const supFiltrados = suprimentos.filter(s =>
    !buscaSup ||
    s.nome.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.codigo?.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.categoria?.toLowerCase().includes(buscaSup.toLowerCase())
  );

  const precosDesatualizados = suprimentos.filter(s => s.atualizado_em && diasDesdeAtualizacao(s.atualizado_em) > DIAS_ALERTA);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logística</h1>
        <p className="mt-1 text-sm text-gray-500">Gestão de estoque e catálogo de suprimentos</p>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {([
          { key: "estoque", label: "Estoque", icon: Package },
          { key: "suprimentos", label: "Catálogo de Suprimentos", icon: ShoppingCart },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              aba === key
                ? "border-[#1a6b2f] text-[#1a6b2f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            <Icon className="h-4 w-4" />
            {label}
            {key === "estoque" && abaixoMinimo.length > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{abaixoMinimo.length}</span>
            )}
            {key === "suprimentos" && precosDesatualizados.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{precosDesatualizados.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ ABA ESTOQUE ═══════ */}
      {aba === "estoque" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{itens.length} item{itens.length !== 1 ? "s" : ""} no estoque</p>
            <button onClick={() => abrirEstoque()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Item
            </button>
          </div>

          {abaixoMinimo.length > 0 && (
            <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">{abaixoMinimo.length} item{abaixoMinimo.length !== 1 ? "s" : ""} abaixo do estoque mínimo</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {abaixoMinimo.map(i => (
                  <span key={i.id} className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    {i.nome} ({i.quantidade} {i.unidade})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoEstoque ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <Package className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum item cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Qtd</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Mín</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Localização</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itens.map((item) => {
                    const critico = item.quantidade <= item.estoque_minimo;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                          {item.codigo && <p className="text-xs text-gray-400">{item.codigo}</p>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.categoria || "—"}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">{item.quantidade} {item.unidade}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-400">{item.estoque_minimo}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.localizacao || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium",
                            critico ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                            {critico ? "⚠ Baixo" : "OK"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => abrirEstoque(item)} className="text-xs text-[#1a6b2f] hover:underline">Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════ ABA SUPRIMENTOS ═══════ */}
      {aba === "suprimentos" && (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <input type="text" placeholder="Buscar por nome, código ou categoria…" value={buscaSup}
                onChange={e => setBuscaSup(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
            </div>
            <button onClick={() => abrirSup()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Suprimento
            </button>
          </div>

          {precosDesatualizados.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {precosDesatualizados.length} suprimento{precosDesatualizados.length > 1 ? "s" : ""} com preço não confirmado (mais de {DIAS_ALERTA} dias sem atualização)
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  {precosDesatualizados.map(s => s.nome).join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoSup ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : supFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum suprimento cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Suprimento</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Categoria</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Custo Unit.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Últ. Atualização</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Link</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {supFiltrados.map((s) => {
                    const dias = s.atualizado_em ? diasDesdeAtualizacao(s.atualizado_em) : 9999;
                    const desatualizado = dias > DIAS_ALERTA;
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
                                  Preço não confirmado
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
                            <button onClick={() => abrirSup(s)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => excluirSup(s.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Modal Estoque ── */}
      {modalEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalEstoque(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selEstoque ? "Editar Item" : "Novo Item"}</h2>
              <button onClick={() => setModalEstoque(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Nome *", field: "nome" },
                { label: "Código / Referência", field: "codigo" },
                { label: "Categoria", field: "categoria" },
                { label: "Localização", field: "localizacao" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                  <input type="text"
                    value={(formEstoque as Record<string, unknown>)[field] as string || ""}
                    onChange={e => setFormEstoque({ ...formEstoque, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Qtd</label>
                  <input type="number" min={0} value={formEstoque.quantidade ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, quantidade: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mínimo</label>
                  <input type="number" min={0} value={formEstoque.estoque_minimo ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, estoque_minimo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formEstoque.unidade || "un"}
                    onChange={e => setFormEstoque({ ...formEstoque, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEstoque(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarEstoque} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suprimento ── */}
      {modalSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalSup(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selSup ? "Editar Suprimento" : "Novo Suprimento"}</h2>
              <button onClick={() => setModalSup(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formSup.nome || ""}
                  onChange={e => setFormSup({ ...formSup, nome: e.target.value })}
                  placeholder="Ex: Dobradiça Corta-Fogo 3/4"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Código / Ref.</label>
                  <input type="text" value={formSup.codigo || ""}
                    onChange={e => setFormSup({ ...formSup, codigo: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                  <input type="text" value={formSup.categoria || ""}
                    onChange={e => setFormSup({ ...formSup, categoria: e.target.value })}
                    placeholder="Ex: Ferragens"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
                  <input type="number" min={0} step={0.01} value={formSup.custo_unitario ?? 0}
                    onChange={e => setFormSup({ ...formSup, custo_unitario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formSup.unidade || "un"}
                    onChange={e => setFormSup({ ...formSup, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo", "par", "jg"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Link de compra</label>
                <input type="url" value={formSup.link_compra || ""}
                  onChange={e => setFormSup({ ...formSup, link_compra: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              {selSup?.atualizado_em && (
                <p className="text-xs text-gray-400">
                  Última atualização: {new Date(selSup.atualizado_em).toLocaleDateString("pt-BR")} — ao salvar, a data será atualizada para hoje.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalSup(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarSup} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
