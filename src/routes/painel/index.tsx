import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  Briefcase,
  Wrench,
  DollarSign,
  Package,
  ShoppingCart,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  ClipboardList,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/painel/")({
  component: DashboardPage,
});

// ─── Tipos ──────────────────────────────────────────────
interface DashboardData {
  // Clientes
  totalClientes: number;
  clientesAtivos: number;
  clientesInativos: number;
  clientesProspect: number;
  // CRM Leads
  totalLeads: number;
  leadsAbertos: number;
  leadsManutenção: number;
  leadsOrcamento: number;
  // Funcionários
  totalFuncionarios: number;
  funcionariosAtivos: number;
  // Logística
  atendimentosEmAndamento: number;
  atendimentosProgramados: number;
  // Materiais a comprar
  materiaisPendentes: number;
  valorMateriais: number;
  // Conta Azul
  caFaturamento: number;
  caReceber: number;
  caContratos: number;
}

// ─── Componentes de Gráfico ──────────────────────────────
const DonutChart = ({
  data,
  colors,
  size = 120,
}: {
  data: { label: string; value: number; color: string }[];
  colors?: string[];
  size?: number;
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Sem dados</div>;

  const radius = 40;
  const cx = 50;
  const cy = 50;
  let cumulative = 0;

  const slices = data.map((d, i) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return { ...d, x1, y1, x2, y2, startAngle, endAngle, largeArc, color: d.color || (colors?.[i] ?? "#ccc") };
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {slices.map((s, i) => (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${radius} ${radius} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
          fill={s.color}
          stroke="white"
          strokeWidth="1"
        />
      ))}
      <circle cx={cx} cy={cy} r={24} fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1f2937">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#6b7280">
        total
      </text>
    </svg>
  );
};

const BarChart = ({
  data,
  height = 80,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-xs font-bold text-gray-700">{d.value}</span>
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max((d.value / max) * (height - 28), 4)}px`,
              backgroundColor: d.color,
            }}
          />
          <span className="text-[10px] text-gray-500 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ───────────────────────────────────────────
const KPICard = ({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  cor,
  loading,
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icon: React.ElementType;
  cor: string;
  loading?: boolean;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
        {loading ? (
          <div className="mt-2 h-8 w-20 rounded bg-gray-100 animate-pulse" />
        ) : (
          <p className="mt-1.5 text-3xl font-bold text-gray-900">{valor}</p>
        )}
        {subtitulo && <p className="mt-1 text-xs text-gray-400">{subtitulo}</p>}
      </div>
      <div className={`rounded-lg p-3 ${cor} ml-3 flex-shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

// ─── Seção de Card com Gráfico ───────────────────────────
const ChartCard = ({
  titulo,
  children,
  loading,
}: {
  titulo: string;
  children: React.ReactNode;
  loading?: boolean;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{titulo}</h3>
    {loading ? (
      <div className="h-32 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    ) : (
      children
    )}
  </div>
);

// ─── Página Principal ────────────────────────────────────
function DashboardPage() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      // Todas as queries em paralelo
      const [
        clientesRes,
        leadsRes,
        funcionariosRes,
        atendimentosRes,
        materiaisRes,
        caVendasRes,
        caCobrancasRes,
        caContratosRes,
      ] = await Promise.all([
        // Clientes por status
        supabase.from("clientes").select("status"),
        // Leads do CRM
        supabase.from("crm_leads").select("etapa, observacoes"),
        // Funcionários (usuários)
        supabase.from("usuarios").select("ativo"),
        // Atendimentos em andamento
        supabase
          .from("atendimentos")
          .select("status")
          .in("status", ["Em andamento", "Programado"]),
        // Materiais pendentes de compra (atendimentos_materiais com status Solicitado)
        supabase
          .from("atendimentos_materiais")
          .select("status, valor_total")
          .eq("status", "Solicitado"),
        // Conta Azul — vendas do mês
        supabase
          .from("ca_vendas")
          .select("valor_total, emissao")
          .gte(
            "emissao",
            new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10)
          ),
        // Conta Azul — cobranças a receber
        supabase.from("ca_cobrancas").select("valor, status").eq("status", "pending"),
        // Conta Azul — contratos ativos
        supabase.from("ca_contratos").select("id, status").eq("status", "active"),
      ]);

      // Processar clientes
      const clientes = clientesRes.data ?? [];
      const totalClientes = clientes.length;
      const clientesAtivos = clientes.filter((c) => c.status === "ativo").length;
      const clientesInativos = clientes.filter((c) => c.status === "inativo").length;
      const clientesProspect = clientes.filter((c) => c.status === "prospect").length;

      // Processar leads
      const leads = leadsRes.data ?? [];
      const leadsAbertos = leads.filter(
        (l) => !["fechado", "perdido"].includes(l.etapa)
      ).length;
      const totalLeads = leads.length;

      // Classificar leads por tipo (baseado em observações ou etapa)
      // Manutenção 12x: leads que mencionam "manutenção", "12x", "mensal", "contrato"
      const leadsManutenção = leads.filter((l) => {
        const obs = (l.observacoes ?? "").toLowerCase();
        return (
          obs.includes("manuten") ||
          obs.includes("12x") ||
          obs.includes("mensal") ||
          obs.includes("contrato")
        );
      }).length;
      const leadsOrcamento = leadsAbertos - Math.min(leadsManutenção, leadsAbertos);

      // Processar funcionários
      const funcionarios = funcionariosRes.data ?? [];
      const totalFuncionarios = funcionarios.length;
      const funcionariosAtivos = funcionarios.filter((f) => f.ativo !== false).length;

      // Processar atendimentos
      const atendimentos = atendimentosRes.data ?? [];
      const atendimentosEmAndamento = atendimentos.filter(
        (a) => a.status === "Em andamento"
      ).length;
      const atendimentosProgramados = atendimentos.filter(
        (a) => a.status === "Programado"
      ).length;

      // Processar materiais
      const materiais = materiaisRes.data ?? [];
      const materiaisPendentes = materiais.length;
      const valorMateriais = materiais.reduce(
        (s, m) => s + (m.valor_total ?? 0),
        0
      );

      // Processar Conta Azul
      const caVendas = caVendasRes.data ?? [];
      const caFaturamento = caVendas.reduce((s, v) => s + (v.valor_total ?? 0), 0);
      const caCobrancas = caCobrancasRes.data ?? [];
      const caReceber = caCobrancas.reduce((s, c) => s + (c.valor ?? 0), 0);
      const caContratos = caContratosRes.data?.length ?? 0;

      setDados({
        totalClientes,
        clientesAtivos,
        clientesInativos,
        clientesProspect,
        totalLeads,
        leadsAbertos,
        leadsManutenção,
        leadsOrcamento,
        totalFuncionarios,
        funcionariosAtivos,
        atendimentosEmAndamento,
        atendimentosProgramados,
        materiaisPendentes,
        valorMateriais,
        caFaturamento,
        caReceber,
        caContratos,
      });
      setUltimaAtualizacao(new Date());
    } catch (err: any) {
      setErro(err.message ?? "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // Atualizar a cada 5 minutos
    const interval = setInterval(carregarDados, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Cabeçalho ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {saudacao}, {usuario?.nome?.split(" ")[0] ?? ""}! 👋
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {agora.toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {ultimaAtualizacao && (
            <p className="mt-0.5 text-xs text-gray-400">
              Atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* ── Erro ── */}
      {erro && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* ── Seção: Clientes ── */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <Building2 className="h-4 w-4" />
          Clientes na Base
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPICard
            titulo="Total Clientes"
            valor={dados?.totalClientes ?? "—"}
            icon={Users}
            cor="bg-blue-50 text-blue-600"
            loading={loading}
          />
          <KPICard
            titulo="Ativos"
            valor={dados?.clientesAtivos ?? "—"}
            icon={UserCheck}
            cor="bg-green-50 text-green-600"
            loading={loading}
          />
          <KPICard
            titulo="Inativos"
            valor={dados?.clientesInativos ?? "—"}
            icon={UserX}
            cor="bg-red-50 text-red-600"
            loading={loading}
          />
          <KPICard
            titulo="Prospects"
            valor={dados?.clientesProspect ?? "—"}
            icon={TrendingUp}
            cor="bg-purple-50 text-purple-600"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Seção: CRM + Gráficos ── */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <ClipboardList className="h-4 w-4" />
          CRM — Leads & Pipeline
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* KPIs de leads */}
          <div className="space-y-3">
            <KPICard
              titulo="Leads Abertas"
              valor={dados?.leadsAbertos ?? "—"}
              subtitulo={`de ${dados?.totalLeads ?? "—"} leads totais`}
              icon={Briefcase}
              cor="bg-orange-50 text-orange-600"
              loading={loading}
            />
            <KPICard
              titulo="Manutenção 12x"
              valor={dados?.leadsManutenção ?? "—"}
              subtitulo="Contrato recorrente"
              icon={Wrench}
              cor="bg-emerald-50 text-emerald-600"
              loading={loading}
            />
            <KPICard
              titulo="Orçamento Avulso"
              valor={dados?.leadsOrcamento ?? "—"}
              subtitulo="Serviço pontual"
              icon={DollarSign}
              cor="bg-yellow-50 text-yellow-600"
              loading={loading}
            />
          </div>

          {/* Gráfico de funil do CRM */}
          <ChartCard titulo="Distribuição do Funil" loading={loading}>
            {dados && (
              <BarChart
                height={120}
                data={[
                  { label: "Prospecto", value: 0, color: "#e5e7eb" },
                  { label: "Contato", value: 0, color: "#93c5fd" },
                  { label: "Proposta", value: 0, color: "#60a5fa" },
                  { label: "Negociação", value: 0, color: "#3b82f6" },
                  { label: "Fechado", value: 0, color: "#1d4ed8" },
                ].map((item) => {
                  // Isso vai ser preenchido com dados reais depois
                  return item;
                })}
              />
            )}
            <p className="mt-2 text-xs text-gray-400 text-center">
              Dados do funil por etapa em breve
            </p>
          </ChartCard>

          {/* Gráfico de clientes */}
          <ChartCard titulo="Status dos Clientes" loading={loading}>
            {dados && (
              <div className="flex items-center justify-center gap-6">
                <DonutChart
                  size={130}
                  data={[
                    { label: "Ativos", value: dados.clientesAtivos, color: "#22c55e" },
                    { label: "Inativos", value: dados.clientesInativos, color: "#ef4444" },
                    { label: "Prospects", value: dados.clientesProspect, color: "#a855f7" },
                  ]}
                />
                <div className="space-y-2">
                  {[
                    { label: "Ativos", valor: dados.clientesAtivos, cor: "#22c55e" },
                    { label: "Inativos", valor: dados.clientesInativos, cor: "#ef4444" },
                    { label: "Prospects", valor: dados.clientesProspect, cor: "#a855f7" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.cor }}
                      />
                      <span className="text-xs text-gray-600">
                        {item.label}: <strong>{item.valor}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      </section>

      {/* ── Seção: Operacional ── */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <Activity className="h-4 w-4" />
          Operacional
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPICard
            titulo="Funcionários"
            valor={dados?.totalFuncionarios ?? "—"}
            subtitulo={dados ? `${dados.funcionariosAtivos} ativos` : undefined}
            icon={Users}
            cor="bg-slate-50 text-slate-600"
            loading={loading}
          />
          <KPICard
            titulo="Em Atendimento"
            valor={dados?.atendimentosEmAndamento ?? "—"}
            subtitulo="Logística em campo"
            icon={Wrench}
            cor="bg-emerald-50 text-emerald-600"
            loading={loading}
          />
          <KPICard
            titulo="Programados"
            valor={dados?.atendimentosProgramados ?? "—"}
            subtitulo="Próximos agendados"
            icon={Activity}
            cor="bg-blue-50 text-blue-600"
            loading={loading}
          />
          <KPICard
            titulo="Contratos CA"
            valor={dados?.caContratos ?? "—"}
            subtitulo="Contratos Conta Azul"
            icon={Briefcase}
            cor="bg-cyan-50 text-cyan-600"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Seção: Financeiro (Conta Azul) ── */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <DollarSign className="h-4 w-4" />
          Financeiro — Conta Azul
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KPICard
            titulo="Faturamento do Mês"
            valor={dados ? fmt(dados.caFaturamento) : "—"}
            subtitulo={`${new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}`}
            icon={TrendingUp}
            cor="bg-green-50 text-green-600"
            loading={loading}
          />
          <KPICard
            titulo="A Receber (Pendente)"
            valor={dados ? fmt(dados.caReceber) : "—"}
            subtitulo="Cobranças em aberto"
            icon={DollarSign}
            cor="bg-amber-50 text-amber-600"
            loading={loading}
          />
        </div>
        {dados?.caFaturamento === 0 && dados?.caReceber === 0 && !loading && (
          <p className="mt-2 text-xs text-gray-400">
            💡 Nenhum dado do Conta Azul ainda. Sincronize em{" "}
            <a href="/painel/financeiro" className="text-blue-500 underline">
              Financeiro → Conta Azul
            </a>
            .
          </p>
        )}
      </section>

      {/* ── Seção: Materiais / Compras ── */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <ShoppingCart className="h-4 w-4" />
          Compras — Materiais Pendentes
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KPICard
            titulo="Itens a Comprar"
            valor={dados?.materiaisPendentes ?? "—"}
            subtitulo='Status "Solicitado" em atendimentos'
            icon={Package}
            cor="bg-rose-50 text-rose-600"
            loading={loading}
          />
          <KPICard
            titulo="Valor Estimado"
            valor={dados ? (dados.valorMateriais > 0 ? fmt(dados.valorMateriais) : "Sem valor") : "—"}
            subtitulo="Total dos itens solicitados"
            icon={ShoppingCart}
            cor="bg-rose-50 text-rose-600"
            loading={loading}
          />
        </div>

        {/* Placeholder para módulo de compras futuro */}
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-200 p-2">
              <ShoppingCart className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700">
                Módulo de Compras — Em Configuração
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Este módulo exibirá uma lista consolidada de materiais a comprar para todos os
                atendimentos ativos, com valores, fornecedores e links de compra. Configure os
                materiais dentro de cada atendimento na{" "}
                <a href="/painel/logistica" className="text-blue-500 underline">
                  Logística
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gráfico: Visão Geral ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <TrendingUp className="h-4 w-4" />
          Visão Geral
        </h2>
        <ChartCard titulo="Resumo do Negócio" loading={loading}>
          {dados && (
            <div className="space-y-3">
              {[
                {
                  label: "Clientes Ativos",
                  valor: dados.clientesAtivos,
                  total: dados.totalClientes,
                  cor: "#22c55e",
                },
                {
                  label: "Leads Abertas",
                  valor: dados.leadsAbertos,
                  total: dados.totalLeads,
                  cor: "#f97316",
                },
                {
                  label: "Atendimentos Ativos",
                  valor: dados.atendimentosEmAndamento + dados.atendimentosProgramados,
                  total: Math.max(dados.atendimentosEmAndamento + dados.atendimentosProgramados, 1),
                  cor: "#3b82f6",
                },
                {
                  label: "Funcionários Ativos",
                  valor: dados.funcionariosAtivos,
                  total: dados.totalFuncionarios,
                  cor: "#8b5cf6",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-800">
                      {item.valor}
                      {item.total > 0 && item.total !== item.valor && (
                        <span className="font-normal text-gray-400"> / {item.total}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: item.total > 0 ? `${Math.min((item.valor / item.total) * 100, 100)}%` : "0%",
                        backgroundColor: item.cor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </section>
    </div>
  );
}
