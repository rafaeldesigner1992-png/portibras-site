import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { DollarSign, Plus, TrendingUp, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/financeiro")({
  component: FinanceiroPage,
});

type Tipo = "receita" | "despesa";
interface Lancamento {
  id: string;
  descricao: string;
  tipo: Tipo;
  valor: number;
  categoria: string;
  data: string;
  pago: boolean;
}

function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Lancamento>>({
    descricao: "", tipo: "receita", valor: 0, categoria: "",
    data: new Date().toISOString().slice(0, 10), pago: false
  });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("financeiro_lancamentos")
      .select("*")
      .order("data", { ascending: false });
    if (data) setLancamentos(data as Lancamento[]);
    setCarregando(false);
  }

  async function salvar() {
    if (!form.descricao?.trim() || !form.valor) return;
    await supabase.from("financeiro_lancamentos").insert(form);
    setModal(false);
    carregar();
  }

  const receitas = lancamentos.filter(l => l.tipo === "receita" && l.pago).reduce((s, l) => s + l.valor, 0);
  const despesas = lancamentos.filter(l => l.tipo === "despesa" && l.pago).reduce((s, l) => s + l.valor, 0);
  const saldo = receitas - despesas;

  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="mt-1 text-sm text-gray-500 capitalize">{mes}</p>
        </div>
        <button
          onClick={() => { setForm({ descricao: "", tipo: "receita", valor: 0, categoria: "", data: new Date().toISOString().slice(0, 10), pago: false }); setModal(true); }}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
        >
          <Plus className="h-4 w-4" />
          Lançamento
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Receitas (pagas)", valor: fmt(receitas), icon: TrendingUp, cor: "bg-green-50 text-green-600" },
          { label: "Despesas (pagas)", valor: fmt(despesas), icon: TrendingDown, cor: "bg-red-50 text-red-600" },
          { label: "Saldo", valor: fmt(saldo), icon: DollarSign, cor: saldo >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
            <div className={cn("rounded-lg p-3", kpi.cor)}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900">{kpi.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {carregando ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : lancamentos.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <DollarSign className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum lançamento ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lancamentos.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/60">
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{l.descricao}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{l.categoria || "—"}</td>
                  <td className={cn("px-6 py-4 text-right text-sm font-semibold", l.tipo === "receita" ? "text-green-600" : "text-red-600")}>
                    {l.tipo === "despesa" ? "−" : "+"}{fmt(l.valor)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", l.pago ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                      {l.pago ? "Pago" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Novo Lançamento</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["receita", "despesa"] as Tipo[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, tipo: t })}
                      className={cn(
                        "rounded-lg border py-2.5 text-sm font-medium capitalize transition",
                        form.tipo === t
                          ? t === "receita" ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Descrição *</label>
                <input type="text" value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor (R$) *</label>
                  <input type="number" min={0} step={0.01} value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Data</label>
                  <input type="date" value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                <input type="text" placeholder="Ex: Manutenção, Material, Salário…" value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="pago" checked={form.pago || false} onChange={(e) => setForm({ ...form, pago: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-[#1a6b2f]" />
                <label htmlFor="pago" className="text-sm text-gray-700">Já foi pago/recebido</label>
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
