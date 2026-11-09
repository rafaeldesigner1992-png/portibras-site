import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp, MousePointerClick, DollarSign, Zap, RefreshCw,
  Loader2, Eye, BarChart3, ArrowUp, ArrowDown, Minus, AlertCircle, Info, Sparkles,
  Play, Pause, Settings2, Check, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/marketing")({
  component: MarketingPage,
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Periodo = "hoje" | "7" | "14" | "30" | "90";

interface DadoKeyword {
  date_from: string;
  date_to: string;
  keyword_text: string | null;
  keyword_match_type: string | null;
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number | null;
}

interface DadoDiario {
  date: string;
  campaign: string;
  campaign_id?: string;
  campaign_status?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number | null;
  cpa: number | null;
}

interface CampanhaSumarizada {
  nome: string;
  campaign_id: string;
  status: "ENABLED" | "PAUSED" | string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

interface WindsorRow {
  date: string;
  campaign: string;
  campaign_id: string;
  campaign_status: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number | null;
  conversions: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtN = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function VariacaoBadge({ pct, inverso = false }: { pct: number | null; inverso?: boolean }) {
  if (pct === null) return <span className="text-xs text-gray-400">—</span>;
  const positivo = inverso ? pct < 0 : pct > 0;
  const cor = positivo ? "text-green-600" : pct === 0 ? "text-gray-400" : "text-red-500";
  const Icon = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : Minus;
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", cor)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function MarketingPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [dados, setDados] = useState<DadoDiario[]>([]);
  const [dadosAnt, setDadosAnt] = useState<DadoDiario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semDados, setSemDados] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"campanhas" | "tendencia" | "keywords" | "insights" | "gerir">("campanhas");
  const [keywords, setKeywords] = useState<DadoKeyword[]>([]);
  const [carregandoKw, setCarregandoKw] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [gerandoInsight, setGerandoInsight] = useState(false);
  const [erroInsight, setErroInsight] = useState<string | null>(null);
  const [insightMeta, setInsightMeta] = useState<{ gerado_em: string; periodo_dias: number } | null>(null);

  // Gestão de campanhas
  const [campanhasLive, setCampanhasLive] = useState<WindsorRow[]>([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [sucessoAcao, setSucessoAcao] = useState<string | null>(null);
  const [editandoBudget, setEditandoBudget] = useState<string | null>(null);
  const [budgetValor, setBudgetValor] = useState("");

  // Datas utilitárias
  function getDatas(p: Periodo) {
    const hoje = new Date();
    const dataFim = hoje.toISOString().slice(0, 10);
    if (p === "hoje") {
      return { dataInicio: dataFim, dataFim, dataInicioAnt: dataFim, dataFimAnt: dataFim };
    }
    const dias = Number(p);
    const dataInicio = new Date(hoje.getTime() - dias * 86400000).toISOString().slice(0, 10);
    const dataInicioAnt = new Date(hoje.getTime() - dias * 2 * 86400000).toISOString().slice(0, 10);
    const dataFimAnt = new Date(hoje.getTime() - dias * 86400000 - 86400000).toISOString().slice(0, 10);
    return { dataInicio, dataFim, dataInicioAnt, dataFimAnt };
  }

  const carregar = useCallback(async (p: Periodo = periodo) => {
    setCarregando(true);
    setErro(null);
    setSemDados(false);
    try {
      const { dataInicio, dataFim, dataInicioAnt, dataFimAnt } = getDatas(p);

      const [resAtual, resAnt] = await Promise.all([
        supabase.from("mkt_google_ads").select("*")
          .gte("date", dataInicio).lte("date", dataFim)
          .order("date", { ascending: true }),
        supabase.from("mkt_google_ads").select("*")
          .gte("date", dataInicioAnt).lte("date", dataFimAnt)
          .order("date", { ascending: true }),
      ]);

      if (resAtual.error) throw resAtual.error;
      if (resAnt.error) throw resAnt.error;

      setDados(resAtual.data ?? []);
      setDadosAnt(resAnt.data ?? []);
      if ((resAtual.data ?? []).length === 0) setSemDados(true);
    } catch (e) {
      setErro("Erro ao carregar dados. Verifique a conexão.");
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  const carregarKeywords = useCallback(async () => {
    setCarregandoKw(true);
    try {
      const { data, error } = await supabase
        .from("mkt_google_ads_keywords")
        .select("*")
        .order("clicks", { ascending: false });
      if (error) throw error;
      setKeywords(data ?? []);
    } catch (e) {
      console.error("Erro ao carregar keywords:", e);
    } finally {
      setCarregandoKw(false);
    }
  }, []);

  const gerarInsight = useCallback(async () => {
    setGerandoInsight(true);
    setErroInsight(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/marketing-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ periodo: periodo === "hoje" ? 1 : Number(periodo) }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsight(data.insight);
      setInsightMeta({ gerado_em: data.gerado_em, periodo_dias: data.periodo_dias });
    } catch (e) {
      setErroInsight("Erro ao gerar insights. Verifique a API Key da OpenAI no Supabase.");
      console.error(e);
    } finally {
      setGerandoInsight(false);
    }
  }, [periodo]);

  // Carrega campanhas ao vivo via Supabase (cache Windsor)
  const carregarCampanhasLive = useCallback(async () => {
    setCarregandoCampanhas(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const dataInicio7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("mkt_google_ads")
        .select("campaign, campaign_id, campaign_status, impressions, clicks, spend, ctr, cpc, conversions, date")
        .gte("date", dataInicio7)
        .lte("date", hoje)
        .order("date", { ascending: false });
      if (error) throw error;
      // Pega status mais recente por campanha
      const mapaStatus: Record<string, WindsorRow> = {};
      (data ?? []).forEach((r: WindsorRow) => {
        if (!mapaStatus[r.campaign_id]) {
          mapaStatus[r.campaign_id] = { ...r };
        }
      });
      setCampanhasLive(Object.values(mapaStatus));
    } catch (e) {
      console.error("Erro ao carregar campanhas live:", e);
    } finally {
      setCarregandoCampanhas(false);
    }
  }, []);

  useEffect(() => { carregar(periodo); }, [periodo]);
  useEffect(() => { carregarKeywords(); }, []);
  useEffect(() => {
    if (abaAtiva === "gerir") carregarCampanhasLive();
  }, [abaAtiva]);

  // ── Agregações ──────────────────────────────────────────────────────────────
  const total = {
    impressions: dados.reduce((s, d) => s + d.impressions, 0),
    clicks: dados.reduce((s, d) => s + d.clicks, 0),
    spend: dados.reduce((s, d) => s + d.spend, 0),
    conversions: dados.reduce((s, d) => s + d.conversions, 0),
  };
  const totalAnt = {
    impressions: dadosAnt.reduce((s, d) => s + d.impressions, 0),
    clicks: dadosAnt.reduce((s, d) => s + d.clicks, 0),
    spend: dadosAnt.reduce((s, d) => s + d.spend, 0),
    conversions: dadosAnt.reduce((s, d) => s + d.conversions, 0),
  };
  const ctr = total.impressions > 0 ? total.clicks / total.impressions : 0;
  const cpc = total.clicks > 0 ? total.spend / total.clicks : 0;
  const ctrAnt = totalAnt.impressions > 0 ? totalAnt.clicks / totalAnt.impressions : 0;
  const cpcAnt = totalAnt.clicks > 0 ? totalAnt.spend / totalAnt.clicks : 0;

  // ── Por campanha ────────────────────────────────────────────────────────────
  const porCampanha = Object.values(
    dados.reduce<Record<string, CampanhaSumarizada>>((acc, d) => {
      if (!acc[d.campaign]) acc[d.campaign] = {
        nome: d.campaign,
        campaign_id: d.campaign_id ?? "",
        status: d.campaign_status ?? "ENABLED",
        impressions: 0, clicks: 0, spend: 0, conversions: 0, ctr: 0, cpc: 0,
      };
      acc[d.campaign].impressions += d.impressions;
      acc[d.campaign].clicks += d.clicks;
      acc[d.campaign].spend += d.spend;
      acc[d.campaign].conversions += d.conversions;
      return acc;
    }, {})
  ).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
  })).sort((a, b) => b.spend - a.spend);

  // ── Por dia ────────────────────────────────────────────────────────────────
  const porDia = Object.values(
    dados.reduce<Record<string, { date: string; spend: number; clicks: number }>>((acc, d) => {
      if (!acc[d.date]) acc[d.date] = { date: d.date, spend: 0, clicks: 0 };
      acc[d.date].spend += d.spend;
      acc[d.date].clicks += d.clicks;
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const maxSpend = Math.max(...porDia.map(d => d.spend), 1);

  // ── KPIs reordenados para objetivo Tráfego ──────────────────────────────────
  // Prioridade: Cliques > CTR > CPC > Investimento > Impressões > Conversões
  const kpis = [
    { label: "Cliques", valor: fmtN(total.clicks), var: variacao(total.clicks, totalAnt.clicks), icon: MousePointerClick, cor: "bg-blue-50 text-blue-600", inverso: false, destaque: true },
    { label: "CTR médio", valor: fmtPct(ctr), var: variacao(ctr, ctrAnt), icon: TrendingUp, cor: "bg-green-50 text-green-600", inverso: false, destaque: true },
    { label: "CPC médio", valor: fmt$(cpc), var: variacao(cpc, cpcAnt), icon: Zap, cor: "bg-orange-50 text-orange-600", inverso: true, destaque: true },
    { label: "Investimento", valor: fmt$(total.spend), var: variacao(total.spend, totalAnt.spend), icon: DollarSign, cor: "bg-indigo-50 text-indigo-600", inverso: true, destaque: false },
    { label: "Impressões", valor: fmtN(total.impressions), var: variacao(total.impressions, totalAnt.impressions), icon: Eye, cor: "bg-purple-50 text-purple-600", inverso: false, destaque: false },
    { label: "Conversões", valor: fmtN(total.conversions), var: variacao(total.conversions, totalAnt.conversions), icon: BarChart3, cor: "bg-emerald-50 text-emerald-600", inverso: false, destaque: false },
  ];

  const labelPeriodo = periodo === "hoje" ? "hoje" : `últimos ${periodo} dias`;

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="mt-0.5 text-sm text-gray-500">Google Ads — conta 569-519-6221</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => carregar(periodo)}
            disabled={carregando}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Seletor de período ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-gray-500">Período:</span>
        {([
          { key: "hoje", label: "Hoje" },
          { key: "7", label: "7 dias" },
          { key: "14", label: "14 dias" },
          { key: "30", label: "30 dias" },
          { key: "90", label: "90 dias" },
        ] as const).map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition",
              periodo === p.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}>{p.label}</button>
        ))}
        {periodo !== "hoje" && (
          <span className="ml-2 text-xs text-gray-400">vs. período anterior</span>
        )}
      </div>

      {/* ── Erro ── */}
      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* ── Sem dados ── */}
      {!carregando && semDados && !erro && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Nenhum dado ainda</p>
          <p>Peça ao Claude para <strong>"Sincronizar dados do Google Ads"</strong> para buscar os dados reais do Windsor.ai.</p>
        </div>
      )}

      {/* ── Info sincronização ── */}
      {!carregando && !semDados && !erro && dados.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Para sincronizar dados novos, peça ao Claude: <strong className="ml-1">"Sincronize os dados do Google Ads no Marketing"</strong>
        </div>
      )}

      {/* ── KPIs ── */}
      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* KPIs destaque (tráfego): Cliques, CTR, CPC */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">🎯 Objetivo: Tráfego</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {kpis.filter(k => k.destaque).map(k => (
                <div key={k.label} className="rounded-xl border-2 border-blue-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", k.cor)}>
                      <k.icon className="h-4 w-4" />
                    </div>
                    <VariacaoBadge pct={k.var} inverso={k.inverso} />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">{k.valor}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{k.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs secundários */}
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.filter(k => !k.destaque).map(k => (
              <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", k.cor)}>
                      <k.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-gray-500">{k.label}</span>
                  </div>
                  <VariacaoBadge pct={k.var} inverso={k.inverso} />
                </div>
                <p className="mt-2 text-lg font-bold text-gray-800 pl-9">{k.valor}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
            {([
              { key: "campanhas", label: "Por Campanha" },
              { key: "tendencia", label: "Tendência diária" },
              { key: "keywords", label: "Palavras-chave" },
              { key: "insights", label: "✨ IA Insights" },
              { key: "gerir", label: "⚙️ Gerir Campanhas" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setAbaAtiva(t.key)}
                className={cn("rounded-lg px-3 py-2 text-sm font-medium transition",
                  abaAtiva === t.key ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                )}>{t.label}</button>
            ))}
          </div>

          {/* ── Por Campanha ── */}
          {abaAtiva === "campanhas" && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <span className="text-sm font-semibold text-gray-800">Desempenho por Campanha</span>
                <span className="ml-2 text-xs text-gray-400">{labelPeriodo}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                      <th className="px-5 py-3">Campanha</th>
                      <th className="px-4 py-3 text-right">Cliques</th>
                      <th className="px-4 py-3 text-right">CTR</th>
                      <th className="px-4 py-3 text-right">CPC</th>
                      <th className="px-4 py-3 text-right">Invest.</th>
                      <th className="px-4 py-3 text-right">Impressões</th>
                      <th className="px-4 py-3 text-right">Conv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {porCampanha.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-400">Nenhum dado no período</td></tr>
                    ) : porCampanha.map(c => (
                      <tr key={c.nome} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[260px]">
                          <span className="block truncate" title={c.nome}>{c.nome}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-blue-700">{fmtN(c.clicks)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-green-700">{fmtPct(c.ctr)}</td>
                        <td className="px-4 py-3.5 text-right text-orange-700">{c.cpc > 0 ? fmt$(c.cpc) : "—"}</td>
                        <td className="px-4 py-3.5 text-right text-gray-700">{fmt$(c.spend)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{fmtN(c.impressions)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{c.conversions > 0 ? fmtN(c.conversions) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  {porCampanha.length > 0 && (
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr className="text-xs font-semibold text-gray-700">
                        <td className="px-5 py-3">Total</td>
                        <td className="px-4 py-3 text-right text-blue-700">{fmtN(total.clicks)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmtPct(ctr)}</td>
                        <td className="px-4 py-3 text-right text-orange-700">{fmt$(cpc)}</td>
                        <td className="px-4 py-3 text-right">{fmt$(total.spend)}</td>
                        <td className="px-4 py-3 text-right">{fmtN(total.impressions)}</td>
                        <td className="px-4 py-3 text-right">{fmtN(total.conversions)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Palavras-chave ── */}
          {abaAtiva === "keywords" && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-800">Palavras-chave</span>
                  <span className="ml-2 text-xs text-gray-400">últimos 90 dias · ordenado por cliques</span>
                </div>
                {carregandoKw && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                      <th className="px-5 py-3">Palavra-chave</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-4 py-3 text-right">Cliques</th>
                      <th className="px-4 py-3 text-right">CTR</th>
                      <th className="px-4 py-3 text-right">CPC</th>
                      <th className="px-4 py-3 text-right">Impressões</th>
                      <th className="px-4 py-3 text-right">Invest.</th>
                      <th className="px-4 py-3 text-right">Conv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {keywords.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-xs text-gray-400">
                        {carregandoKw ? "Carregando..." : "Nenhum dado — execute o keywords_seed.sql no Supabase"}
                      </td></tr>
                    ) : keywords.map((k, i) => {
                      const matchColor = k.keyword_match_type === "EXACT"
                        ? "bg-blue-100 text-blue-700"
                        : k.keyword_match_type === "PHRASE"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-orange-100 text-orange-700";
                      return (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[220px]">
                            <span className="block truncate" title={k.keyword_text ?? "—"}>{k.keyword_text ?? <span className="text-gray-400 italic">sem keyword</span>}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            {k.keyword_match_type ? (
                              <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", matchColor)}>
                                {k.keyword_match_type === "EXACT" ? "Exato" : k.keyword_match_type === "PHRASE" ? "Frase" : "Ampla"}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-blue-700">{fmtN(k.clicks)}</td>
                          <td className="px-4 py-3.5 text-right text-green-700">{fmtPct(k.ctr)}</td>
                          <td className="px-4 py-3.5 text-right text-orange-700">{k.cpc ? fmt$(k.cpc) : "—"}</td>
                          <td className="px-4 py-3.5 text-right text-gray-600">{fmtN(k.impressions)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{k.spend > 0 ? fmt$(k.spend) : "—"}</td>
                          <td className="px-4 py-3.5 text-right text-gray-600">{k.conversions > 0 ? fmtN(k.conversions) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── IA Insights ── */}
          {abaAtiva === "insights" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">Agente de Marketing IA</span>
                    </div>
                    <p className="mt-1 text-xs text-purple-700">
                      Especialista em Google Ads · Neuromarketing · Mercado Corta-Fogo · Objetivo Tráfego
                    </p>
                    {insightMeta && (
                      <p className="mt-1 text-xs text-purple-500">
                        Gerado em {new Date(insightMeta.gerado_em).toLocaleString("pt-BR")} · últimos {insightMeta.periodo_dias} dias
                      </p>
                    )}
                  </div>
                  <button
                    onClick={gerarInsight}
                    disabled={gerandoInsight}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60 transition shadow-sm"
                  >
                    {gerandoInsight
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                      : <><Sparkles className="h-4 w-4" /> {insight ? "Atualizar Insights" : "Gerar Insights"}</>
                    }
                  </button>
                </div>
              </div>

              {erroInsight && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {erroInsight}
                </div>
              )}

              {!insight && !gerandoInsight && !erroInsight && (
                <div className="rounded-xl border border-dashed border-purple-200 bg-white px-6 py-12 text-center">
                  <Sparkles className="mx-auto h-10 w-10 text-purple-300 mb-3" />
                  <p className="text-sm font-medium text-gray-700">Nenhuma análise gerada ainda</p>
                  <p className="mt-1 text-xs text-gray-400">Clique em "Gerar Insights" para o agente analisar seus dados de Google Ads</p>
                </div>
              )}

              {gerandoInsight && (
                <div className="rounded-xl border border-purple-100 bg-white px-6 py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-500 mb-3" />
                  <p className="text-sm font-medium text-gray-700">Analisando suas campanhas...</p>
                  <p className="mt-1 text-xs text-gray-400">O agente está estudando seus dados · aguarde ~15 segundos</p>
                </div>
              )}

              {insight && !gerandoInsight && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
                    <span className="text-xs font-medium text-gray-500">Análise do Agente IA — GPT-4o-mini</span>
                  </div>
                  <div className="px-5 py-5 prose prose-sm max-w-none text-gray-800"
                    dangerouslySetInnerHTML={{
                      __html: insight
                        .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-5 mb-2">$1</h2>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
                        .replace(/\n\n/g, '<br/><br/>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Tendência diária ── */}
          {abaAtiva === "tendencia" && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <span className="text-sm font-semibold text-gray-800">Investimento diário</span>
                <span className="ml-2 text-xs text-gray-400">R$ por dia</span>
              </div>
              <div className="p-5">
                {porDia.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-400">Nenhum dado no período</p>
                ) : (
                  <div className="space-y-2">
                    {porDia.map(d => (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs text-gray-500">
                          {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(d.spend / maxSpend) * 100}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs font-semibold text-gray-700">{fmt$(d.spend)}</span>
                        <span className="w-16 shrink-0 text-right text-xs text-gray-500">{fmtN(d.clicks)} cliques</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Gerir Campanhas ── */}
          {abaAtiva === "gerir" && (
            <div className="space-y-4">
              {/* Aviso */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Gestão de campanhas via Claude</strong> — Para pausar/ativar campanhas ou alterar orçamentos, basta pedir ao Claude.
                  Exemplo: <em>"Pause a campanha Buskas" </em> ou <em>"Defina orçamento diário de R$50 para a campanha Search Manutenção RJ"</em>.<br/>
                  Abaixo está o status atual das campanhas (últimos 7 dias).
                </div>
              </div>

              {/* Feedback de ação */}
              {sucessoAcao && (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <Check className="h-4 w-4 shrink-0" />
                  {sucessoAcao}
                </div>
              )}
              {erroAcao && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <X className="h-4 w-4 shrink-0" />
                  {erroAcao}
                </div>
              )}

              {/* Tabela de campanhas */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">Campanhas Ativas</span>
                    <span className="ml-2 text-xs text-gray-400">conta 569-519-6221</span>
                  </div>
                  <button
                    onClick={carregarCampanhasLive}
                    disabled={carregandoCampanhas}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", carregandoCampanhas && "animate-spin")} />
                    Atualizar
                  </button>
                </div>

                {carregandoCampanhas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : campanhasLive.length === 0 ? (
                  <div className="px-5 py-10 text-center text-xs text-gray-400">
                    Nenhuma campanha encontrada nos últimos 7 dias.<br/>
                    Peça ao Claude para sincronizar os dados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                          <th className="px-5 py-3">Campanha</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Cliques (7d)</th>
                          <th className="px-4 py-3 text-right">Invest. (7d)</th>
                          <th className="px-4 py-3 text-right">CPC (7d)</th>
                          <th className="px-4 py-3 text-center">Ações via Claude</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {campanhasLive.map(c => (
                          <tr key={c.campaign_id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[240px]">
                              <span className="block truncate text-xs" title={c.campaign}>{c.campaign}</span>
                              <span className="text-[10px] text-gray-400">ID: {c.campaign_id}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                c.campaign_status === "ENABLED"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              )}>
                                {c.campaign_status === "ENABLED"
                                  ? <><Play className="h-2.5 w-2.5" /> Ativa</>
                                  : <><Pause className="h-2.5 w-2.5" /> Pausada</>
                                }
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-blue-700">{fmtN(c.clicks)}</td>
                            <td className="px-4 py-3.5 text-right text-gray-700">{fmt$(c.spend)}</td>
                            <td className="px-4 py-3.5 text-right text-orange-700">{c.cpc ? fmt$(c.cpc) : "—"}</td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 italic">
                                  Peça ao Claude
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Exemplos de comandos */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
                <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" /> Comandos disponíveis via Claude
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { emoji: "⏸️", cmd: "Pause a campanha [nome]", desc: "Para uma campanha específica" },
                    { emoji: "▶️", cmd: "Ative a campanha [nome]", desc: "Reativa uma campanha pausada" },
                    { emoji: "💰", cmd: "Defina orçamento diário R$XX para [campanha]", desc: "Ajusta o budget diário" },
                    { emoji: "🎯", cmd: "Defina CPC máximo R$X para [campanha]", desc: "Ajusta o lance máximo por clique" },
                  ].map(ex => (
                    <div key={ex.cmd} className="rounded-lg bg-white border border-blue-100 px-3 py-2.5">
                      <p className="text-xs font-medium text-gray-800">{ex.emoji} <code className="bg-blue-50 px-1 rounded">{ex.cmd}</code></p>
                      <p className="mt-0.5 text-[10px] text-gray-500">{ex.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
