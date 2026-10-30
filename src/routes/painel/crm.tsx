import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Search, Phone, Mail, X, LayoutList, Columns,
  Building2, FileText, Calendar, MessageSquare, ChevronRight,
  Loader2, Send, Pencil, Trash2, MapPin, Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/crm")({
  component: CrmPage,
});

type Etapa = "prospecto" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";

interface Lead {
  id: string;
  nome: string;
  empresa: string;
  cnpj: string;
  telefone: string;
  email: string;
  etapa: Etapa;
  valor_estimado: number | null;
  observacoes: string;
  prazo: string | null;
  endereco_fiscal: string;
  endereco_atendimento: string;
  criado_em: string;
}

interface Conversa {
  id: string;
  lead_id: string;
  texto: string;
  autor: string;
  criado_em: string;
}

const ETAPAS: Record<Etapa, { label: string; cor: string; bg: string; border: string }> = {
  prospecto:  { label: "Prospecto",   cor: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-300" },
  contato:    { label: "Em Contato",  cor: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-300" },
  proposta:   { label: "Proposta",    cor: "text-purple-700", bg: "bg-purple-100", border: "border-purple-300" },
  negociacao: { label: "Negociação",  cor: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300" },
  fechado:    { label: "Fechado ✓",   cor: "text-green-700",  bg: "bg-green-100",  border: "border-green-300" },
  perdido:    { label: "Perdido",     cor: "text-red-700",    bg: "bg-red-100",    border: "border-red-300" },
};

const ETAPA_ORDER: Etapa[] = ["prospecto", "contato", "proposta", "negociacao", "fechado", "perdido"];

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [filtroEtapa, setFiltroEtapa] = useState<Etapa | "todas">("todas");
  const [filtroPrazo, setFiltroPrazo] = useState("");

  // Modal novo/editar
  const [modal, setModal] = useState(false);
  const [selecionado, setSelecionado] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState("");

  // Card detalhado
  const [cardAberto, setCardAberto] = useState<Lead | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const conversaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("crm_leads").select("*").order("criado_em", { ascending: false });
    if (data) setLeads(data as Lead[]);
    setCarregando(false);
  }

  async function carregarConversas(leadId: string) {
    const { data } = await supabase
      .from("crm_conversas")
      .select("*")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: true });
    if (data) setConversas(data as Conversa[]);
    setTimeout(() => conversaRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
  }

  function abrirCard(lead: Lead) {
    setCardAberto(lead);
    carregarConversas(lead.id);
  }

  function abrirModal(lead?: Lead) {
    if (lead) {
      setSelecionado(lead);
      setForm({ ...lead });
    } else {
      setSelecionado(null);
      setForm({ nome: "", empresa: "", cnpj: "", telefone: "", email: "", etapa: "prospecto", valor_estimado: null, observacoes: "", prazo: null, endereco_fiscal: "", endereco_atendimento: "" });
    }
    setErroCNPJ("");
    setModal(true);
  }

  async function buscarCNPJ(cnpj: string) {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setBuscandoCNPJ(true);
    setErroCNPJ("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("não encontrado");
      const d = await res.json();
      // Monta endereço fiscal completo
      const partes = [
        d.logradouro && d.numero ? `${d.logradouro}, ${d.numero}` : d.logradouro,
        d.complemento,
        d.bairro,
        d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : d.municipio,
        d.cep ? d.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
      ].filter(Boolean);
      const enderecoFiscal = partes.join(", ");
      setForm(f => ({
        ...f,
        empresa: d.razao_social || f.empresa,
        email: d.email || f.email,
        telefone: d.ddd_telefone_1
          ? d.ddd_telefone_1.replace(/\D/g, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3")
          : f.telefone,
        endereco_fiscal: enderecoFiscal || f.endereco_fiscal,
      }));
    } catch {
      setErroCNPJ("CNPJ não encontrado na Receita Federal.");
    } finally {
      setBuscandoCNPJ(false);
    }
  }

  async function salvar() {
    if (!form.nome?.trim()) return;
    const payload = { ...form, cnpj: form.cnpj?.replace(/\D/g, "") || "" };
    if (selecionado) {
      await supabase.from("crm_leads").update(payload).eq("id", selecionado.id);
    } else {
      await supabase.from("crm_leads").insert(payload);
    }
    setModal(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lead?")) return;
    await supabase.from("crm_leads").delete().eq("id", id);
    if (cardAberto?.id === id) setCardAberto(null);
    carregar();
  }

  async function mudarEtapa(lead: Lead, etapa: Etapa) {
    await supabase.from("crm_leads").update({ etapa }).eq("id", lead.id);
    if (cardAberto?.id === lead.id) setCardAberto({ ...cardAberto, etapa });
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, etapa } : l));
  }

  async function enviarMensagem() {
    if (!novaMsg.trim() || !cardAberto) return;
    setEnviando(true);
    await supabase.from("crm_conversas").insert({
      lead_id: cardAberto.id,
      texto: novaMsg.trim(),
      autor: "Rafael",
    });
    setNovaMsg("");
    await carregarConversas(cardAberto.id);
    setEnviando(false);
  }

  // Filtros
  const hoje = new Date().toISOString().split("T")[0];
  const filtrados = leads.filter(l => {
    const buscaOk = !busca || l.nome?.toLowerCase().includes(busca.toLowerCase()) || l.empresa?.toLowerCase().includes(busca.toLowerCase()) || l.cnpj?.includes(busca);
    const etapaOk = filtroEtapa === "todas" || l.etapa === filtroEtapa;
    const prazoOk = !filtroPrazo || (l.prazo && l.prazo <= filtroPrazo);
    return buscaOk && etapaOk && prazoOk;
  });

  const porEtapa = ETAPA_ORDER.reduce((acc, e) => {
    acc[e] = filtrados.filter(l => l.etapa === e);
    return acc;
  }, {} as Record<Etapa, Lead[]>);

  return (
    <div className="flex h-full">
      {/* Painel principal */}
      <div className={cn("flex flex-col flex-1 min-w-0 p-6 overflow-auto", cardAberto && "hidden md:flex")}>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
            <p className="mt-0.5 text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} na pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle view */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView("lista")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm", view === "lista" ? "bg-[#1a6b2f] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <LayoutList className="h-4 w-4" /> Lista
              </button>
              <button onClick={() => setView("kanban")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm", view === "kanban" ? "bg-[#1a6b2f] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <Columns className="h-4 w-4" /> Kanban
              </button>
            </div>
            <button
              onClick={() => abrirModal()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
            >
              <Plus className="h-4 w-4" /> Novo Lead
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar por nome, empresa ou CNPJ…" value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
          </div>
          <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value as Etapa | "todas")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#1a6b2f]">
            <option value="todas">Todas as etapas</option>
            {ETAPA_ORDER.map(e => <option key={e} value={e}>{ETAPAS[e].label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input type="date" value={filtroPrazo} onChange={e => setFiltroPrazo(e.target.value)}
              title="Filtrar por prazo até esta data"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#1a6b2f]" />
            {filtroPrazo && <button onClick={() => setFiltroPrazo("")} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        {/* Badges de etapa */}
        <div className="mb-5 flex gap-2 flex-wrap">
          {ETAPA_ORDER.map(e => {
            const total = porEtapa[e].reduce((acc, l) => acc + (l.valor_estimado ?? 0), 0);
            return (
            <button key={e} onClick={() => setFiltroEtapa(filtroEtapa === e ? "todas" : e)}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity", ETAPAS[e].bg, ETAPAS[e].cor, filtroEtapa !== "todas" && filtroEtapa !== e && "opacity-40")}>
              {ETAPAS[e].label}
              <span className="font-bold">({porEtapa[e].length})</span>
              {total > 0 && <span className="opacity-80">· {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
            </button>
            );
          })}
        </div>

        {/* LISTA */}
        {view === "lista" && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregando ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <p className="text-sm">Nenhum lead encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lead / Empresa</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Contato</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Etapa</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Valor Est.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Prazo</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map(lead => {
                    const cfg = ETAPAS[lead.etapa];
                    const vencido = lead.prazo && lead.prazo < hoje;
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => abrirCard(lead)}>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-900">{lead.nome}</p>
                          <p className="text-xs text-gray-400">{lead.empresa}</p>
                          {lead.cnpj && <p className="text-xs text-gray-300 font-mono">{formatCNPJ(lead.cnpj)}</p>}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5">
                            {lead.telefone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{lead.telefone}</span>}
                            {lead.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail className="h-3 w-3" />{lead.email}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                          <select value={lead.etapa} onChange={e => mudarEtapa(lead, e.target.value as Etapa)}
                            className={cn("rounded-full px-2.5 py-1 text-xs font-medium border outline-none cursor-pointer", cfg.bg, cfg.cor, cfg.border)}>
                            {ETAPA_ORDER.map(e => <option key={e} value={e}>{ETAPAS[e].label}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 hidden md:table-cell">
                          {lead.valor_estimado ? lead.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          {lead.prazo ? (
                            <span className={cn("text-xs font-medium", vencido ? "text-red-600" : "text-gray-500")}>
                              {vencido && "⚠ "}{new Date(lead.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => abrirModal(lead)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => excluir(lead.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            <ChevronRight className="h-4 w-4 text-gray-300" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* KANBAN */}
        {view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ETAPA_ORDER.map(etapa => {
              const cfg = ETAPAS[etapa];
              const cards = porEtapa[etapa];
              const totalEtapa = cards.reduce((acc, l) => acc + (l.valor_estimado ?? 0), 0);
              return (
                <div key={etapa} className="flex-shrink-0 w-64">
                  <div className={cn("mb-3 rounded-lg px-3 py-2", cfg.bg)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", cfg.cor)}>{cfg.label}</span>
                      <span className={cn("text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center", cfg.cor, "bg-white/60")}>{cards.length}</span>
                    </div>
                    {totalEtapa > 0 && (
                      <p className={cn("text-xs font-bold", cfg.cor)}>
                        {totalEtapa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {cards.map(lead => {
                      const vencido = lead.prazo && lead.prazo < hoje;
                      return (
                        <div key={lead.id} onClick={() => abrirCard(lead)}
                          className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{lead.nome}</p>
                          {lead.empresa && <p className="mt-0.5 text-xs text-gray-400">{lead.empresa}</p>}
                          {lead.valor_estimado && (
                            <p className="mt-2 text-xs font-semibold text-[#1a6b2f]">
                              {lead.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          )}
                          {lead.prazo && (
                            <p className={cn("mt-1 flex items-center gap-1 text-xs", vencido ? "text-red-500" : "text-gray-400")}>
                              <Calendar className="h-3 w-3" />
                              {vencido && "⚠ "}{new Date(lead.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          )}
                          {lead.telefone && <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Phone className="h-3 w-3" />{lead.telefone}</p>}
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-xs text-gray-300">
                        Nenhum lead
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CARD DETALHADO (painel lateral) */}
      {cardAberto && (
        <div className="flex flex-col w-full md:w-[420px] border-l border-gray-200 bg-white">
          {/* Header do card */}
          <div className="flex items-start justify-between p-5 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{cardAberto.nome}</h2>
              {cardAberto.empresa && <p className="text-sm text-gray-500">{cardAberto.empresa}</p>}
              {cardAberto.cnpj && <p className="text-xs text-gray-400 font-mono">{formatCNPJ(cardAberto.cnpj)}</p>}
            </div>
            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <button onClick={() => { abrirModal(cardAberto); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setCardAberto(null)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Etapa rápida */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {ETAPA_ORDER.map(e => (
              <button key={e} onClick={() => mudarEtapa(cardAberto, e)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-all", cardAberto.etapa === e ? cn(ETAPAS[e].bg, ETAPAS[e].cor, ETAPAS[e].border, "ring-2 ring-offset-1", ETAPAS[e].border) : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100")}>
                {ETAPAS[e].label}
              </button>
            ))}
          </div>

          {/* Dados */}
          <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-2 gap-3 text-sm">
            {cardAberto.telefone && (
              <div className="flex items-center gap-2 text-gray-600"><Phone className="h-4 w-4 text-gray-300 flex-shrink-0" /><span className="truncate">{cardAberto.telefone}</span></div>
            )}
            {cardAberto.email && (
              <div className="flex items-center gap-2 text-gray-600"><Mail className="h-4 w-4 text-gray-300 flex-shrink-0" /><span className="truncate">{cardAberto.email}</span></div>
            )}
            {cardAberto.valor_estimado && (
              <div className="flex items-center gap-2 text-gray-600"><FileText className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <span className="font-semibold text-[#1a6b2f]">{cardAberto.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            )}
            {cardAberto.prazo && (
              <div className={cn("flex items-center gap-2", cardAberto.prazo < hoje ? "text-red-500" : "text-gray-600")}>
                <Calendar className="h-4 w-4 flex-shrink-0 text-gray-300" />
                {new Date(cardAberto.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>

          {(cardAberto.endereco_fiscal || cardAberto.endereco_atendimento) && (
            <div className="px-5 py-3 border-b border-gray-100 space-y-2">
              {cardAberto.endereco_fiscal && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Endereço Fiscal</p>
                  <p className="flex items-start gap-1.5 text-sm text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                    {cardAberto.endereco_fiscal}
                  </p>
                </div>
              )}
              {cardAberto.endereco_atendimento && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Endereço de Atendimento</p>
                  <p className="flex items-start gap-1.5 text-sm text-gray-600">
                    <Navigation className="h-3.5 w-3.5 text-[#1a6b2f] mt-0.5 flex-shrink-0" />
                    {cardAberto.endereco_atendimento}
                  </p>
                </div>
              )}
            </div>
          )}

          {cardAberto.observacoes && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Observações</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{cardAberto.observacoes}</p>
            </div>
          )}

          {/* Histórico de conversas */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Histórico</span>
            </div>
            <div ref={conversaRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
              {conversas.length === 0 ? (
                <p className="text-center text-xs text-gray-300 py-4">Nenhuma conversa registrada</p>
              ) : conversas.map(c => (
                <div key={c.id} className="rounded-xl bg-gray-50 px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{c.autor}</span>
                    <span className="text-xs text-gray-400">{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.texto}</p>
                </div>
              ))}
            </div>
            {/* Input de nova mensagem */}
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <textarea
                rows={2}
                value={novaMsg}
                onChange={e => setNovaMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }}}
                placeholder="Registrar interação…"
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
              <button onClick={enviarMensagem} disabled={enviando || !novaMsg.trim()}
                className="flex items-center justify-center rounded-lg bg-[#1a6b2f] px-3 text-white hover:bg-[#155824] disabled:opacity-40">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar lead */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selecionado ? "Editar Lead" : "Novo Lead"}</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {/* CNPJ */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">CNPJ</label>
                <div className="flex gap-2">
                  <input type="text" value={formatCNPJ(form.cnpj || "")}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, cnpj: v })); setErroCNPJ(""); }}
                    placeholder="00.000.000/0001-00"
                    className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20 font-mono" />
                  <button type="button" onClick={() => buscarCNPJ(form.cnpj || "")} disabled={buscandoCNPJ || (form.cnpj?.replace(/\D/g, "")?.length !== 14)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    {buscandoCNPJ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    Buscar
                  </button>
                </div>
                {erroCNPJ && <p className="mt-1 text-xs text-red-500">{erroCNPJ}</p>}
                {!erroCNPJ && form.cnpj?.replace(/\D/g, "").length === 14 && !buscandoCNPJ && (
                  <p className="mt-1 text-xs text-gray-400">Digite 14 dígitos e clique em Buscar para preencher automaticamente</p>
                )}
              </div>

              {[
                { label: "Nome do cliente *", field: "nome", type: "text", placeholder: "Nome completo" },
                { label: "Empresa / Condomínio", field: "empresa", type: "text", placeholder: "Razão social ou nome" },
                { label: "Telefone / WhatsApp", field: "telefone", type: "tel", placeholder: "(21) 99999-9999" },
                { label: "E-mail", field: "email", type: "email", placeholder: "contato@empresa.com" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                  <input type={type} placeholder={placeholder}
                    value={(form as Record<string, unknown>)[field] as string || ""}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Etapa</label>
                  <select value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value as Etapa })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {ETAPA_ORDER.map(e => <option key={e} value={e}>{ETAPAS[e].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Prazo</label>
                  <input type="date" value={form.prazo || ""}
                    onChange={e => setForm({ ...form, prazo: e.target.value || null })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor estimado (R$)</label>
                <input type="number" value={form.valor_estimado ?? ""}
                  onChange={e => setForm({ ...form, valor_estimado: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-400" /> Endereço Fiscal</span>
                  <span className="text-xs font-normal text-gray-400 ml-5">Preenchido automaticamente pelo CNPJ</span>
                </label>
                <input type="text" value={form.endereco_fiscal ?? ""}
                  onChange={e => setForm({ ...form, endereco_fiscal: e.target.value })}
                  placeholder="Rua, Nº, Bairro, Cidade - UF, CEP"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-[#1a6b2f]" /> Endereço de Atendimento / Entrega</span>
                </label>
                <input type="text" value={form.endereco_atendimento ?? ""}
                  onChange={e => setForm({ ...form, endereco_atendimento: e.target.value })}
                  placeholder="Local onde será feito o serviço ou entrega"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Observações</label>
                <textarea rows={3} value={form.observacoes ?? ""}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvar} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
