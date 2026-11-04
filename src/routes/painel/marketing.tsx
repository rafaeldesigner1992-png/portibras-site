import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp, Target, MousePointerClick, DollarSign, Zap,
  AlertTriangle, CheckCircle, ChevronRight, Plus, Pause, Play,
  Search, Ban, Settings, RefreshCw, Loader2, Info, ArrowUp,
  ArrowDown, Minus, Eye, BarChart3, Bot, Flag, Lightbulb,
  Check, X, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/marketing")({
  component: MarketingPage,
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Aba = "visao-geral" | "campanhas" | "keywords" | "metas" | "agente";

interface Campanha {
  id: string;
  nome: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  tipo: string;
  orcamento_diario: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc_medio: number;
  custo_total: number;
  conversoes: number;
  valor_conversao: number;
}

interface Keyword {
  id: string;
  campaign_id: string;
  campaign_nome: string;
  keyword: string;
  tipo: "positiva" | "negativa";
  match_type: string;
  status: string;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc_medio: number;
  custo_total: number;
  conversoes: number;
  quality_score: number | null;
}

interface Meta {
  id?: string;
  periodo: string;
  tipo_periodo: string;
  meta_impressoes: number | null;
  meta_cliques: number | null;
  meta_ctr: number | null;
  meta_cpc: number | null;
  meta_conversoes: number | null;
  meta_custo: number | null;
  meta_roas: number | null;
  meta_leads: number | null;
  observacoes: string;
}

interface AdsConfig {
  customer_id: string;
  client_id: string;
  client_secret: string;
  developer_token: string;
  login_customer_id: string;
  refresh_token: string;
  conectado: boolean;
  ultimo_sync: string | null;
}

interface AiAnalysis {
  resumo: string;
  score_geral: number;
  insights: Array<{
    tipo: string;
    prioridade: "alta" | "media" | "baixa";
    titulo: string;
    descricao: string;
    recomendacao: string;
    impacto_estimado: string;
  }>;
  alertas: string[];
  proximos_passos: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

function statusColor(s: string) {
  if (s === "ENABLED") return "bg-green-100 text-green-800";
  if (s === "PAUSED") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function statusLabel(s: string) {
  if (s === "ENABLED") return "Ativa";
  if (s === "PAUSED") return "Pausada";
  return "Removida";
}

async function callProxy(action: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(
    "https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/google-ads-proxy",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action, ...extra }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || "Erro na requisição");
  return data;
}

// ─── Componente principal ─────────────────────────────────────────────────────

function MarketingPage() {
  const [aba, setAba] = useState<Aba>("visao-geral");
  const [config, setConfig] = useState<AdsConfig | null>(null);
  const [configCarregada, setConfigCarregada] = useState(false);

  useEffect(() => {
    supabase
      .from("google_ads_config")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()
      .then(({ data }) => {
        setConfig(data || null);
        setConfigCarregada(true);
      });
  }, []);

  if (!configCarregada) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Se não tem config ou não está conectado, mostra setup
  if (!config?.conectado) {
    return <SetupGoogle config={config} onConectado={(c) => setConfig(c)} />;
  }

  const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
    { id: "visao-geral", label: "Visão Geral", icon: BarChart3 },
    { id: "campanhas",   label: "Campanhas",   icon: TrendingUp },
    { id: "keywords",    label: "Palavras-chave", icon: Search },
    { id: "metas",       label: "Metas",       icon: Flag },
    { id: "agente",      label: "Agente IA",   icon: Bot },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Marketing Digital</h1>
          <p className="text-sm text-gray-500">
            Google Ads · Conta {config.customer_id}
            {config.ultimo_sync && (
              <span className="ml-2 text-xs text-gray-400">
                Sync: {new Date(config.ultimo_sync).toLocaleString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfig(null)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          <Settings className="h-3.5 w-3.5" /> Configurar
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
        {abas.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                aba === a.id
                  ? "bg-white text-[#1a6b2f] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {aba === "visao-geral" && <AbaVisaoGeral />}
      {aba === "campanhas"   && <AbaCampanhas />}
      {aba === "keywords"    && <AbaKeywords />}
      {aba === "metas"       && <AbaMetas />}
      {aba === "agente"      && <AbaAgente />}
    </div>
  );
}

// ─── Setup / Configuração OAuth ───────────────────────────────────────────────

function SetupGoogle({ config, onConectado }: { config: AdsConfig | null; onConectado: (c: AdsConfig) => void }) {
  const [passo, setPasso] = useState<"credenciais" | "oauth" | "sucesso">(
    config?.client_id ? "oauth" : "credenciais"
  );
  const [form, setForm] = useState({
    customer_id: config?.customer_id || "",
    client_id: config?.client_id || "",
    client_secret: config?.client_secret || "",
    developer_token: config?.developer_token || "",
    login_customer_id: config?.login_customer_id || "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const REDIRECT_URI = window.location.origin + "/painel/marketing";

  const salvarCredenciais = async () => {
    setLoading(true);
    setErro("");
    try {
      await callProxy("save_config", form);
      setPasso("oauth");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirOAuth = () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", form.client_id);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    window.open(url.toString(), "_blank", "width=600,height=700");
  };

  // Pega o `code` da URL após o redirect do Google
  const [codeInput, setCodeInput] = useState("");

  const trocarCodigo = async () => {
    setLoading(true);
    setErro("");
    try {
      await callProxy("oauth_exchange", { code: codeInput, redirect_uri: REDIRECT_URI });
      setPasso("sucesso");
      setTimeout(() => {
        supabase.from("google_ads_config").select("*").eq("id", "00000000-0000-0000-0000-000000000001").single()
          .then(({ data }) => { if (data) onConectado(data); });
      }, 1500);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Progresso */}
      <div className="mb-8 flex items-center gap-2">
        {["credenciais", "oauth", "sucesso"].map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
              passo === p ? "bg-[#1a6b2f] text-white" :
              ["credenciais","oauth","sucesso"].indexOf(passo) > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            )}>
              {["credenciais","oauth","sucesso"].indexOf(passo) > i ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < 2 && <div className={cn("h-0.5 w-16", ["credenciais","oauth","sucesso"].indexOf(passo) > i ? "bg-green-500" : "bg-gray-200")} />}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium text-gray-700">
          {passo === "credenciais" ? "Credenciais" : passo === "oauth" ? "Autorização" : "Concluído!"}
        </span>
      </div>

      {passo === "credenciais" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Configurar Google Ads API</h2>
          <p className="mb-6 text-sm text-gray-500">
            Você precisa de um projeto no Google Cloud com a API do Google Ads habilitada.
          </p>

          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">📋 Passo a passo:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Acesse <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="underline">console.cloud.google.com</a></li>
              <li>Crie um projeto → APIs → Ative "Google Ads API"</li>
              <li>Vá em "Credenciais" → Criar ID do cliente OAuth 2.0 (Tipo: Web)</li>
              <li>Adicione como URI autorizado: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/painel/marketing</code></li>
              <li>O Developer Token está em <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener" className="underline">ads.google.com → Central de APIs</a></li>
            </ol>
          </div>

          <div className="space-y-3">
            {[
              { key: "customer_id", label: "Customer ID (ex: 123-456-7890)", placeholder: "000-000-0000" },
              { key: "client_id", label: "Client ID (OAuth)", placeholder: "xxxxx.apps.googleusercontent.com" },
              { key: "client_secret", label: "Client Secret (OAuth)", placeholder: "GOCSPX-..." },
              { key: "developer_token", label: "Developer Token", placeholder: "xxxxxxxxxxxxxxxxxxxx" },
              { key: "login_customer_id", label: "Login Customer ID (MCC, opcional)", placeholder: "000-000-0000" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
                <input
                  type={key.includes("secret") || key === "developer_token" ? "password" : "text"}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1a6b2f] focus:outline-none"
                />
              </div>
            ))}
          </div>

          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

          <button
            onClick={salvarCredenciais}
            disabled={loading || !form.client_id || !form.client_secret}
            className="mt-4 w-full rounded-lg bg-[#1a6b2f] py-2.5 text-sm font-medium text-white hover:bg-[#155a26] disabled:opacity-50"
          >
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Salvar e continuar →"}
          </button>
        </div>
      )}

      {passo === "oauth" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Autorizar acesso ao Google Ads</h2>
          <p className="mb-6 text-sm text-gray-500">
            Clique para abrir a janela do Google e autorizar o acesso à sua conta de anúncios.
          </p>

          <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Importante:</p>
            <p>Após autorizar, o Google redirecionará para uma página com um <strong>código na URL</strong> (parâmetro <code>?code=...</code>). Copie esse código e cole abaixo.</p>
          </div>

          <button
            onClick={abrirOAuth}
            className="w-full rounded-lg border-2 border-[#1a6b2f] py-3 text-sm font-medium text-[#1a6b2f] hover:bg-[#1a6b2f]/5 mb-4"
          >
            🔗 Abrir autorização Google
          </button>

          <label className="mb-1 block text-xs font-medium text-gray-700">
            Cole o código de autorização aqui:
          </label>
          <input
            type="text"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder="4/0AX4XfW..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-[#1a6b2f] focus:outline-none mb-3"
          />

          {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

          <button
            onClick={trocarCodigo}
            disabled={loading || !codeInput}
            className="w-full rounded-lg bg-[#1a6b2f] py-2.5 text-sm font-medium text-white hover:bg-[#155a26] disabled:opacity-50"
          >
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Conectar conta →"}
          </button>
        </div>
      )}

      {passo === "sucesso" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h2 className="text-lg font-bold text-green-900">Google Ads conectado!</h2>
          <p className="mt-1 text-sm text-green-700">Carregando suas campanhas...</p>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-green-500" />
        </div>
      )}
    </div>
  );
}

// ─── Aba: Visão Geral ─────────────────────────────────────────────────────────

function AbaVisaoGeral() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [metas, setMetas] = useState<Meta | null>(null);

  const periodo = new Date().toISOString().slice(0, 7); // "2024-11"

  useEffect(() => {
    setLoading(true);
    Promise.all([
      callProxy("campaigns"),
      supabase.from("marketing_metas").select("*").eq("periodo", periodo).single(),
    ])
      .then(([campsData, { data: metaData }]) => {
        setCampanhas(campsData.campaigns || []);
        setMetas(metaData || null);
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingCard />;
  if (erro) return <ErroCard msg={erro} />;

  const totais = campanhas.reduce((acc, c) => ({
    impressoes: acc.impressoes + c.impressoes,
    cliques: acc.cliques + c.cliques,
    custo: acc.custo + c.custo_total,
    conversoes: acc.conversoes + c.conversoes,
  }), { impressoes: 0, cliques: 0, custo: 0, conversoes: 0 });

  const ctrMedio = totais.impressoes > 0 ? totais.cliques / totais.impressoes : 0;
  const cpcMedio = totais.cliques > 0 ? totais.custo / totais.cliques : 0;

  const metricCards = [
    {
      label: "Impressões",
      valor: fmtNum(totais.impressoes),
      meta: metas?.meta_impressoes ? fmtNum(metas.meta_impressoes) : null,
      pct: metas?.meta_impressoes ? Math.round((totais.impressoes / metas.meta_impressoes) * 100) : null,
      icon: Eye,
      cor: "text-blue-600 bg-blue-50",
    },
    {
      label: "Cliques",
      valor: fmtNum(totais.cliques),
      meta: metas?.meta_cliques ? fmtNum(metas.meta_cliques) : null,
      pct: metas?.meta_cliques ? Math.round((totais.cliques / metas.meta_cliques) * 100) : null,
      icon: MousePointerClick,
      cor: "text-purple-600 bg-purple-50",
    },
    {
      label: "CTR Médio",
      valor: fmtPct(ctrMedio),
      meta: metas?.meta_ctr ? `${metas.meta_ctr}%` : null,
      pct: metas?.meta_ctr ? Math.round((ctrMedio * 100 / metas.meta_ctr) * 100) : null,
      icon: TrendingUp,
      cor: "text-green-600 bg-green-50",
    },
    {
      label: "CPC Médio",
      valor: fmtMoeda(cpcMedio),
      meta: metas?.meta_cpc ? fmtMoeda(metas.meta_cpc) : null,
      pct: null,
      icon: DollarSign,
      cor: "text-orange-600 bg-orange-50",
    },
    {
      label: "Gasto Total",
      valor: fmtMoeda(totais.custo),
      meta: metas?.meta_custo ? fmtMoeda(metas.meta_custo) : null,
      pct: metas?.meta_custo ? Math.round((totais.custo / metas.meta_custo) * 100) : null,
      icon: DollarSign,
      cor: "text-red-600 bg-red-50",
    },
    {
      label: "Conversões",
      valor: fmtNum(totais.conversoes),
      meta: metas?.meta_conversoes ? fmtNum(metas.meta_conversoes) : null,
      pct: metas?.meta_conversoes ? Math.round((totais.conversoes / metas.meta_conversoes) * 100) : null,
      icon: Zap,
      cor: "text-yellow-600 bg-yellow-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{m.label}</span>
                <div className={cn("rounded-lg p-1.5", m.cor)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{m.valor}</p>
              {m.meta && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Meta: {m.meta}</span>
                    <span className={cn("font-medium", (m.pct || 0) >= 100 ? "text-green-600" : "text-gray-600")}>
                      {m.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={cn("h-1.5 rounded-full transition-all", (m.pct || 0) >= 100 ? "bg-green-500" : "bg-[#1a6b2f]")}
                      style={{ width: `${Math.min(m.pct || 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Top campanhas */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Top Campanhas</h3>
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Campanha</th>
                <th className="px-4 py-3 text-right">Cliques</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">Custo</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campanhas.slice(0, 5).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.nome}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtNum(c.cliques)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtPct(c.ctr)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoeda(c.custo_total)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor(c.status))}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {campanhas.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">Nenhuma campanha encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Aba: Campanhas ───────────────────────────────────────────────────────────

function AbaCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState<string>("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    setLoading(true);
    setErro("");
    callProxy("campaigns")
      .then(d => setCampanhas(d.campaigns || []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleStatus = async (c: Campanha) => {
    setAcao(c.id);
    try {
      const action = c.status === "ENABLED" ? "pause_campaign" : "enable_campaign";
      await callProxy(action, { campaign_id: c.id });
      carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAcao("");
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{campanhas.length} campanhas encontradas</p>
        <button onClick={carregar} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {erro && <ErroCard msg={erro} />}

      <div className="space-y-3">
        {campanhas.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-gray-900">{c.nome}</p>
                <p className="text-xs text-gray-500">{c.tipo} · Orçamento: {fmtMoeda(c.orcamento_diario)}/dia</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor(c.status))}>
                  {statusLabel(c.status)}
                </span>
                <button
                  onClick={() => toggleStatus(c)}
                  disabled={acao === c.id || c.status === "REMOVED"}
                  title={c.status === "ENABLED" ? "Pausar" : "Ativar"}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  {acao === c.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : c.status === "ENABLED"
                      ? <Pause className="h-3.5 w-3.5" />
                      : <Play className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 text-center">
              {[
                { label: "Impressões", val: fmtNum(c.impressoes) },
                { label: "Cliques", val: fmtNum(c.cliques) },
                { label: "CTR", val: fmtPct(c.ctr) },
                { label: "CPC Médio", val: fmtMoeda(c.cpc_medio) },
                { label: "Custo", val: fmtMoeda(c.custo_total) },
                { label: "Conv.", val: fmtNum(c.conversoes) },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-gray-50 px-2 py-2">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{m.val}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {campanhas.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          Nenhuma campanha encontrada na conta.
        </div>
      )}
    </div>
  );
}

// ─── Aba: Keywords ────────────────────────────────────────────────────────────

function AbaKeywords() {
  const [positivas, setPositivas] = useState<Keyword[]>([]);
  const [negativas, setNegativas] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [subAba, setSubAba] = useState<"positiva" | "negativa">("positiva");
  const [novaKeyword, setNovaKeyword] = useState("");
  const [novaCampanhaId, setNovaCampanhaId] = useState("");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      callProxy("keywords"),
      callProxy("campaigns"),
    ])
      .then(([kwData, campData]) => {
        setPositivas(kwData.positivas || []);
        setNegativas(kwData.negativas || []);
        setCampanhas(campData.campaigns || []);
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const adicionarNegativa = async () => {
    if (!novaKeyword.trim() || !novaCampanhaId) return;
    setAddLoading(true);
    setErro("");
    try {
      await callProxy("add_negative_keyword", {
        campaign_id: novaCampanhaId,
        keyword: novaKeyword.trim(),
        match_type: "BROAD",
      });
      setNovaKeyword("");
      // Recarrega
      const kwData = await callProxy("keywords");
      setNegativas(kwData.negativas || []);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) return <LoadingCard />;

  const listaAtual = (subAba === "positiva" ? positivas : negativas)
    .filter(k => !busca || k.keyword.toLowerCase().includes(busca.toLowerCase()));

  const matchLabel = (m: string) => {
    if (m === "EXACT") return "Exata";
    if (m === "PHRASE") return "Frase";
    return "Ampla";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSubAba("positiva")}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", subAba === "positiva" ? "bg-[#1a6b2f] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50")}
        >
          Positivas ({positivas.length})
        </button>
        <button
          onClick={() => setSubAba("negativa")}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5", subAba === "negativa" ? "bg-red-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50")}
        >
          <Ban className="h-3.5 w-3.5" /> Negativas ({negativas.length})
        </button>
      </div>

      {/* Adicionar negativa */}
      {subAba === "negativa" && (
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p className="mb-3 text-sm font-medium text-red-900">Adicionar palavra-chave negativa</p>
          <div className="flex gap-2">
            <select
              value={novaCampanhaId}
              onChange={e => setNovaCampanhaId(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-red-400 focus:outline-none"
            >
              <option value="">Selecionar campanha…</option>
              {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input
              type="text"
              value={novaKeyword}
              onChange={e => setNovaKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && adicionarNegativa()}
              placeholder="Palavra-chave a bloquear…"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <button
              onClick={adicionarNegativa}
              disabled={addLoading || !novaKeyword || !novaCampanhaId}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar palavras-chave…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#1a6b2f] focus:outline-none"
        />
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Keyword</th>
              <th className="px-4 py-3 text-left">Campanha</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              {subAba === "positiva" && <>
                <th className="px-4 py-3 text-right">Cliques</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">QS</th>
              </>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {listaAtual.slice(0, 50).map((k) => (
              <tr key={k.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={cn("font-medium", k.tipo === "negativa" ? "text-red-700 line-through decoration-red-300" : "text-gray-900")}>
                    {k.keyword}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{k.campaign_nome}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {matchLabel(k.match_type)}
                  </span>
                </td>
                {subAba === "positiva" && <>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtNum(k.cliques)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtPct(k.ctr)}</td>
                  <td className="px-4 py-3 text-right">
                    {k.quality_score
                      ? <span className={cn("font-semibold", k.quality_score >= 7 ? "text-green-600" : k.quality_score >= 4 ? "text-yellow-600" : "text-red-600")}>{k.quality_score}/10</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
        {listaAtual.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Nenhuma keyword encontrada.</p>
        )}
      </div>
    </div>
  );
}

// ─── Aba: Metas ───────────────────────────────────────────────────────────────

function AbaMetas() {
  const periodo = new Date().toISOString().slice(0, 7);
  const [meta, setMeta] = useState<Meta>({
    periodo,
    tipo_periodo: "mensal",
    meta_impressoes: null,
    meta_cliques: null,
    meta_ctr: null,
    meta_cpc: null,
    meta_conversoes: null,
    meta_custo: null,
    meta_roas: null,
    meta_leads: null,
    observacoes: "",
  });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    supabase
      .from("marketing_metas")
      .select("*")
      .eq("periodo", periodo)
      .single()
      .then(({ data }) => {
        if (data) setMeta(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const salvar = async () => {
    setSalvando(true);
    const { id, ...sem_id } = meta;
    const { error } = meta.id
      ? await supabase.from("marketing_metas").update(sem_id).eq("id", meta.id)
      : await supabase.from("marketing_metas").insert(meta).select().single();
    setSalvando(false);
    if (!error) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  };

  if (loading) return <LoadingCard />;

  const campos = [
    { key: "meta_impressoes", label: "Impressões", prefixo: "", tipo: "number" },
    { key: "meta_cliques", label: "Cliques", prefixo: "", tipo: "number" },
    { key: "meta_ctr", label: "CTR médio (%)", prefixo: "", tipo: "number" },
    { key: "meta_cpc", label: "CPC máximo (R$)", prefixo: "R$", tipo: "number" },
    { key: "meta_conversoes", label: "Conversões", prefixo: "", tipo: "number" },
    { key: "meta_custo", label: "Orçamento total (R$)", prefixo: "R$", tipo: "number" },
    { key: "meta_roas", label: "ROAS (retorno sobre gasto)", prefixo: "", tipo: "number" },
    { key: "meta_leads", label: "Leads gerados", prefixo: "", tipo: "number" },
  ];

  const mesLabel = new Date(periodo + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Metas — {mesLabel}</h3>
          <p className="text-sm text-gray-500">Defina os objetivos para o período atual</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campos.map(({ key, label, prefixo }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
              <div className="relative">
                {prefixo && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefixo}</span>
                )}
                <input
                  type="number"
                  value={(meta as any)[key] ?? ""}
                  onChange={e => setMeta(m => ({ ...m, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  className={cn(
                    "w-full rounded-lg border border-gray-200 py-2 text-sm focus:border-[#1a6b2f] focus:outline-none",
                    prefixo ? "pl-8 pr-3" : "px-3"
                  )}
                  placeholder="Não definido"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-700">Observações / Estratégia</label>
          <textarea
            value={meta.observacoes}
            onChange={e => setMeta(m => ({ ...m, observacoes: e.target.value }))}
            rows={3}
            placeholder="Ex: Foco em campanhas de pesquisa para sprinklers em São Paulo…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1a6b2f] focus:outline-none"
          />
        </div>

        <button
          onClick={salvar}
          disabled={salvando}
          className={cn(
            "mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors",
            salvo ? "bg-green-600" : "bg-[#1a6b2f] hover:bg-[#155a26]"
          )}
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <Check className="h-4 w-4" /> : null}
          {salvo ? "Salvo!" : "Salvar metas"}
        </button>
      </div>
    </div>
  );
}

// ─── Aba: Agente IA ───────────────────────────────────────────────────────────

function AbaAgente() {
  const [analise, setAnalise] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    // Carrega insights já salvos
    supabase
      .from("marketing_insights_ia")
      .select("*")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
      .limit(20)
      .then(({ data }) => setInsights(data || []));
  }, []);

  const analisar = async () => {
    setLoading(true);
    setErro("");
    try {
      const [campsData, { data: metaData }] = await Promise.all([
        callProxy("campaigns"),
        supabase.from("marketing_metas").select("*").eq("periodo", new Date().toISOString().slice(0, 7)).single(),
      ]);
      const result = await callProxy("ai_insights", {
        campanhas: campsData.campaigns,
        metas: metaData,
      });
      setAnalise(result.analysis);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const aplicarInsight = async (id: string) => {
    await supabase.from("marketing_insights_ia").update({ status: "aplicado", aplicado_em: new Date().toISOString() }).eq("id", id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const ignorarInsight = async (id: string) => {
    await supabase.from("marketing_insights_ia").update({ status: "ignorado" }).eq("id", id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const prioridadeCor: Record<string, string> = {
    alta: "border-l-red-500 bg-red-50",
    media: "border-l-yellow-500 bg-yellow-50",
    baixa: "border-l-blue-500 bg-blue-50",
  };

  return (
    <div className="space-y-6">
      {/* Header do Agente */}
      <div className="rounded-xl border border-[#1a6b2f]/20 bg-gradient-to-r from-[#1a6b2f]/5 to-transparent p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#1a6b2f] p-2.5">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Agente de Marketing IA</h3>
            <p className="mt-1 text-sm text-gray-600">
              Analiso suas campanhas, comparo com suas metas e gero recomendações práticas para maximizar resultados.
            </p>
          </div>
          <button
            onClick={analisar}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-sm font-medium text-white hover:bg-[#155a26] disabled:opacity-50 flex-shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loading ? "Analisando…" : "Analisar agora"}
          </button>
        </div>
      </div>

      {erro && <ErroCard msg={erro} />}

      {/* Resultado da análise */}
      {analise && (
        <div className="space-y-4">
          {/* Score + Resumo */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-16 w-16">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-gray-100" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                    strokeDasharray={`${analise.score_geral * 0.942} 94.2`}
                    className={analise.score_geral >= 70 ? "stroke-green-500" : analise.score_geral >= 40 ? "stroke-yellow-500" : "stroke-red-500"}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">
                  {analise.score_geral}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Score das Campanhas</p>
                <p className="mt-1 text-sm text-gray-700">{analise.resumo}</p>
              </div>
            </div>

            {analise.alertas?.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="mb-1.5 text-xs font-semibold text-red-800">⚠️ Alertas</p>
                <ul className="space-y-1">
                  {analise.alertas.map((a, i) => (
                    <li key={i} className="text-sm text-red-700">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Insights */}
          {analise.insights?.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" /> Recomendações
              </h4>
              <div className="space-y-3">
                {analise.insights.map((ins, i) => (
                  <div key={i} className={cn("rounded-xl border-l-4 p-4", prioridadeCor[ins.prioridade] || "border-l-gray-300 bg-gray-50")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            ins.prioridade === "alta" ? "bg-red-100 text-red-700" :
                            ins.prioridade === "media" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {ins.prioridade === "alta" ? "Alta prioridade" : ins.prioridade === "media" ? "Média" : "Baixa"}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-gray-900">{ins.titulo}</p>
                        <p className="mt-1 text-sm text-gray-600">{ins.descricao}</p>
                        <p className="mt-2 text-sm font-medium text-[#1a6b2f]">→ {ins.recomendacao}</p>
                        {ins.impacto_estimado && (
                          <p className="mt-1 text-xs text-gray-500">Impacto: {ins.impacto_estimado}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos passos */}
          {analise.proximos_passos?.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">Próximos Passos</h4>
              <ol className="space-y-2">
                {analise.proximos_passos.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-xs font-bold text-[#1a6b2f]">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Insights pendentes do banco */}
      {!analise && insights.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Recomendações Anteriores</h4>
          <div className="space-y-3">
            {insights.map((ins) => (
              <div key={ins.id} className={cn("rounded-xl border-l-4 p-4", prioridadeCor[ins.prioridade] || "border-l-gray-300 bg-gray-50")}>
                <p className="text-sm text-gray-700">{ins.insight}</p>
                {ins.recomendacao && (
                  <p className="mt-1.5 text-sm font-medium text-[#1a6b2f]">→ {ins.recomendacao}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => aplicarInsight(ins.id)} className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200">
                    <Check className="h-3 w-3" /> Marcar como aplicado
                  </button>
                  <button onClick={() => ignorarInsight(ins.id)} className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">
                    <X className="h-3 w-3" /> Ignorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analise && insights.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Nenhuma análise ainda</p>
          <p className="mt-1 text-xs text-gray-400">Clique em "Analisar agora" para gerar insights das suas campanhas</p>
        </div>
      )}
    </div>
  );
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-[#1a6b2f]" />
        <p className="text-sm text-gray-500">Carregando dados do Google Ads…</p>
      </div>
    </div>
  );
}

function ErroCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
        <p className="text-sm text-red-700">{msg}</p>
      </div>
    </div>
  );
}
