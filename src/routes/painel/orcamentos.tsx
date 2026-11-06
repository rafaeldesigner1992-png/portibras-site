import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Calculator, ExternalLink, Search, ChevronDown, X,
  Building2, Clock, TrendingUp, Wrench, DoorOpen, BarChart3,
  Trash2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/orcamentos")({
  component: OrcamentosPage,
});

// ─── Tipos ─────────────────────────────────────────────────────────────────
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

interface ConteudoProposta {
  portas: number;
  parcela: number;
  custoCorretivo: number;
  frequencia: number;
}

interface PropostaSalva {
  id: string;
  lead_id: string;
  tipo: "orcamento" | "manutencao";
  nome_arquivo: string;
  storage_path: string;
  status: "criado" | "enviado" | "fechado" | "descontinuado";
  conteudo: ConteudoProposta | null;
  criado_em: string;
  atualizado_em: string | null;
  cliente_id: string | null;
  enviado_logistica: boolean;
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

interface PropostaEnriquecida extends PropostaSalva {
  lead?: Lead;
}

// ─── Constantes ────────────────────────────────────────────────────────────
const STATUS_ETAPA: Record<string, { label: string; bg: string; cor: string }> = {
  prospecto:    { label: "Prospecto",   bg: "bg-gray-100",    cor: "text-gray-600" },
  em_contato:   { label: "Em Contato",  bg: "bg-blue-100",    cor: "text-blue-700" },
  proposta:     { label: "Proposta",    bg: "bg-purple-100",  cor: "text-purple-700" },
  negociacao:   { label: "Negociação",  bg: "bg-orange-100",  cor: "text-orange-700" },
  fechado:      { label: "Fechado ✓",   bg: "bg-green-100",   cor: "text-green-700" },
  perdido:      { label: "Perdido",     bg: "bg-red-100",     cor: "text-red-600" },
};

const STATUS_PROPOSTA: Record<string, { label: string; bg: string; cor: string }> = {
  criado:        { label: "Criado",        bg: "bg-gray-100",   cor: "text-gray-600" },
  enviado:       { label: "Enviado",       bg: "bg-blue-100",   cor: "text-blue-700" },
  fechado:       { label: "Fechado ✓",     bg: "bg-green-100",  cor: "text-green-700" },
  descontinuado: { label: "Cancelado",     bg: "bg-red-100",    cor: "text-red-600" },
};

// ─── Utilitários ───────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCNPJ(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// ─── Painel lateral — Orçamento de peças ───────────────────────────────────
function PainelOrcamento({ orc, onFechar }: { orc: OrcamentoEnriquecido; onFechar: () => void }) {
  const lead = orc.lead;
  const etapaCfg = lead ? (STATUS_ETAPA[lead.etapa] ?? STATUS_ETAPA.prospecto) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white border-l border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#1a6b2f]" />
          <span className="text-sm font-semibold text-gray-800">Orçamento de Peças</span>
        </div>
        <button onClick={onFechar} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
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

        <div className="border-b border-gray-100 px-5 py-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Data de criação</p>
          <p className="text-sm text-gray-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {fmtData(orc.criado_em)}
          </p>
        </div>

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

        {orc.observacoes && (
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Observações</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{orc.observacoes}</p>
          </div>
        )}
      </div>

      {lead && (
        <div className="border-t border-gray-100 px-5 py-4">
          <a href="/painel/crm"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824] transition-colors">
            <ExternalLink className="h-4 w-4" />
            Abrir no CRM
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Painel lateral — Manutenção 12× ───────────────────────────────────────
function PainelManutencao({ prop, onFechar }: { prop: PropostaEnriquecida; onFechar: () => void }) {
  const lead = prop.lead;
  const etapaCfg = lead ? (STATUS_ETAPA[lead.etapa] ?? STATUS_ETAPA.prospecto) : null;
  const statusCfg = STATUS_PROPOSTA[prop.status] ?? STATUS_PROPOSTA.criado;
  const c = prop.conteudo;

  const valorAnual = c ? c.parcela * 12 : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white border-l border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-[#1a6b2f]" />
          <span className="text-sm font-semibold text-gray-800">Manutenção 12×</span>
        </div>
        <button onClick={onFechar} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
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
            </div>
          </div>
        )}

        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Status da proposta</p>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusCfg.bg, statusCfg.cor)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {fmtData(prop.criado_em)}
          </p>
          {prop.nome_arquivo && (
            <p className="text-xs text-gray-400 mt-1 truncate">📄 {prop.nome_arquivo}</p>
          )}
        </div>

        {c && (
          <>
            <div className="border-b border-gray-100 px-5 py-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Detalhes do contrato</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#1a6b2f]/5 p-3 text-center">
                  <DoorOpen className="h-4 w-4 mx-auto mb-1 text-[#1a6b2f]" />
                  <p className="text-xl font-bold text-[#1a6b2f]">{c.portas}</p>
                  <p className="text-[10px] text-gray-500">Portas</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-3 text-center">
                  <BarChart3 className="h-4 w-4 mx-auto mb-1 text-orange-600" />
                  <p className="text-xl font-bold text-orange-600">{c.frequencia}×/ano</p>
                  <p className="text-[10px] text-gray-500">Visitas/ano</p>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-100 px-5 py-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Composição financeira</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Parcela mensal (12×)</span>
                  <span className="font-semibold text-gray-800">{fmt(c.parcela)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Custo corretivo incluso</span>
                  <span>{fmt(c.custoCorretivo)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
                  <span>Valor anual do contrato</span>
                  <span className="text-[#1a6b2f]">{fmt(valorAnual)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {lead && (
        <div className="border-t border-gray-100 px-5 py-4">
          <a href="/painel/crm"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824] transition-colors">
            <ExternalLink className="h-4 w-4" />
            Abrir no CRM
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Modal de confirmação de exclusão ──────────────────────────────────────
function ModalConfirmarExclusao({
  nome,
  onConfirmar,
  onCancelar,
  excluindo,
}: {
  nome: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  excluindo: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">Excluir registro</p>
            <p className="mt-1 text-sm text-gray-500">
              Tem certeza que deseja excluir o registro de{" "}
              <span className="font-semibold text-gray-800">{nome}</span>?
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onCancelar}
            disabled={excluindo}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={excluindo}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluindo ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────
function OrcamentosPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";
  const [aba, setAba] = useState<"orcamentos" | "manutencao">("orcamentos");
  const [orcamentos, setOrcamentos] = useState<OrcamentoEnriquecido[]>([]);
  const [manutencoes, setManutencoes] = useState<PropostaEnriquecida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [gavetaEtapa, setGavetaEtapa] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");
  const [orcSelecionado, setOrcSelecionado] = useState<OrcamentoEnriquecido | null>(null);
  const [manSelecionada, setManSelecionada] = useState<PropostaEnriquecida | null>(null);

  // Exclusão
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [excluindoTipo, setExcluindoTipo] = useState<"orcamento" | "manutencao" | null>(null);
  const [excluindoNome, setExcluindoNome] = useState("");
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  function pedirExclusao(
    e: React.MouseEvent,
    id: string,
    tipo: "orcamento" | "manutencao",
    nome: string
  ) {
    e.stopPropagation(); // não abre o painel lateral
    setExcluindoId(id);
    setExcluindoTipo(tipo);
    setExcluindoNome(nome);
  }

  async function confirmarExclusao() {
    if (!excluindoId || !excluindoTipo) return;
    setProcessandoExclusao(true);
    const tabela = excluindoTipo === "orcamento" ? "crm_orcamentos" : "crm_propostas";
    await supabase.from(tabela).delete().eq("id", excluindoId);
    // Fecha painel se for o item aberto
    if (excluindoTipo === "orcamento" && orcSelecionado?.id === excluindoId) setOrcSelecionado(null);
    if (excluindoTipo === "manutencao" && manSelecionada?.id === excluindoId) setManSelecionada(null);
    setProcessandoExclusao(false);
    setExcluindoId(null);
    setExcluindoTipo(null);
    setExcluindoNome("");
    await carregar();
  }

  function cancelarExclusao() {
    setExcluindoId(null);
    setExcluindoTipo(null);
    setExcluindoNome("");
  }

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);

    // 1. Orçamentos de peças (crm_orcamentos)
    const { data: orcs } = await supabase
      .from("crm_orcamentos").select("*").order("criado_em", { ascending: false });

    // 2. Propostas de manutenção (crm_propostas onde tipo = 'manutencao')
    const { data: mans } = await supabase
      .from("crm_propostas").select("*")
      .eq("tipo", "manutencao").order("criado_em", { ascending: false });

    // 3. Busca leads para tudo de uma vez
    const leadIds = new Set<string>();
    (orcs || []).forEach((o: OrcamentoDB) => leadIds.add(o.lead_id));
    (mans || []).forEach((m: PropostaSalva) => m.lead_id && leadIds.add(m.lead_id));

    let mapaLeads: Record<string, Lead> = {};
    if (leadIds.size > 0) {
      const { data: leads } = await supabase
        .from("crm_leads").select("id,nome,empresa,cnpj,etapa,telefone,email")
        .in("id", [...leadIds]);
      if (leads) for (const l of leads as Lead[]) mapaLeads[l.id] = l;
    }

    setOrcamentos((orcs || []).map((o: OrcamentoDB) => ({ ...o, lead: mapaLeads[o.lead_id] })));
    setManutencoes((mans || []).map((m: PropostaSalva) => ({ ...m, lead: m.lead_id ? mapaLeads[m.lead_id] : undefined })));
    setCarregando(false);
  }

  // ── Filtros ─────────────────────────────────────────────────────────────
  function filtrar<T extends { lead?: Lead }>(lista: T[]) {
    return lista.filter(item => {
      if (filtroEtapa !== "todas" && item.lead?.etapa !== filtroEtapa) return false;
      if (!busca) return true;
      const q = busca.toLowerCase();
      return item.lead?.nome?.toLowerCase().includes(q) || item.lead?.empresa?.toLowerCase().includes(q);
    });
  }

  const orcsFiltrados = filtrar(orcamentos);
  const mansFiltradas = filtrar(manutencoes);

  // ── KPIs — Orçamentos ───────────────────────────────────────────────────
  const kpiOrc = {
    total: orcsFiltrados.reduce((s, o) => s + o.preco_final, 0),
    fechados: orcsFiltrados.filter(o => o.lead?.etapa === "fechado").reduce((s, o) => s + o.preco_final, 0),
    qtd: orcsFiltrados.length,
    qtdFechados: orcsFiltrados.filter(o => o.lead?.etapa === "fechado").length,
    ticket: orcsFiltrados.length > 0 ? orcsFiltrados.reduce((s, o) => s + o.preco_final, 0) / orcsFiltrados.length : 0,
  };

  // ── KPIs — Manutenções ──────────────────────────────────────────────────
  const mansFechadas = mansFiltradas.filter(m => m.status === "fechado");
  const kpiMan = {
    recorrenciaMensal: mansFechadas.reduce((s, m) => s + (m.conteudo?.parcela ?? 0), 0),
    recorrenciaAnual: mansFechadas.reduce((s, m) => s + (m.conteudo?.parcela ?? 0) * 12, 0),
    portas: mansFechadas.reduce((s, m) => s + (m.conteudo?.portas ?? 0), 0),
    qtdFechadas: mansFechadas.length,
    qtdTotal: mansFiltradas.length,
    emNegociacao: mansFiltradas.filter(m => m.status !== "fechado" && m.status !== "descontinuado").length,
    pipelineAnual: mansFiltradas
      .filter(m => m.status !== "descontinuado")
      .reduce((s, m) => s + (m.conteudo?.parcela ?? 0) * 12, 0),
  };

  const painelAberto = orcSelecionado || manSelecionada;

  return (
    <div className="flex h-full">
      {/* Lista principal */}
      <div className={cn("flex flex-col flex-1 min-w-0 overflow-auto p-4 md:p-6", painelAberto ? "hidden md:flex" : "flex")}>

        {/* Cabeçalho + abas */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos & Manutenções</h1>
          <p className="mt-0.5 text-sm text-gray-500">Propostas geradas pelo CRM</p>
          <div className="mt-4 flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
            <button onClick={() => { setAba("orcamentos"); setOrcSelecionado(null); setManSelecionada(null); }}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                aba === "orcamentos" ? "bg-white text-[#1a6b2f] shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              <Calculator className="h-4 w-4" />
              Orçamentos
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                aba === "orcamentos" ? "bg-[#1a6b2f]/10 text-[#1a6b2f]" : "bg-gray-200 text-gray-500")}>
                {orcamentos.length}
              </span>
            </button>
            <button onClick={() => { setAba("manutencao"); setOrcSelecionado(null); setManSelecionada(null); }}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                aba === "manutencao" ? "bg-white text-[#1a6b2f] shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              <Wrench className="h-4 w-4" />
              Manutenção 12×
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                aba === "manutencao" ? "bg-[#1a6b2f]/10 text-[#1a6b2f]" : "bg-gray-200 text-gray-500")}>
                {manutencoes.length}
              </span>
            </button>
          </div>
        </div>

        {/* ── KPIs — Orçamentos ── */}
        {aba === "orcamentos" && (
          <div className="mb-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Total em aberto</p>
              <p className="text-lg font-bold text-gray-900">{fmt(kpiOrc.total)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpiOrc.qtd} orçamentos</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Fechados</p>
              <p className="text-lg font-bold text-[#1a6b2f]">{fmt(kpiOrc.fechados)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpiOrc.qtdFechados} orçamentos</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm col-span-2 md:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Ticket médio</p>
              <p className="text-lg font-bold text-gray-900">{kpiOrc.qtd > 0 ? fmt(kpiOrc.ticket) : "—"}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Média dos filtrados</p>
            </div>
          </div>
        )}

        {/* ── KPIs — Manutenção ── */}
        {aba === "manutencao" && (
          <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Recorrência mensal</p>
              <p className="text-lg font-bold text-[#1a6b2f]">{fmt(kpiMan.recorrenciaMensal)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpiMan.qtdFechadas} contratos ativos</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Receita anual</p>
              <p className="text-lg font-bold text-gray-900">{fmt(kpiMan.recorrenciaAnual)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Contratos fechados</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Portas gerenciadas</p>
              <p className="text-lg font-bold text-gray-900">{kpiMan.portas}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Em contratos ativos</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Pipeline anual</p>
              <p className="text-lg font-bold text-orange-600">{fmt(kpiMan.pipelineAnual)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpiMan.emNegociacao} em negociação</p>
            </div>
          </div>
        )}

        {/* Busca + filtro */}
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
                    className={cn("flex w-full items-center px-4 py-2.5 text-sm hover:bg-gray-50",
                      filtroEtapa === "todas" ? "font-semibold text-[#1a6b2f]" : "text-gray-700")}>
                    Todas as etapas
                  </button>
                  <div className="border-t border-gray-100" />
                  {Object.entries(STATUS_ETAPA).map(([key, cfg]) => (
                    <button key={key} onClick={() => { setFiltroEtapa(key); setGavetaEtapa(false); }}
                      className={cn("flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50",
                        filtroEtapa === key ? "font-semibold text-[#1a6b2f]" : "text-gray-700")}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", cfg.bg)} />{cfg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Lista de Orçamentos ── */}
        {aba === "orcamentos" && (
          carregando ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">Carregando…</div>
          ) : orcsFiltrados.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Calculator className="mb-3 h-10 w-10 opacity-25" />
                <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
                <p className="mt-1 text-xs text-gray-300">Os orçamentos gerados no CRM aparecem aqui automaticamente</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px_40px] border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 gap-4">
                <span>Lead / Empresa</span><span>Etapa no CRM</span><span>Data</span><span className="text-right">Valor</span><span />
              </div>
              <div className="divide-y divide-gray-50">
                {orcsFiltrados.map(orc => {
                  const lead = orc.lead;
                  const etapaCfg = lead ? (STATUS_ETAPA[lead.etapa] ?? STATUS_ETAPA.prospecto) : null;
                  const ativo = orcSelecionado?.id === orc.id;
                  return (
                    <button key={orc.id} onClick={() => { setOrcSelecionado(ativo ? null : orc); setManSelecionada(null); }}
                      className={cn("w-full text-left transition-colors hover:bg-gray-50/60 px-5 py-4",
                        ativo && "bg-[#1a6b2f]/5 border-l-2 border-[#1a6b2f]")}>
                      {/* Mobile */}
                      <div className="md:hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                            <p className="text-xs text-gray-500 truncate">{lead?.empresa}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#1a6b2f]">{fmt(orc.preco_final)}</p>
                              <p className="text-[10px] text-gray-400">{fmtData(orc.criado_em)}</p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={e => pedirExclusao(e, orc.id, "orcamento", lead?.nome ?? lead?.empresa ?? "este orçamento")}
                                className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          {etapaCfg && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", etapaCfg.bg, etapaCfg.cor)}>{etapaCfg.label}</span>}
                        </div>
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px_40px] items-center gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3 flex-shrink-0" />{lead?.empresa ?? "Lead não encontrado"}
                          </p>
                        </div>
                        <div>
                          {etapaCfg ? <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", etapaCfg.bg, etapaCfg.cor)}>{etapaCfg.label}</span> : <span className="text-xs text-gray-300">—</span>}
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-300" />{fmtData(orc.criado_em)}
                        </p>
                        <p className="text-sm font-bold text-[#1a6b2f] text-right">{fmt(orc.preco_final)}</p>
                        {isAdmin ? (
                          <button
                            onClick={e => pedirExclusao(e, orc.id, "orcamento", lead?.nome ?? lead?.empresa ?? "este orçamento")}
                            className="justify-self-center rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Excluir orçamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <TrendingUp className="h-4 w-4 text-gray-300 justify-self-center" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Lista de Manutenções ── */}
        {aba === "manutencao" && (
          carregando ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">Carregando…</div>
          ) : mansFiltradas.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Wrench className="mb-3 h-10 w-10 opacity-25" />
                <p className="text-sm font-medium">Nenhuma manutenção encontrada</p>
                <p className="mt-1 text-xs text-gray-300">As propostas de manutenção 12× geradas no CRM aparecem aqui</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_120px_100px_110px_110px_40px] border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 gap-4">
                <span>Lead / Empresa</span><span>Status</span><span>Portas</span><span className="text-right">Parcela/mês</span><span className="text-right">Valor anual</span><span />
              </div>
              <div className="divide-y divide-gray-50">
                {mansFiltradas.map(man => {
                  const lead = man.lead;
                  const statusCfg = STATUS_PROPOSTA[man.status] ?? STATUS_PROPOSTA.criado;
                  const ativo = manSelecionada?.id === man.id;
                  const valorAnual = (man.conteudo?.parcela ?? 0) * 12;
                  return (
                    <button key={man.id} onClick={() => { setManSelecionada(ativo ? null : man); setOrcSelecionado(null); }}
                      className={cn("w-full text-left transition-colors hover:bg-gray-50/60 px-5 py-4",
                        ativo && "bg-[#1a6b2f]/5 border-l-2 border-[#1a6b2f]")}>
                      {/* Mobile */}
                      <div className="md:hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                            <p className="text-xs text-gray-500 truncate">{lead?.empresa}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#1a6b2f]">{fmt(man.conteudo?.parcela ?? 0)}/mês</p>
                              <p className="text-[10px] text-gray-400">{man.conteudo?.portas ?? 0} portas</p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={e => pedirExclusao(e, man.id, "manutencao", lead?.nome ?? lead?.empresa ?? "esta manutenção")}
                                className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusCfg.bg, statusCfg.cor)}>{statusCfg.label}</span>
                          <span className="text-[10px] text-gray-400">{fmtData(man.criado_em)}</span>
                        </div>
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:grid grid-cols-[1fr_120px_100px_110px_110px_40px] items-center gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{lead?.nome ?? "—"}</p>
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3 flex-shrink-0" />{lead?.empresa ?? "Lead não encontrado"}
                          </p>
                        </div>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit", statusCfg.bg, statusCfg.cor)}>{statusCfg.label}</span>
                        <p className="text-sm text-gray-700 font-medium">{man.conteudo?.portas ?? "—"} portas</p>
                        <p className="text-sm font-bold text-[#1a6b2f] text-right">{man.conteudo ? fmt(man.conteudo.parcela) : "—"}</p>
                        <p className="text-sm text-gray-600 text-right">{valorAnual > 0 ? fmt(valorAnual) : "—"}</p>
                        {isAdmin ? (
                          <button
                            onClick={e => pedirExclusao(e, man.id, "manutencao", lead?.nome ?? lead?.empresa ?? "esta manutenção")}
                            className="justify-self-center rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Excluir proposta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <Wrench className="h-4 w-4 text-gray-300 justify-self-center" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Painéis laterais */}
      {orcSelecionado && (
        <div className="flex-shrink-0 w-full md:w-96 h-full border-l border-gray-200">
          <PainelOrcamento orc={orcSelecionado} onFechar={() => setOrcSelecionado(null)} />
        </div>
      )}
      {manSelecionada && (
        <div className="flex-shrink-0 w-full md:w-96 h-full border-l border-gray-200">
          <PainelManutencao prop={manSelecionada} onFechar={() => setManSelecionada(null)} />
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {excluindoId && (
        <ModalConfirmarExclusao
          nome={excluindoNome}
          onConfirmar={confirmarExclusao}
          onCancelar={cancelarExclusao}
          excluindo={processandoExclusao}
        />
      )}
    </div>
  );
}
