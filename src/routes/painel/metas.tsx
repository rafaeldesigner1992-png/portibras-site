import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Target, TrendingUp, DollarSign, Megaphone, Package,
  Edit2, Check, X, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/metas")({
  component: MetasPage,
});

// ── Tipos ──────────────────────────────────────────────────────────────────
type Area = "comercial" | "financeiro" | "marketing" | "logistica";
type Unidade = "brl" | "numero" | "pct" | "dias";

interface MetaRow {
  id: string;
  periodo_mes: number;
  periodo_ano: number;
  area: Area;
  indicador: string;
  descricao: string;
  meta_valor: number;
  unidade: Unidade;
}

interface KpiRealizado {
  indicador: string;
  realizado: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const hoje = new Date();

function fmt(valor: number, unidade: Unidade): string {
  if (unidade === "brl") return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (unidade === "pct") return valor.toFixed(1) + "%";
  if (unidade === "dias") return valor + "d";
  return valor % 1 === 0 ? valor.toString() : valor.toFixed(1);
}

function progresso(realizado: number, meta: number): number {
  if (!meta) return 0;
  return Math.min(Math.round((realizado / meta) * 100), 150);
}

function statusCor(pct: number, invertido = false): string {
  // invertido = menor é melhor (ex: inadimplência, tickets abertos)
  const efetivo = invertido ? (200 - pct) : pct;
  if (efetivo >= 100) return "text-green-600";
  if (efetivo >= 70)  return "text-yellow-600";
  return "text-red-500";
}

function barCor(pct: number, invertido = false): string {
  const efetivo = invertido ? (200 - pct) : pct;
  if (efetivo >= 100) return "bg-green-500";
  if (efetivo >= 70)  return "bg-yellow-400";
  return "bg-red-400";
}

function iconeStatus(pct: number, invertido = false) {
  const efetivo = invertido ? (200 - pct) : pct;
  if (efetivo >= 100) return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (efetivo >= 70)  return <Clock className="h-4 w-4 text-yellow-500" />;
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
}

// Indicadores que "menor é melhor"
const INVERTIDOS = new Set(["inadimplencia","tickets_abertos","custos_fixos_pct","cpl"]);

// ── Componente KPI Card ────────────────────────────────────────────────────
function KpiCard({
  meta,
  realizado,
  editando,
  onEdit,
  onSave,
  onCancel,
  isAdmin,
}: {
  meta: MetaRow;
  realizado: number;
  editando: boolean;
  onEdit: () => void;
  onSave: (novoValor: number) => void;
  onCancel: () => void;
  isAdmin: boolean;
}) {
  const [editVal, setEditVal] = useState(String(meta.meta_valor));
  const pct = progresso(realizado, meta.meta_valor);
  const inv = INVERTIDOS.has(meta.indicador);

  useEffect(() => { setEditVal(String(meta.meta_valor)); }, [meta.meta_valor]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
            {meta.descricao}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {iconeStatus(pct, inv)}
          {isAdmin && !editando && (
            <button
              onClick={onEdit}
              className="rounded p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Editar meta"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Realizado vs Meta */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className={cn("text-2xl font-bold", statusCor(pct, inv))}>
            {fmt(realizado, meta.unidade)}
          </span>
          <span className="text-xs text-gray-400">
            meta:{" "}
            {editando ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  className="w-20 rounded border border-blue-300 px-1 py-0.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                />
                <button onClick={() => onSave(Number(editVal))} className="text-green-600 hover:text-green-700">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="font-medium text-gray-600">{fmt(meta.meta_valor, meta.unidade)}</span>
            )}
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barCor(pct, inv))}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-gray-400">{pct}%</p>
      </div>
    </div>
  );
}

// ── Componente de Seção de Área ────────────────────────────────────────────
function AreaSection({
  area,
  label,
  icon: Icon,
  cor,
  metas,
  realizados,
  expandido,
  onToggle,
  editandoId,
  onEdit,
  onSave,
  onCancel,
  isAdmin,
}: {
  area: Area;
  label: string;
  icon: React.ElementType;
  cor: string;
  metas: MetaRow[];
  realizados: KpiRealizado[];
  expandido: boolean;
  onToggle: () => void;
  editandoId: string | null;
  onEdit: (id: string) => void;
  onSave: (id: string, val: number) => void;
  onCancel: () => void;
  isAdmin: boolean;
}) {
  const realizadoMap = Object.fromEntries(realizados.map(r => [r.indicador, r.realizado]));

  // Score da área: média dos progressos
  const scores = metas.map(m => {
    const r = realizadoMap[m.indicador] ?? 0;
    const inv = INVERTIDOS.has(m.indicador);
    const p = progresso(r, m.meta_valor);
    return inv ? Math.min(200 - p, 100) : Math.min(p, 100);
  });
  const scoreArea = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;

  return (
    <div className={cn("rounded-2xl border-2 overflow-hidden transition-all", cor)}>
      {/* Header da seção */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
            <Icon className="h-5 w-5 text-gray-700" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">{label}</p>
            <p className="text-xs text-gray-500">{metas.length} indicadores</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Score da área */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={cn("text-lg font-bold", scoreArea >= 100 ? "text-green-600" : scoreArea >= 70 ? "text-yellow-600" : "text-red-500")}>
                {scoreArea}%
              </p>
              <p className="text-xs text-gray-400">atingido</p>
            </div>
            <div className="h-9 w-9 relative">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={scoreArea >= 100 ? "#16a34a" : scoreArea >= 70 ? "#ca8a04" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${(scoreArea / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
          {expandido ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* KPIs */}
      {expandido && (
        <div className="px-4 pb-5 pt-1 bg-white/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metas.map(m => (
              <KpiCard
                key={m.id}
                meta={m}
                realizado={realizadoMap[m.indicador] ?? 0}
                editando={editandoId === m.id}
                onEdit={() => onEdit(m.id)}
                onSave={(val) => onSave(m.id, val)}
                onCancel={onCancel}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
function MetasPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";

  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());

  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [realizados, setRealizados] = useState<Record<Area, KpiRealizado[]>>({
    comercial: [], financeiro: [], marketing: [], logistica: [],
  });
  const [carregando, setCarregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Record<Area, boolean>>({
    comercial: true, financeiro: true, marketing: true, logistica: true,
  });
  const [salvando, setSalvando] = useState(false);

  // ── Buscar metas do período ──────────────────────────────────────────────
  const carregarMetas = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("metas_kpis")
      .select("*")
      .eq("periodo_mes", mesSel)
      .eq("periodo_ano", anoSel)
      .order("area")
      .order("indicador");
    setMetas((data as MetaRow[]) ?? []);
    setCarregando(false);
  }, [mesSel, anoSel]);

  // ── Buscar dados reais (realizados) ─────────────────────────────────────
  const carregarRealizados = useCallback(async () => {
    const inicioMes = `${anoSel}-${String(mesSel).padStart(2,"0")}-01`;
    const fimMes = new Date(anoSel, mesSel, 0).toISOString().slice(0,10);

    // ── FINANCEIRO ─────────────────────────────────────────────────────────
    const { data: lancamentos } = await supabase
      .from("financeiro_lancamentos")
      .select("tipo, valor")
      .gte("data", inicioMes)
      .lte("data", fimMes);

    const receita = (lancamentos ?? []).filter(l => l.tipo === "receita").reduce((s,l) => s + l.valor, 0);
    const despesa = (lancamentos ?? []).filter(l => l.tipo === "despesa").reduce((s,l) => s + l.valor, 0);
    const margemLucro = receita > 0 ? ((receita - despesa) / receita) * 100 : 0;

    const { data: custos } = await supabase.from("financeiro_custos_fixos").select("valor_mensal").eq("ativo", true);
    const totalCustos = (custos ?? []).reduce((s:number,c:{valor_mensal:number}) => s + c.valor_mensal, 0);
    const custosPct = receita > 0 ? (totalCustos / receita) * 100 : 0;

    // ── COMERCIAL ──────────────────────────────────────────────────────────
    const { data: contratos } = await supabase
      .from("contratos")
      .select("valor, status, criado_em")
      .gte("criado_em", inicioMes + "T00:00:00")
      .lte("criado_em", fimMes + "T23:59:59");

    const contratosAtivos = (contratos ?? []).filter(c => c.status !== "cancelado");
    const faturamentoMes = contratosAtivos.reduce((s,c) => s + (c.valor ?? 0), 0);
    const novosContratos = contratosAtivos.length;
    const ticketMedio = novosContratos > 0 ? faturamentoMes / novosContratos : 0;

    // Taxa conversão CRM: contratos / leads do período
    const { count: totalLeads } = await supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .gte("criado_em", inicioMes + "T00:00:00")
      .lte("criado_em", fimMes + "T23:59:59");
    const taxaConversao = (totalLeads ?? 0) > 0 ? (novosContratos / (totalLeads ?? 1)) * 100 : 0;

    // ── MARKETING ─────────────────────────────────────────────────────────
    const { data: adsData } = await supabase
      .from("mkt_google_ads")
      .select("impressions, clicks, spend")
      .gte("date", inicioMes)
      .lte("date", fimMes);

    const totalClicks   = (adsData ?? []).reduce((s,r) => s + r.clicks, 0);
    const totalSpend    = (adsData ?? []).reduce((s,r) => s + r.spend, 0);
    const totalImpress  = (adsData ?? []).reduce((s,r) => s + r.impressions, 0);
    const ctrMedio      = totalImpress > 0 ? (totalClicks / totalImpress) * 100 : 0;
    const cpl           = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // ── LOGÍSTICA ─────────────────────────────────────────────────────────
    const { data: pedidos } = await supabase
      .from("logistica_pedidos")
      .select("etapa, is_ticket, ticket_sla_at, atualizado_em")
      .gte("criado_em", inicioMes + "T00:00:00")
      .lte("criado_em", fimMes + "T23:59:59");

    const osConcluidas = (pedidos ?? []).filter(p => p.etapa === "concluido" && !p.is_ticket).length;
    const tickets = (pedidos ?? []).filter(p => p.is_ticket);
    const ticketsAbertos = tickets.filter(t => t.etapa !== "concluido" && t.etapa !== "cancelado").length;
    const ticketsTotal = tickets.length;
    const slaCumprido = ticketsTotal > 0
      ? (tickets.filter(t => {
          if (!t.ticket_sla_at || t.etapa !== "concluido") return false;
          return new Date(t.atualizado_em) <= new Date(t.ticket_sla_at);
        }).length / ticketsTotal) * 100
      : 100;

    setRealizados({
      comercial: [
        { indicador: "faturamento_mes",   realizado: faturamentoMes },
        { indicador: "novos_contratos",    realizado: novosContratos },
        { indicador: "taxa_conversao_crm", realizado: taxaConversao },
        { indicador: "ticket_medio",       realizado: ticketMedio },
      ],
      financeiro: [
        { indicador: "receita_liquida",    realizado: receita },
        { indicador: "margem_lucro",       realizado: margemLucro },
        { indicador: "inadimplencia",      realizado: 0 }, // sem tabela de inadimplência ainda
        { indicador: "custos_fixos_pct",   realizado: custosPct },
      ],
      marketing: [
        { indicador: "leads_mes",          realizado: totalClicks },
        { indicador: "cpl",                realizado: cpl },
        { indicador: "ctr_medio",          realizado: ctrMedio },
        { indicador: "investimento_ads",   realizado: totalSpend },
      ],
      logistica: [
        { indicador: "os_concluidas",      realizado: osConcluidas },
        { indicador: "sla_cumprido_pct",   realizado: slaCumprido },
        { indicador: "tickets_abertos",    realizado: ticketsAbertos },
        { indicador: "nps",                realizado: 0 }, // sem tabela NPS ainda
      ],
    });
  }, [mesSel, anoSel]);

  useEffect(() => {
    carregarMetas();
    carregarRealizados();
  }, [carregarMetas, carregarRealizados]);

  // ── Salvar meta editada ──────────────────────────────────────────────────
  async function salvarMeta(id: string, novoValor: number) {
    setSalvando(true);
    await supabase
      .from("metas_kpis")
      .update({ meta_valor: novoValor, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    setMetas(prev => prev.map(m => m.id === id ? { ...m, meta_valor: novoValor } : m));
    setEditandoId(null);
    setSalvando(false);
  }

  // ── Score geral ──────────────────────────────────────────────────────────
  const scoreGeral = (() => {
    const all: number[] = [];
    for (const area of ["comercial","financeiro","marketing","logistica"] as Area[]) {
      const metasArea = metas.filter(m => m.area === area);
      const rels = realizados[area];
      const relMap = Object.fromEntries(rels.map(r => [r.indicador, r.realizado]));
      metasArea.forEach(m => {
        const r = relMap[m.indicador] ?? 0;
        const inv = INVERTIDOS.has(m.indicador);
        const p = progresso(r, m.meta_valor);
        all.push(inv ? Math.min(200 - p, 100) : Math.min(p, 100));
      });
    }
    return all.length ? Math.round(all.reduce((a,b) => a+b,0) / all.length) : 0;
  })();

  const AREAS: { area: Area; label: string; icon: React.ElementType; cor: string }[] = [
    { area: "comercial",  label: "Comercial",  icon: TrendingUp,  cor: "border-blue-200 bg-blue-50/60" },
    { area: "financeiro", label: "Financeiro", icon: DollarSign,  cor: "border-emerald-200 bg-emerald-50/60" },
    { area: "marketing",  label: "Marketing",  icon: Megaphone,   cor: "border-purple-200 bg-purple-50/60" },
    { area: "logistica",  label: "Logística",  icon: Package,     cor: "border-orange-200 bg-orange-50/60" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Metas & KPIs</h1>
              <p className="text-xs text-gray-500">Gestão C-Level — Visão integrada</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de período */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
              <select
                value={mesSel}
                onChange={e => setMesSel(Number(e.target.value))}
                className="border-none bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
              >
                {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select
                value={anoSel}
                onChange={e => setAnoSel(Number(e.target.value))}
                className="border-none bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
              >
                {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <button
              onClick={() => { carregarMetas(); carregarRealizados(); }}
              disabled={carregando}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Score Geral C-Level */}
        <div className="rounded-2xl bg-gradient-to-r from-[#1a6b2f] to-[#2d8f47] p-5 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-green-200">Score Geral da Empresa</p>
              <p className="mt-1 text-5xl font-black">{scoreGeral}%</p>
              <p className="mt-1 text-sm text-green-100">
                {scoreGeral >= 100 ? "🎯 Metas atingidas — excelente desempenho!" :
                 scoreGeral >= 70  ? "⚡ Em progresso — acompanhe os KPIs críticos" :
                 "⚠️ Atenção — revise as estratégias de captação"}
              </p>
            </div>
            <div className="flex gap-4">
              {AREAS.map(({ area, label, icon: Icon }) => {
                const metasArea = metas.filter(m => m.area === area);
                const rels = realizados[area];
                const relMap = Object.fromEntries(rels.map(r => [r.indicador, r.realizado]));
                const scores = metasArea.map(m => {
                  const r = relMap[m.indicador] ?? 0;
                  const inv = INVERTIDOS.has(m.indicador);
                  const p = progresso(r, m.meta_valor);
                  return inv ? Math.min(200 - p, 100) : Math.min(p, 100);
                });
                const sc = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
                return (
                  <div key={area} className="text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mx-auto mb-1">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-green-100">{label}</p>
                    <p className={cn("text-sm font-bold", sc >= 100 ? "text-green-200" : sc >= 70 ? "text-yellow-200" : "text-red-300")}>
                      {sc}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barra global */}
          <div className="mt-4 h-2 w-full rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/80 transition-all duration-700"
              style={{ width: `${Math.min(scoreGeral, 100)}%` }}
            />
          </div>
        </div>

        {/* Aviso de carregamento */}
        {carregando && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        )}

        {/* Seções por área */}
        {!carregando && AREAS.map(({ area, label, icon, cor }) => {
          const metasArea = metas.filter(m => m.area === area);
          if (metasArea.length === 0) return null;
          return (
            <AreaSection
              key={area}
              area={area}
              label={label}
              icon={icon}
              cor={cor}
              metas={metasArea}
              realizados={realizados[area]}
              expandido={expandidos[area]}
              onToggle={() => setExpandidos(prev => ({ ...prev, [area]: !prev[area] }))}
              editandoId={editandoId}
              onEdit={(id) => setEditandoId(id)}
              onSave={salvarMeta}
              onCancel={() => setEditandoId(null)}
              isAdmin={isAdmin}
            />
          );
        })}

        {/* Estado vazio */}
        {!carregando && metas.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
            <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">Nenhuma meta cadastrada para {MESES[mesSel-1]}/{anoSel}</p>
            <p className="mt-1 text-xs text-gray-400">
              Execute o SQL de criação da tabela no Supabase para adicionar as metas iniciais.
            </p>
          </div>
        )}

        {salvando && (
          <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Salvando meta...
          </div>
        )}
      </div>
    </div>
  );
}
