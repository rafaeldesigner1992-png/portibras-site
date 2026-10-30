import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/painel/orcamentos")({
  component: OrcamentosPage,
});

interface Item {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnit: number;
}

function OrcamentosPage() {
  const [modo, setModo] = useState<"lista" | "novo">("lista");
  const [cliente, setCliente] = useState("");
  const [itens, setItens] = useState<Item[]>([
    { id: "1", descricao: "", quantidade: 1, valorUnit: 0 },
  ]);
  const [obs, setObs] = useState("");

  function addItem() {
    setItens([...itens, { id: Date.now().toString(), descricao: "", quantidade: 1, valorUnit: 0 }]);
  }

  function removeItem(id: string) {
    setItens(itens.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof Item, value: string | number) {
    setItens(itens.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valorUnit, 0);
  const desconto = 0;
  const total = subtotal - desconto;

  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  if (modo === "novo") {
    return (
      <div className="p-8 max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Novo Orçamento</h1>
          <button
            onClick={() => setModo("lista")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            ← Voltar
          </button>
        </div>

        <div className="space-y-6">
          {/* Cliente */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Cliente / Empresa</h2>
            <input
              type="text"
              placeholder="Nome do cliente ou empresa"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
            />
          </div>

          {/* Itens */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Itens / Serviços</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="col-span-6">Descrição</div>
                <div className="col-span-2 text-center">Qtd</div>
                <div className="col-span-3 text-right">Valor Unit.</div>
                <div className="col-span-1" />
              </div>
              {itens.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Descrição do item"
                    value={item.descricao}
                    onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                    className="col-span-6 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(item.id, "quantidade", Number(e.target.value))}
                    className="col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-[#1a6b2f]"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.valorUnit || ""}
                    onChange={(e) => updateItem(item.id, "valorUnit", Number(e.target.value))}
                    className="col-span-3 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm outline-none focus:border-[#1a6b2f]"
                    placeholder="0,00"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={itens.length === 1}
                    className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:pointer-events-none"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-[#1a6b2f] hover:underline mt-2">
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </button>
            </div>
          </div>

          {/* Totais */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                <span>Total</span>
                <span className="text-[#1a6b2f]">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">Observações</h2>
            <textarea
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Condições, prazo de validade, forma de pagamento…"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setModo("lista")} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button className="rounded-lg bg-[#1a6b2f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar Orçamento</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
          <p className="mt-1 text-sm text-gray-500">Gere e gerencie propostas comerciais</p>
        </div>
        <button
          onClick={() => setModo("novo")}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
        >
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Calculator className="mb-4 h-12 w-12 opacity-30" />
          <p className="text-sm font-medium">Nenhum orçamento ainda</p>
          <p className="mt-1 text-xs">Clique em "Novo Orçamento" para criar sua primeira proposta</p>
        </div>
      </div>
    </div>
  );
}
