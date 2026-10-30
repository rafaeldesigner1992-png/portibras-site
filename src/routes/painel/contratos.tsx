import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Download } from "lucide-react";

export const Route = createFileRoute("/painel/contratos")({
  component: ContratosPage,
});

function ContratosPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="mt-1 text-sm text-gray-500">Emissão e gestão de contratos de manutenção</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
          <Plus className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {[
          { label: "Contratos Ativos", valor: "—", cor: "bg-green-50 text-green-700" },
          { label: "Aguardando Assinatura", valor: "—", cor: "bg-orange-50 text-orange-700" },
          { label: "Vencendo em 30 dias", valor: "—", cor: "bg-red-50 text-red-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.cor.split(" ")[1]}`}>{card.valor}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText className="mb-4 h-12 w-12 opacity-30" />
          <p className="text-sm font-medium">Ferramenta de contrato em integração</p>
          <p className="mt-1 text-xs text-center max-w-xs">
            O gerador de contratos PORTIBRAS será integrado aqui. Por enquanto use a ferramenta standalone disponível no repositório.
          </p>
          <a
            href="/contrato"
            className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Abrir Gerador de Contrato
          </a>
        </div>
      </div>
    </div>
  );
}
