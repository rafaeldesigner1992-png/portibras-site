import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, UserCheck, UserX, TrendingUp, Briefcase, Wrench, DollarSign,
  Package, ShoppingCart, Loader2, AlertCircle, RefreshCw, Building2,
  ClipboardList, Activity, Target, Clock, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/")({
  component: DashboardPage,
});

// ─── Tipos ──────────────────────────────────────────────
interface DashboardData {
  // Clientes (calculados a partir de ca_vendas)
  totalClientes: number;
  clientesAtivos: number;      // fechamento < 6 meses
  clientesInativos: number;    // fechamento >= 6 meses
  // CRM — Leads por etapa
  leadsPorEtapa: Record<string, number>;
  leadsAbertos: number;
  totalLeads: number;
  // Maturação média (leads fechados)
  maturacaoMediaDias: number | null;
  // Funcionários
  totalFuncionarios: number;
  funcionariosAtivos: number;
  // Logística
  atendimentosEmAndamento: number;
  atendimentosProgramados: number;
  // Contratos CA
  caContratos: number;
  metaContratos: number;
  // Financeiro CA
  caFaturamento: number;
  caReceber: number;
  caCustos: number;
  // Compras
  materiaisPendentes: number;
  valorMateriais: number;
}

// ─── Helpers ────────────────────────────────────────────
const fmt$ = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDias = (d: number) => d === 1 ? "1 dia" : `${Math.round(d)} dias`;

// ─── Donut Chart (SVG) ───────────────────────────────────
function DonutChart({
  data,
  size = 140,
  centerLabel,
  centerSub,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center text-gray-300 text-xs" style={{ width: size, height: size }}>
      Sem dados
    </div>
  );

  const radius = 38;
  const cx = 50; const cy = 50;
  let cumulative = 0;

  const slices = data.map((d) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    return {
      ...d,
      x1: cx + radius * Math.cos(start), y1: cy + radius * Math.sin(start),
      x2: cx + radius * Math.cos(end),   y2: cy + radius * Math.sin(end),
      largeArc: end - start > Math.PI ? 1 : 0,
    };
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {slices.map((s, i) => (
        <path key={i}
          d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${radius} ${radius} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
          fill={s.color} stroke="white" strokeWidth="1.5"
        />
      ))}
      <circle cx={cx} cy={cy} r={26} fill="white" />
      {centerLabel && (
        <>
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{centerLabel}</text>
          {centerSub && <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#6b7280">{centerSub}</text>}
        </>
      )}
    </svg>
  );
}

// ─── KPI Card ───────────────────────────────────────────
function KPICard({
  titulo, valor, subtitulo, icon: Icon, cor, loading, destaque,
}: {
  titulo: string; valor: string | number; subtitulo?: React.ReactNode;
  icon: React.ElementType; cor: string; loading?: boolean; destaque?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-white p-4 shadow-sm",
      destaque ? "border-blue-200" : "border-gray-200"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded bg-gray-100 animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{valor}</p>
          )}
          {subtitulo && <p className="mt-0.5 text-xs text-gray-400">{subtitulo}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${cor} ml-3 flex-shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Barra de progresso com meta ────────────────────────
function BarraMeta({
  titulo, atual, meta, cor, link,
}: {
  titulo: string; atual: number; meta: number; cor: string; link?: string;
}) {
  const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
  const falta = Math.max(meta - atual, 0);
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-medium text-gray-700">{titulo}</span>
        <span className="text-gray-500">
          <span className="font-bold text-gray-900">{atual}</span>
          <span className="text-gray-400"> / {meta}</span>
          {falta > 0 && <span className="ml-1 text-orange-500">· faltam {falta}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: cor }}
        />
      </div>
      {link && (
        <div className="mt-1 text-right">
          <Link to={link} className="text-[10px] text-blue-500 hover:underline">ver detalhes →</Link>
        </div>
      )}
    </div>
  );
}

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
  const mesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
  const seisAno = new Date(agora.getTime() - 180 * 86400000).toISOString().slice(0, 10);

  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      const [
        clientesRes,
        leadsRes,
        leadsFechadosRes,
        funcionariosRes,
        atendimentosRes,
        materiaisRes,
        caVendasRes,
        caCobrancasRes,
        caContratosRes,
        metaContratosRes,
        caDespesasRes,
      ] = await Promise.all([
        // Clientes: status e data_ultima_vistoria para calcular ativo/inativo
        supabase.from("clientes").select("id, status, data_ultima_vistoria"),

        // Leads do CRM — apenas abertos (não fechados/perdidos)
        supabase.from("crm_leads")
          .select("etapa")
          .not("etapa", "in", '("fechado","perdido")'),

        // Leads fechados com datas para calcular maturação
        supabase.from("crm_leads")
          .select("data_inicio, data_fechamento")
          .eq("etapa", "fechado")
          .not("data_inicio", "is", null)
          .not("data_fechamento", "is", null)
          .limit(100),

        // Funcionários ativos
        supabase.from("usuarios").select("ativo"),

        // Atendimentos em andamento e programados
        supabase.from("atendimentos")
          .select("status")
          .in("status", ["Em andamento", "Programado"]),

        // Materiais pendentes de compra
        supabase.from("logistica_materiais_comprar")
          .select("status")
          .eq("status", "Pendente"),

        // CA — faturamento do mês (vendas emitidas)
        supabase.from("ca_vendas")
          .select("valor_total")
          .gte("data_emissao", mesAtual),

        // CA — a receber (cobranças pendentes, tipo receita)
        supabase.from("ca_cobrancas")
          .select("valor")
          .eq("status", "pending")
          .eq("tipo", "receita"),

        // CA — contratos ativos
        supabase.from("ca_contratos")
          .select("id")
          .eq("status", "active"),

        // Meta de contratos da tabela configuracoes
        supabase.from("configuracoes")
          .select("valor")
          .eq("chave", "meta_contratos_ativos")
          .maybeSingle(),

        // CA — despesas do mês (tipo despesa ou saida)
        supabase.from("ca_cobrancas")
          .select("valor")
          .in("tipo", ["despesa", "saida"])
          .gte("vencimento", mesAtual),
      ]);

      // ── Clientes: ativo = tem fechamento nos últimos 6 meses
      // Usamos ca_vendas para calcular clientes com faturamento recente
      const clientesTotais = clientesRes.data ?? [];
      const totalClientes = clientesTotais.length;

      // Ativos: status 'ativo' E última vistoria nos últimos 6 meses
      // Inativos: status 'inativo' OU última vistoria > 6 meses atrás
      const clientesAtivos = clientesTotais.filter(c => {
        if (c.status === "inativo") return false;
        if (c.status === "prospect") return false;
        if (!c.data_ultima_vistoria) return c.status === "ativo";
        return c.data_ultima_vistoria >= seisAno;
      }).length;

      const clientesInativos = clientesTotais.filter(c => {
        if (c.status === "inativo") return true;
        if (c.status === "prospect") return false;
        if (!c.data_ultima_vistoria) return false;
        return c.data_ultima_vistoria < seisAno;
      }).length;

      // ── CRM — leads por etapa (somente abertos)
      const leads = leadsRes.data ?? [];
      const leadsAbertos = leads.length;
      const leadsPorEtapa: Record<string, number> = {};
      leads.forEach(l => {
        leadsPorEtapa[l.etapa] = (leadsPorEtapa[l.etapa] ?? 0) + 1;
      });

      // ── Maturação média (dias entre criação e fechamento)
      const fechados = leadsFechadosRes.data ?? [];
      let maturacaoMediaDias: number | null = null;
      if (fechados.length > 0) {
        const totalDias = fechados.reduce((acc, l) => {
          const ini = new Date(l.data_inicio!).getTime();
          const fim = new Date(l.data_fechamento!).getTime();
          return acc + Math.max((fim - ini) / 86400000, 0);
        }, 0);
        maturacaoMediaDias = totalDias / fechados.length;
      }

      // ── Funcionários
      const funcionarios = funcionariosRes.data ?? [];
      const totalFuncionarios = funcionarios.length;
      const funcionariosAtivos = funcionarios.filter(f => f.ativo !== false).length;

      // ── Atendimentos
      const atendimentos = atendimentosRes.data ?? [];
      const atendimentosEmAndamento = atendimentos.filter(a => a.status === "Em andamento").length;
      const atendimentosProgramados = atendimentos.filter(a => a.status === "Programado").length;

      // ── Materiais
      const materiais = materiaisRes.data ?? [];
      const materiaisPendentes = materiais.length;
      const valorMateriais = 0; // logistica_materiais_comprar não tem valor_total

      // ── Conta Azul
      const caVendas = caVendasRes.data ?? [];
      const caFaturamento = caVendas.reduce((s, v) => s + (v.valor_total ?? 0), 0);

      const caCobrancas = caCobrancasRes.data ?? [];
      const caReceber = caCobrancas.reduce((s, c) => s + (c.valor ?? 0), 0);

      const caContratos = caContratosRes.data?.length ?? 0;

      const metaContratosValor = metaContratosRes.data?.valor
        ? parseInt(metaContratosRes.data.valor, 10)
        : 20; // padrão 20 se não configurado

      const caDespesas = caDespesasRes.data ?? [];
      const caCustos = caDespesas.reduce((s, d) => s + (d.valor ?? 0), 0);

      setDados({
        totalClientes,
        clientesAtivos,
        clientesInativos,
        leadsPorEtapa,
        leadsAbertos,
        totalLeads: leadsAbertos,
        maturacaoMediaDias,
        totalFuncionarios,
        funcionariosAtivos,
        atendimentosEmAndamento,
        atendimentosProgramados,
        materiaisPendentes,
        valorMateriais,
        caFaturamento,
        caReceber,
        caContratos,
        metaContratos: metaContratosValor,
        caCustos,
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
    const interval = setInterval(carregarDados, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Mapeamento etapas
  const ETAPAS_INFO: Record<string, { label: string; color: string }> = {
    prospecto:  { label: "Prospecto",   color: "#9ca3af" },
    contato:    { label: "Em Contato",  color: "#60a5fa" },
    proposta:   { label: "Proposta",    color: "#a78bfa" },
    negociacao: { label: "Negociação",  color: "#fb923c" },
  };
  const ETAPA_ORDER = ["prospecto", "contato", "proposta", "negociacao"];

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-7">
      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {saudacao}, {usuario?.nome?.split(" ")[0] ?? ""}! 👋
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {agora.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          {ultimaAtualizacao && (
            <p className="mt-0.5 text-xs text-gray-400">
              Atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <button onClick={carregarDados} disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* ── Erro ── */}
      {erro && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* ── Seção: Clientes na Base ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Building2 className="h-3.5 w-3.5" />
            Clientes na Base
          </h2>
          <Link to="/painel/clientes" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard
            titulo="Total"
            valor={dados?.totalClientes ?? "—"}
            subtitulo="Clientes cadastrados"
            icon={Users}
            cor="bg-blue-50 text-blue-600"
            loading={loading}
          />
          <KPICard
            titulo="Ativos"
            valor={dados?.clientesAtivos ?? "—"}
            subtitulo="Fechamento < 6 meses"
            icon={UserCheck}
            cor="bg-green-50 text-green-600"
            loading={loading}
            destaque
          />
          <KPICard
            titulo="Inativos"
            valor={dados?.clientesInativos ?? "—"}
            subtitulo="Sem fechamento + de 6 meses"
            icon={UserX}
            cor="bg-red-50 text-red-600"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Seção: CRM ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <ClipboardList className="h-3.5 w-3.5" />
            CRM — Leads & Pipeline
          </h2>
          <Link to="/painel/crm" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            Abrir CRM <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Funil por etapa */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Distribuição do Funil</h3>
              {!loading && dados && (
                <span className="text-xs text-gray-400">{dados.leadsAbertos} leads em aberto</span>
              )}
            </div>
            {loading ? (
              <div className="h-28 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : dados ? (
              <div className="space-y-2.5">
                {ETAPA_ORDER.map(e => {
                  const info = ETAPAS_INFO[e];
                  const qtd = dados.leadsPorEtapa[e] ?? 0;
                  const max = Math.max(...ETAPA_ORDER.map(k => dados.leadsPorEtapa[k] ?? 0), 1);
                  return (
                    <div key={e} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-gray-600">{info.label}</span>
                      <div className="flex-1 h-6 rounded-lg bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                          style={{ width: `${Math.max((qtd / max) * 100, qtd > 0 ? 8 : 0)}%`, backgroundColor: info.color }}
                        >
                          {qtd > 0 && <span className="text-[10px] font-bold text-white">{qtd}</span>}
                        </div>
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold text-gray-700">{qtd}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Maturação + KPIs leads */}
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2.5 bg-purple-50 text-purple-600 flex-shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tempo de Maturação</p>
                  {loading ? (
                    <div className="mt-1.5 h-7 w-24 rounded bg-gray-100 animate-pulse" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {dados?.maturacaoMediaDias != null
                        ? fmtDias(dados.maturacaoMediaDias)
                        : "—"}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">Média entre criação e fechamento do lead</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KPICard
                titulo="Leads Abertas"
                valor={dados?.leadsAbertos ?? "—"}
                icon={Briefcase}
                cor="bg-orange-50 text-orange-600"
                loading={loading}
              />
              <KPICard
                titulo="Em Negociação"
                valor={dados?.leadsPorEtapa?.["negociacao"] ?? 0}
                subtitulo="Mais próximos do fechamento"
                icon={TrendingUp}
                cor="bg-amber-50 text-amber-600"
                loading={loading}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção: Operacional ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Activity className="h-3.5 w-3.5" />
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
          {/* Contratos com meta */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos CA</p>
                {loading ? (
                  <div className="mt-1.5 h-7 w-16 rounded bg-gray-100 animate-pulse" />
                ) : (
                  <p className="mt-1 text-2xl font-bold text-gray-900">{dados?.caContratos ?? "—"}</p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">
                  meta: <span className="font-semibold text-gray-600">{dados?.metaContratos ?? "—"}</span>
                  {dados && dados.caContratos < dados.metaContratos && (
                    <span className="text-orange-500 ml-1">· faltam {dados.metaContratos - dados.caContratos}</span>
                  )}
                  {dados && dados.caContratos >= dados.metaContratos && (
                    <span className="text-green-600 ml-1">· ✓ atingida</span>
                  )}
                </p>
              </div>
              <div className="rounded-lg p-2.5 bg-cyan-50 text-cyan-600 ml-3 flex-shrink-0">
                <Target className="h-4 w-4" />
              </div>
            </div>
            {/* Barra de progresso */}
            {!loading && dados && (
              <div className="mt-2.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700",
                    dados.caContratos >= dados.metaContratos ? "bg-green-500" : "bg-cyan-500"
                  )}
                  style={{ width: `${Math.min((dados.caContratos / dados.metaContratos) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Seção: Financeiro ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <DollarSign className="h-3.5 w-3.5" />
            Financeiro — Conta Azul
          </h2>
          <Link to="/painel/financeiro" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            Ver financeiro <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KPICard
            titulo="Faturamento do Mês"
            valor={dados ? fmt$(dados.caFaturamento) : "—"}
            subtitulo={agora.toLocaleString("pt-BR", { month: "long", year: "numeric" })}
            icon={TrendingUp}
            cor="bg-green-50 text-green-600"
            loading={loading}
            destaque
          />
          <KPICard
            titulo="A Receber (Pendente)"
            valor={dados ? fmt$(dados.caReceber) : "—"}
            subtitulo="Cobranças em aberto"
            icon={DollarSign}
            cor="bg-amber-50 text-amber-600"
            loading={loading}
          />
          <KPICard
            titulo="Custos do Mês"
            valor={dados ? fmt$(dados.caCustos) : "—"}
            subtitulo="Despesas / saídas no mês"
            icon={Package}
            cor="bg-red-50 text-red-600"
            loading={loading}
          />
        </div>
        {dados && dados.caFaturamento === 0 && dados.caReceber === 0 && !loading && (
          <p className="mt-2 text-xs text-gray-400">
            💡 Nenhum dado do Conta Azul ainda. Sincronize em{" "}
            <Link to="/painel/financeiro" className="text-blue-500 underline">Financeiro → Conta Azul</Link>.
          </p>
        )}
      </section>

      {/* ── Seção: Compras ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <ShoppingCart className="h-3.5 w-3.5" />
            Compras — Materiais Pendentes
          </h2>
          <Link to="/painel/logistica" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            Ver logística <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KPICard
            titulo="Itens a Comprar"
            valor={dados?.materiaisPendentes ?? "—"}
            subtitulo='Status "Pendente" em materiais'
            icon={Package}
            cor="bg-rose-50 text-rose-600"
            loading={loading}
          />
          <KPICard
            titulo="Valor Estimado"
            valor={dados ? (dados.valorMateriais > 0 ? fmt$(dados.valorMateriais) : "Sem valor") : "—"}
            subtitulo="Total dos itens solicitados"
            icon={ShoppingCart}
            cor="bg-rose-50 text-rose-600"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Visão Geral (Donut) ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <TrendingUp className="h-3.5 w-3.5" />
          Visão Geral
        </h2>
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : dados ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {/* Clientes */}
              <div className="flex flex-col items-center gap-3">
                <DonutChart
                  size={130}
                  centerLabel={String(dados.totalClientes)}
                  centerSub="clientes"
                  data={[
                    { label: "Ativos", value: dados.clientesAtivos, color: "#22c55e" },
                    { label: "Inativos", value: dados.clientesInativos, color: "#f87171" },
                  ]}
                />
                <div className="space-y-1 text-center">
                  <p className="text-xs font-semibold text-gray-700">Clientes</p>
                  {[
                    { label: "Ativos", valor: dados.clientesAtivos, cor: "#22c55e" },
                    { label: "Inativos", valor: dados.clientesInativos, cor: "#f87171" },
                  ].map(i => (
                    <div key={i.label} className="flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: i.cor }} />
                      <span className="text-[11px] text-gray-600">{i.label}: <strong>{i.valor}</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRM Funil */}
              <div className="flex flex-col items-center gap-3">
                <DonutChart
                  size={130}
                  centerLabel={String(dados.leadsAbertos)}
                  centerSub="leads"
                  data={ETAPA_ORDER.map(e => ({
                    label: ETAPAS_INFO[e].label,
                    value: dados.leadsPorEtapa[e] ?? 0,
                    color: ETAPAS_INFO[e].color,
                  }))}
                />
                <div className="space-y-1 text-center">
                  <p className="text-xs font-semibold text-gray-700">Pipeline CRM</p>
                  {ETAPA_ORDER.filter(e => (dados.leadsPorEtapa[e] ?? 0) > 0).map(e => (
                    <div key={e} className="flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: ETAPAS_INFO[e].color }} />
                      <span className="text-[11px] text-gray-600">{ETAPAS_INFO[e].label}: <strong>{dados.leadsPorEtapa[e]}</strong></span>
                    </div>
                  ))}
                  {dados.leadsAbertos === 0 && <span className="text-[11px] text-gray-400">Sem leads em aberto</span>}
                </div>
              </div>

              {/* Contratos */}
              <div className="flex flex-col items-center gap-3">
                <DonutChart
                  size={130}
                  centerLabel={String(dados.caContratos)}
                  centerSub="contratos"
                  data={[
                    { label: "Realizados", value: dados.caContratos, color: "#06b6d4" },
                    { label: "Faltam", value: Math.max(dados.metaContratos - dados.caContratos, 0), color: "#e5e7eb" },
                  ]}
                />
                <div className="space-y-1 text-center">
                  <p className="text-xs font-semibold text-gray-700">Contratos / Meta</p>
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    <span className="text-[11px] text-gray-600">Ativos: <strong>{dados.caContratos}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="h-2 w-2 rounded-full bg-gray-200" />
                    <span className="text-[11px] text-gray-500">Meta: {dados.metaContratos}</span>
                  </div>
                </div>
              </div>

              {/* Financeiro */}
              <div className="flex flex-col items-center gap-3">
                <DonutChart
                  size={130}
                  centerLabel={dados.caFaturamento > 0 ? fmt$(dados.caFaturamento).replace("R$","") : "R$0"}
                  centerSub="faturado"
                  data={[
                    { label: "Faturamento", value: dados.caFaturamento, color: "#22c55e" },
                    { label: "A Receber", value: dados.caReceber, color: "#fbbf24" },
                    { label: "Custos", value: dados.caCustos, color: "#f87171" },
                  ].filter(d => d.value > 0)}
                />
                <div className="space-y-1 text-center">
                  <p className="text-xs font-semibold text-gray-700">Financeiro do Mês</p>
                  {[
                    { label: "Faturado", valor: dados.caFaturamento, cor: "#22c55e" },
                    { label: "A Receber", valor: dados.caReceber, cor: "#fbbf24" },
                    { label: "Custos", valor: dados.caCustos, cor: "#f87171" },
                  ].map(i => (
                    <div key={i.label} className="flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: i.cor }} />
                      <span className="text-[11px] text-gray-600">{i.label}: <strong>{fmt$(i.valor)}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
