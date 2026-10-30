import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Plus, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/logistica")({
  component: LogisticaPage,
});

interface Item {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  localizacao: string;
}

function LogisticaPage() {
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [selecionado, setSelecionado] = useState<Item | null>(null);
  const [form, setForm] = useState<Partial<Item>>({
    nome: "", codigo: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, unidade: "un", localizacao: ""
  });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("logistica_estoque").select("*").order("nome");
    if (data) setItens(data as Item[]);
    setCarregando(false);
  }

  function abrir(item?: Item) {
    if (item) {
      setSelecionado(item);
      setForm({ ...item });
    } else {
      setSelecionado(null);
      setForm({ nome: "", codigo: "", categoria: "", quantidade: 0, estoque_minimo: 0, unidade: "un", localizacao: "" });
    }
    setModal(true);
  }

  async function salvar() {
    if (!form.nome?.trim()) return;
    if (selecionado) {
      await supabase.from("logistica_estoque").update(form).eq("id", selecionado.id);
    } else {
      await supabase.from("logistica_estoque").insert(form);
    }
    setModal(false);
    carregar();
  }

  const abaixoMinimo = itens.filter(i => i.quantidade <= i.estoque_minimo);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logística e Suprimentos</h1>
          <p className="mt-1 text-sm text-gray-500">{itens.length} item{itens.length !== 1 ? "s" : ""} no estoque</p>
        </div>
        <button
          onClick={() => abrir()}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
        >
          <Plus className="h-4 w-4" />
          Novo Item
        </button>
      </div>

      {/* Alertas */}
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

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {carregando ? (
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
                      <span className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        critico ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                      )}>
                        {critico ? "⚠ Baixo" : "OK"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => abrir(item)} className="text-xs text-[#1a6b2f] hover:underline">Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selecionado ? "Editar Item" : "Novo Item"}</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
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
                  <input
                    type="text"
                    value={(form as Record<string, unknown>)[field] as string || ""}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                  />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Qtd</label>
                  <input
                    type="number" min={0}
                    value={form.quantidade ?? 0}
                    onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mínimo</label>
                  <input
                    type="number" min={0}
                    value={form.estoque_minimo ?? 0}
                    onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select
                    value={form.unidade || "un"}
                    onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                  >
                    {["un", "cx", "pc", "m", "kg", "l", "rolo"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvar} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
