import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Calculator, ExternalLink, Search, ChevronDown, X,
  Building2, Clock, TrendingUp, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/orcamentos")({
  component: OrcamentosPage,
});

interface ItemOrcamento {
  suprimento_id: string;
  nome: string;
  unidade: string;
  custo_unitario: number;
  quantidade: number;
  descricao: string;
}

interface OrcamentoDB {
  id: string;
  lead_id: string;
  itens: ItemOrcamento[];
  custo_total: number;
  margem_pct: number;
  imposto_pct: number;
  preco_final: number;
  observacoes: string;
  criado_em: string;
}

interface Lead {
  id: string;
  nome: string;
  empresa: string;
  cnpj: string;
  etapa: string;
  telefone: string;
  email: string;
}

interface OrcamentoEnriquecido extends OrcamentoDB {
  lead?: Lead;
}

const STATUS_ETAPA: Record<string, { label: string; bg: string; cor: string }> = {
  prospecto:    { label: "Prospecto",   bg: "bg-gray-100",    cor: "text-gray-600" },
  em_contato:   { label: "Em Contato",  bg: "bg-blue-100",    cor: "text-blue-700" },
  proposta:     { label: "Proposta",    bg: "bg-purple-100",  cor: "text-purple-700" },
  negociacao:   { label: "Negociação",  bg: "bg-orange-100",  cor: "text-orange-700" },
  fechado:      { label: "Fechado ✓",   bg: "bg-green-100",   cor: "text-green-700" },
  perdido:      { label: "Perdido",     bg: "bg-red-100",     cor: "text-red-600" },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCNPJ(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// ─── Painel lateral de detalhes ────────────────────────────────────────────
function PainelOrcamento({ orc, onFechar }: { orc: OrcamentoEnriquecido; onFechar: () => void }) {
  const lead = orc.lead;
  const etapaCfg = lead ? (STATUS_ETAPA[lead.etapa] ?? STATUS_ETAPA.prospecto) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white border-l border-gray-200">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#1a6b2f]" />
          <span className="text-sm font-semibold text-gray-800">Orçamento</span>
        </div>
        <button onClick={onFechar} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Lead vinculado */}
        {lead && (
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Lead / Cliente</p>
            <p className="font-semibold text-gray-900">{lead.nome}</p>
            <p className="text-sm text-gray-500">{lead.empresa}</p>
            {lead.cnpj && <p className="text-xs font-mono text-gray-400 mt-0.5">{formatCNPJ(lead.cnpj)}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {etapaCfg && (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", etapaCfg.bg, etapaCfg.cor)}>
                  {etapaCfg.label}
                </span>
              )}
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`} className="text-xs text-[#1a6b2f] hover:underline">📞 {lead.telefone}</a>
              )}
            </div>
          </div>
        )}

        {/* Data */}
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Data de criação</p>
          <p className="text-sm text-gray-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {fmtData(orc.criado_em)}
          </p>
        </div>

        {/* Itens do orçamento */}
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Itens</p>
          {orc.itens && orc.itens.length > 0 ? (
            <div className="space-y-2">
              {orc.itens.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.nome}</p>
                    {item.descricao && <p className="text-[10px] text-gray-500">{item.descricao}</p>}
                    <p className="text-[10px] text-gray-400">{item.quantidade} × {item.unidade}</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                    {fmt(item.quantidade * item.custo_unitario)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Nenhum item registrado</p>
          )}
        </div>

        {/* Totais */}
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Composição do valor</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Custo total</span><span>{fmt(orc.custo_total)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Margem ({orc.margem_pct}%)</span>
              <span>+{fmt(orc.custo_total * (orc.margem_pct / 100))}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Impostos ({orc.imposto_pct}%)</span>
              <span>+{fmt(orc.custo_total * (orc.imposto_pct / 100))}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>Preço final</span>
              <span className="text-[#1a6b2f]">{fmt(orc.preco_final)}</span>
            </div>
          </div>
        </div>

        {/* Observações */}
        {orc.observacoes && (
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Observações</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{orc.observacoes}</p>
          </div>
        )}
      </div>

      {/* Rodapé — link para o CRM */}
      {lead && (
        <div className="border-t border-gray-100 px-5 py-4">
          <a href={`/painel/crm`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824] transition-colors">
            <ExternalLink className="h-4 w-4" />
            Abrir no CRM
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────
function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoEnriquecido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<OrcamentoEnriquecido | null>(null);
  const [gavetaEtapa, setGavetaEtapa] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    const { data: orcs } = await supabase
      .from("crm_orcamentos")
      .select("*")
      .order("criado_em", { ascending: false });

    if (!orcs || orcs.length === 0) { setCarregando(false); return; }

    // Busca os leads correspondentes
    const leadIds = [...new Set(orcs.map((o: OrcamentoDB) => o.lead_id))];
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, nome, empresa, cnpj, etapa, telefone, email")
      .in("id", leadIds);

    const mapaLeads: Record<string, Lead> = {};
    if (leads) for (const l of leads as Lead[]) mapaLeads[l.id] = l;

    setOrcamentos((orcs as OrcamentoDB[]).map(o => ({ ...o, lead: mapaLeads[o.lead_id] })));
    setCarregando(false);
  }

  const hoje = new Date().toISOString().split("T")[0];

  const filtrados = orcamentos.filter(o => {
    if (filtroEtapa !== "todas" && o.lead?.etapa !== filtroEtapa) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      o.lead?.nome?.toLowerCase().includes(q) ||
      o.lead?.empresa?.toLowerCase().includes(q) ||
      o.lead?.cnpj?.includes(q)
    );
  });

  // Totalizadores
  const totalGeral = filtrados.reduce((acc, o) => acc + o.preco_final, 0);
  const totalFechados = filtrados.filter(o => o.lead?.etapa === "fechado").reduce((acc, o) => acc + o.preco_final, 0);

  return (
    <div className="flex h-full">
      {/* Lista principal */}
      <div className={cn("flex flex-col flex-1 min-w-0 overflow-auto p-4 md:p-6 transition-all", selecionado ? "hidden md:flex" : "flex")}>
        {/* Cabeçalho */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
            <p className="mt-0.5 text-sm text-gray-500">{orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""} gerado{orcamentos.length !== 1 ? "s" : ""} pelo CRM</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Total em aberto</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalGeral)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{filtrados.length} orçamentos</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Fechados</p>
            <p className="text-lg font-bold text-[#1a6b2f]">{fmt(totalFechados)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{filtrados.filter(o => o.lead?.etapa === "fechado").length} orçamentos</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm col-span-2 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Ticket médio</p>
            <p className="text-lg font-bold text-gray-900">
              {filtrados.length > 0 ? fmt(totalGeral / filtrados.length) : "—"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Média dos filtrados</p>
          </div>
        </div>

        {/* Busca + filtro de etapa */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar por cliente ou empresa…" value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
          </div>
          <div className="relative">
            <button onClick={() => setGavetaEtapa(v => !v)}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                filtroEtapa !== "todas" ? "border-[#1a6b2f] bg-[#1a6b2f]/5 text-[#1a6b2f]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
              {filtroEtapa !== "todas" ? STATUS_ETAPA[filtroEtapa]?.label : "Etapa"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", gavetaEtapa && "rotate-180")} />
            </button>
            {gavetaEtapa && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setGavetaEtapa(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                  <button onClick={() => { setFiltroEtapa("todas"); setGavetaEtapa(false); }}
                    className={cn("flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50",
                      filtroEtapa === "todas" ? "font-semibold text-[#1a6b2f]" : "text-gray-700")}>
                    Todas as etapas
                  </button>
                  <div className="border-t border-gray-100" />
                  {Object.entries(STATUS_ETAPA).map(([key, cfg]) => (
                    <button key={key} onClick={() => { setFiltroEtapa(key); setGavetaEtapa(false); }}
                      className={cn("flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50",
                        filtroEtapa === key ? "font-semibold text-[#1a6b2f]" : "text-gray-700")}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", cfg.bg)} />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {orcamentos.filter(o => o.lead?.etapa === key).length}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lista de orçamentos */}
        {carregando ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Calculator className="mb-3 h-10 w-10 opacity-25" />
              <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
              <p className="mt-1 text-xs text-gray-300">Os orçamentos gerados no CRM aparecem aqui automaticamente</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Cabeçalho da tabela — desktop */}
            <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px_40px] border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 gap-4">
              <span>Lead / Empresa</span>
              <span>Etapa no CRM</span>
              <span>Data</span>
              <span className="text-right">Valor</span>
              <span />
            </div>

            <div className="divide-y divide-gray-50">
              {filtrados.map(orc => {
                const lead = orc.lead;
                const etapaCfg = lead ? (STATUS_ETAPA[lead.etapa] ?? STATUS_ETAPA.prospecto) : null;
                const ativo = selecionado?.id === orc.id;

                return (
                  <button key={orc.id} onClick={() => setSelecionado(ativo ? null : orc)}
                    className={cn("w-full text-left transition-colors hover:bg-gray-50/60 px-5 py-4",
                      ativo && "bg-[#1a6b2f]/5 border-l-2 border-[#1a6b2f]")}>

                    {/* Mobile: card compacto */}
                    <div className="md:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                          <p className="text-xs text-gray-500 truncate">{lead?.empresa}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-[#1a6b2f]">{fmt(orc.preco_final)}</p>
                          <p className="text-[10px] text-gray-400">{fmtData(orc.criado_em)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {etapaCfg && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", etapaCfg.bg, etapaCfg.cor)}>
                            {etapaCfg.label}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {orc.itens?.length ?? 0} {orc.itens?.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                    </div>

                    {/* Desktop: linha de tabela */}
                    <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px_40px] items-center gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <Building2 className="h-3 w-3 flex-shrink-0" />{lead?.empresa ?? "Lead não encontrado"}
                        </p>
                      </div>
                      <div>
                        {etapaCfg ? (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", etapaCfg.bg, etapaCfg.cor)}>
                            {etapaCfg.label}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-300" />
                        {fmtData(orc.criado_em)}
                      </p>
                      <p className="text-sm font-bold text-[#1a6b2f] text-right">{fmt(orc.preco_final)}</p>
                      <TrendingUp className="h-4 w-4 text-gray-300 justify-self-center" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Painel lateral de detalhe */}
      {selecionado && (
        <div className={cn("flex-shrink-0 w-full md:w-96 h-full border-l border-gray-200")}>
          <PainelOrcamento orc={selecionado} onFechar={() => setSelecionado(null)} />
        </div>
      )}
    </div>
  );
}
