import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Target, TrendingUp, DollarSign, Megaphone, Package,
  Edit2, Check, X, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle, Clock, Compass, Sparkles,
  Save, Users, MapPin, Lightbulb,
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

// ── Tipos para Estratégia ──────────────────────────────────────────────────
interface EstrategiaRow {
  id: string;
  visao_5anos: string;
  visao_2anos: string;
  visao_1ano: string;
  visao_6meses: string;
  num_funcionarios: number | null;
  segmentos_atuacao: string;
  regioes_atuacao: string;
  desafios_atuais: string;
  diferenciais: string;
}

// ── Componente da aba Direcionamento Estratégico ───────────────────────────
function DirecaoEstrategicaTab({ isAdmin }: { isAdmin: boolean }) {
  const [estrategia, setEstrategia] = useState<EstrategiaRow | null>(null);
  const [form, setForm] = useState({
    visao_5anos: "", visao_2anos: "", visao_1ano: "", visao_6meses: "",
    num_funcionarios: "", segmentos_atuacao: "", regioes_atuacao: "",
    desafios_atuais: "", diferenciais: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [plano, setPlano] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const planoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("estrategia_empresa").select("*").order("atualizado_em", { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) {
          setEstrategia(data as EstrategiaRow);
          setForm({
            visao_5anos: data.visao_5anos ?? "",
            visao_2anos: data.visao_2anos ?? "",
            visao_1ano: data.visao_1ano ?? "",
            visao_6meses: data.visao_6meses ?? "",
            num_funcionarios: data.num_funcionarios != null ? String(data.num_funcionarios) : "",
            segmentos_atuacao: data.segmentos_atuacao ?? "",
            regioes_atuacao: data.regioes_atuacao ?? "",
            desafios_atuais: data.desafios_atuais ?? "",
            diferenciais: data.diferenciais ?? "",
          });
        }
      });
  }, []);

  async function salvar() {
    setSalvando(true);
    const payload = {
      visao_5anos: form.visao_5anos,
      visao_2anos: form.visao_2anos,
      visao_1ano: form.visao_1ano,
      visao_6meses: form.visao_6meses,
      num_funcionarios: form.num_funcionarios ? Number(form.num_funcionarios) : null,
      segmentos_atuacao: form.segmentos_atuacao,
      regioes_atuacao: form.regioes_atuacao,
      desafios_atuais: form.desafios_atuais,
      diferenciais: form.diferenciais,
      atualizado_em: new Date().toISOString(),
    };
    if (estrategia?.id) {
      await supabase.from("estrategia_empresa").update(payload).eq("id", estrategia.id);
    } else {
      const { data } = await supabase.from("estrategia_empresa").insert(payload).select().single();
      if (data) setEstrategia(data as EstrategiaRow);
    }
    setSalvando(false);
    setSalvouOk(true);
    setTimeout(() => setSalvouOk(false), 3000);
  }

  async function gerarPlano() {
    setGerando(true);
    setErro("");
    setPlano("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/clevel-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Erro ao gerar plano");
      setPlano(json.plano);
      setTimeout(() => planoRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setGerando(false);
    }
  }

  // Renderiza markdown simples (negrito, títulos, listas)
  function renderMarkdown(text: string) {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let key = 0;
    for (const line of lines) {
      if (line.startsWith("## ")) {
        elements.push(<h2 key={key++} className="mt-6 mb-2 text-base font-bold text-gray-800 border-b border-gray-200 pb-1">{line.slice(3)}</h2>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={key++} className="mt-4 mb-1 text-sm font-bold text-gray-700">{line.slice(4)}</h3>);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <li key={key++} className="ml-4 text-sm text-gray-700 list-disc">
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={key++} className="ml-4 text-sm text-gray-700 list-decimal">
            {line.replace(/^\d+\.\s/, "").replace(/\*\*(.*?)\*\*/g, "$1")}
          </li>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key++} className="h-2" />);
      } else {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        elements.push(
          <p key={key++} className="text-sm text-gray-700 leading-relaxed">
            {parts.map((p, i) => p.startsWith("**") ? <strong key={i}>{p.slice(2,-2)}</strong> : p)}
          </p>
        );
      }
    }
    return elements;
  }

  const campoBase = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-[#1a6b2f] focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/20 resize-none disabled:bg-gray-50 disabled:text-gray-500";

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="h-6 w-6 text-blue-300" />
          <h2 className="text-base font-bold">Direcionamento Estratégico</h2>
        </div>
        <p className="text-sm text-slate-300">
          Defina a visão da empresa por horizonte de tempo. A IA C-Level lerá esses objetivos junto com os dados reais da empresa e gerará um plano estratégico estruturado.
        </p>
      </div>

      {/* Formulário de visão */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Visão por Horizonte</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 5 anos */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              🏔️ Visão 5 Anos
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={form.visao_5anos}
              onChange={e => setForm(f => ({ ...f, visao_5anos: e.target.value }))}
              placeholder="Onde queremos estar daqui 5 anos? Qual legado queremos construir?"
              className={campoBase}
            />
          </div>
          {/* 2 anos */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              🎯 Visão 2 Anos
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={form.visao_2anos}
              onChange={e => setForm(f => ({ ...f, visao_2anos: e.target.value }))}
              placeholder="Qual a posição de mercado desejada em 2 anos? Faturamento alvo?"
              className={campoBase}
            />
          </div>
          {/* 1 ano */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              📅 Foco 1 Ano
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={form.visao_1ano}
              onChange={e => setForm(f => ({ ...f, visao_1ano: e.target.value }))}
              placeholder="Qual é o principal objetivo deste ano? O que precisamos conquistar?"
              className={campoBase}
            />
          </div>
          {/* 6 meses */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              ⚡ Prioridades 6 Meses
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={form.visao_6meses}
              onChange={e => setForm(f => ({ ...f, visao_6meses: e.target.value }))}
              placeholder="Quais são as 3 prioridades mais urgentes dos próximos 6 meses?"
              className={campoBase}
            />
          </div>
        </div>
      </div>

      {/* Contexto da empresa */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Contexto da Empresa</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Users className="h-3.5 w-3.5" /> Nº Funcionários
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              value={form.num_funcionarios}
              onChange={e => setForm(f => ({ ...f, num_funcionarios: e.target.value }))}
              placeholder="ex: 12"
              className={cn(campoBase, "resize-none")}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <MapPin className="h-3.5 w-3.5" /> Regiões de Atuação
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.regioes_atuacao}
              onChange={e => setForm(f => ({ ...f, regioes_atuacao: e.target.value }))}
              placeholder="ex: RJ, SP"
              className={cn(campoBase, "resize-none")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Segmentos de Atuação
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.segmentos_atuacao}
              onChange={e => setForm(f => ({ ...f, segmentos_atuacao: e.target.value }))}
              placeholder="ex: instalação, manutenção, laudos"
              className={cn(campoBase, "resize-none")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-400" /> Desafios Atuais
            </label>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={form.desafios_atuais}
              onChange={e => setForm(f => ({ ...f, desafios_atuais: e.target.value }))}
              placeholder="Quais são os principais obstáculos que a empresa enfrenta hoje?"
              className={campoBase}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Lightbulb className="h-3.5 w-3.5 text-yellow-400" /> Diferenciais Competitivos
            </label>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={form.diferenciais}
              onChange={e => setForm(f => ({ ...f, diferenciais: e.target.value }))}
              placeholder="O que diferencia a Portibras da concorrência?"
              className={campoBase}
            />
          </div>
        </div>

        {/* Botão salvar */}
        {isAdmin && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl bg-[#1a6b2f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#155825] disabled:opacity-60 transition-colors"
            >
              <Save className="h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar Direcionamento"}
            </button>
            {salvouOk && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle className="h-4 w-4" /> Salvo com sucesso!
              </span>
            )}
          </div>
        )}
      </div>

      {/* Botão gerar plano C-Level */}
      <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center">
        <Sparkles className="h-8 w-8 text-blue-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-gray-800 mb-1">IA C-Level — Plano Estratégico</h3>
        <p className="text-xs text-gray-500 mb-4">
          A IA lê seus objetivos + dados reais da empresa e gera um plano com metas SMART, rotinas por área, prioridades dos próximos 90 dias e alertas.
        </p>
        <button
          onClick={gerarPlano}
          disabled={gerando}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          {gerando ? "Analisando dados e gerando plano..." : "🤖 Gerar Plano Estratégico C-Level"}
        </button>
        {gerando && (
          <p className="mt-2 text-xs text-blue-500 animate-pulse">Isso pode levar 20–30 segundos...</p>
        )}
        {erro && (
          <p className="mt-3 text-sm text-red-600 font-medium">❌ {erro}</p>
        )}
      </div>

      {/* Resultado do plano */}
      {plano && (
        <div ref={planoRef} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Plano Estratégico — IA C-Level</h3>
              <p className="text-xs text-gray-400">Gerado agora com base nos seus dados reais</p>
            </div>
          </div>
          <div className="prose-sm max-w-none">
            {renderMarkdown(plano)}
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

  const [abaAtiva, setAbaAtiva] = useState<"kpis" | "estrategia">("kpis");

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
            {/* Seletor de período — só na aba KPIs */}
            {abaAtiva === "kpis" && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="mt-3 flex gap-1">
          <button
            onClick={() => setAbaAtiva("kpis")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              abaAtiva === "kpis"
                ? "bg-[#1a6b2f] text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            )}
          >
            <Target className="h-4 w-4" />
            KPIs do Mês
          </button>
          <button
            onClick={() => setAbaAtiva("estrategia")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              abaAtiva === "estrategia"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            )}
          >
            <Compass className="h-4 w-4" />
            🎯 Direcionamento Estratégico
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Aba Estratégia */}
        {abaAtiva === "estrategia" && (
          <DirecaoEstrategicaTab isAdmin={isAdmin} />
        )}

        {/* Aba KPIs */}
        {abaAtiva === "kpis" && (<>
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
        </>)}
      </div>
    </div>
  );
}
