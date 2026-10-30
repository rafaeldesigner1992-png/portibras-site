import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp,
  Users,
  FileText,
  Package,
  DollarSign,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/painel/")({
  component: DashboardPage,
});

const KPICard = ({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  cor,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  icon: React.ElementType;
  cor: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{titulo}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{valor}</p>
        <p className="mt-1 text-xs text-gray-400">{subtitulo}</p>
      </div>
      <div className={`rounded-lg p-3 ${cor}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

function DashboardPage() {
  const { usuario } = useAuth();
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="p-8">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {saudacao}, {usuario?.nome.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {agora.toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard
          titulo="Faturamento do Mês"
          valor="—"
          subtitulo="Aguardando integração financeira"
          icon={DollarSign}
          cor="bg-green-50 text-green-600"
        />
        <KPICard
          titulo="Contratos Ativos"
          valor="—"
          subtitulo="Aguardando módulo CRM"
          icon={FileText}
          cor="bg-blue-50 text-blue-600"
        />
        <KPICard
          titulo="Clientes na Pipeline"
          valor="—"
          subtitulo="Aguardando módulo CRM"
          icon={Users}
          cor="bg-purple-50 text-purple-600"
        />
        <KPICard
          titulo="Orçamentos Enviados"
          valor="—"
          subtitulo="Este mês"
          icon={TrendingUp}
          cor="bg-orange-50 text-orange-600"
        />
        <KPICard
          titulo="Itens em Estoque"
          valor="—"
          subtitulo="Aguardando módulo logística"
          icon={Package}
          cor="bg-yellow-50 text-yellow-600"
        />
        <KPICard
          titulo="Atividade Recente"
          valor="—"
          subtitulo="Últimas 24 horas"
          icon={Activity}
          cor="bg-red-50 text-red-600"
        />
      </div>

      {/* Aviso de setup */}
      <div className="rounded-xl border border-[#1a6b2f]/20 bg-[#1a6b2f]/5 p-6">
        <h3 className="mb-2 font-semibold text-[#1a6b2f]">🚀 Sistema em configuração</h3>
        <p className="text-sm text-gray-600">
          O painel PORTIBRAS está instalado e funcionando. Os dados dos KPIs
          serão populados conforme você utilizar os módulos de CRM, Contratos,
          Logística e Financeiro. Use o menu lateral para acessar cada módulo.
        </p>
      </div>
    </div>
  );
}
