import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, MapPin, Phone, Mail, Building2, Plus, Loader2,
  CheckCircle, X, ExternalLink, Target, ChevronRight, ArrowLeft,
  Star, Ban, MessageSquare, ChevronDown, ChevronUp, Clock, List,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/hunter")({
  component: HunterPage,
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusLead = "novo" | "contatado" | "negado" | "convertido";

interface HunterLead {
  id: string;
  campanha_id: string;
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  categoria: string;
  rating: number | null;
  reviews: number | null;
  website: string;
  maps_url: string;
  status: StatusLead;
  motivo_negado: string | null;
  crm_lead_id: string | null;
  criado_em: string;
}

interface Campanha {
  id: string;
  cidade: string;
  bairro: string | null;
  segmento: string;
  total: number;
  criado_em: string;
}

interface ResultadoApify {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  categoria: string;
  rating: number | null;
  reviews: number | null;
  website: string;
  maps_url: string;
  lat: number | null;
  lon: number | null;
}

// ─── Dados de apoio ──────────────────────────────────────────────────────────

const BAIRROS_POR_CIDADE: Record<string, string[]> = {
  "rio de janeiro": ["Barra da Tijuca","Recreio","Jacarepaguá","Tijuca","Botafogo","Copacabana","Ipanema","Leblon","Flamengo","Centro","Méier","Campo Grande","Ilha do Governador","Santa Cruz","Grajaú","Laranjeiras"],
  "são paulo": ["Moema","Itaim Bibi","Pinheiros","Jardins","Vila Mariana","Brooklin","Vila Olímpia","Perdizes","Higienópolis","Centro","Morumbi","Campo Belo","Lapa","Santana","Tatuapé"],
  "belo horizonte": ["Savassi","Lourdes","Funcionários","Buritis","Pampulha","Centro","Anchieta","Mangabeiras","Floresta","Santa Efigênia","Gutierrez","Barreiro"],
  "curitiba": ["Batel","Água Verde","Bigorrilho","Juvevê","Boa Vista","Portão","Centro","Bacacheri","Cabral","Mercês","Rebouças"],
  "salvador": ["Barra","Pituba","Ondina","Rio Vermelho","Itaigara","Paralela","Brotas","Liberdade","Itapuã","Piatã","Stella Maris","Centro"],
  "balneario camboriu": ["Centro","Barra Sul","Barra Norte","Pioneiros","Tabuleiro","Nações","Municípios","Agronomica"],
  "florianopolis": ["Centro","Lagoa da Conceição","Ingleses","Trindade","Itacorubi","Canasvieiras","Jurerê","Barra da Lagoa","Coqueiros"],
  "default": ["Centro","Jardim","Vila Nova","Santa Maria","São José","Boa Vista","Nova Esperança","Bairro Alto","Jardim América"],
};

const SEGMENTOS = [
  "Condomínio Residencial","Condomínio Comercial","Shopping Center",
  "Hospital","Escola / Faculdade","Hotel","Supermercado",
  "Indústria / Galpão","Academia","Banco / Agência",
];

const MOTIVOS_NEGADO = [
  "Sem interesse","Já é cliente","Concorrente","Não tem portas corta-fogo",
  "Fora da área de atuação","Sem retorno","Outro",
];

const STATUS_CONFIG: Record<StatusLead, { label: string; cor: string }> = {
  novo:       { label: "Novo",       cor: "bg-blue-100 text-blue-700 border-blue-200" },
  contatado:  { label: "Contatado",  cor: "bg-amber-100 text-amber-700 border-amber-200" },
  negado:     { label: "Negado",     cor: "bg-red-100 text-red-700 border-red-200" },
  convertido: { label: "No CRM",     cor: "bg-green-100 text-green-700 border-green-200" },
};

function getBairros(cidade: string): string[] {
  const k = Object.keys(BAIRROS_POR_CIDADE).find(c => cidade.toLowerCase().includes(c));
  return BAIRROS_POR_CIDADE[k ?? "default"];
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HunterPage() {
  const [aba, setAba] = useState<"buscar" | "campanhas">("buscar");

  // Fluxo de busca
  const [etapa, setEtapa]                         = useState<"cidade"|"bairro"|"segmento"|"resultados">("cidade");
  const [cidadeInput, setCidadeInput]             = useState("");
  const [cidadeSelecionada, setCidadeSelecionada] = useState("");
  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const [bairroCustom, setBairroCustom]           = useState("");
  const [segmento, setSegmento]                   = useState("");
  const [carregando, setCarregando]               = useState(false);
  const [erro, setErro]                           = useState("");

  // Campanha atual (após busca)
  const [campanhaAtual, setCampanhaAtual]         = useState<Campanha | null>(null);
  const [leadsAtual, setLeadsAtual]               = useState<HunterLead[]>([]);

  // Modal de negado
  const [modalNegado, setModalNegado]             = useState<HunterLead | null>(null);
  const [motivoInput, setMotivoInput]             = useState("");

  // Lista de campanhas
  const [campanhas, setCampanhas]                 = useState<Campanha[]>([]);
  const [campanhaAberta, setCampanhaAberta]       = useState<string | null>(null);
  const [leadsCampanha, setLeadsCampanha]         = useState<Record<string, HunterLead[]>>({});
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);

  useEffect(() => {
    if (aba === "campanhas") carregarCampanhas();
  }, [aba]);

  async function carregarCampanhas() {
    setCarregandoCampanhas(true);
    const { data } = await supabase
      .from("hunter_campanhas")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(50);
    setCampanhas(data ?? []);
    setCarregandoCampanhas(false);
  }

  async function carregarLeadsCampanha(campanhaId: string) {
    if (leadsCampanha[campanhaId]) return;
    const { data } = await supabase
      .from("hunter_leads")
      .select("*")
      .eq("campanha_id", campanhaId)
      .order("criado_em", { ascending: true });
    setLeadsCampanha(prev => ({ ...prev, [campanhaId]: data ?? [] }));
  }

  // ── Busca ─────────────────────────────────────────────────────────────────
  function confirmarCidade() {
    if (!cidadeInput.trim()) return;
    setCidadeSelecionada(cidadeInput.trim());
    setEtapa("bairro");
  }

  function selecionarBairro(b: string) {
    setBairroSelecionado(b);
    setEtapa("segmento");
  }

  async function buscarResultados(seg: string) {
    setSegmento(seg);
    setCarregando(true);
    setErro("");
    setLeadsAtual([]);
    setCampanhaAtual(null);
    setEtapa("resultados");

    try {
      // 1. Busca leads já conhecidos para dedup
      const { data: jaConhecidos } = await supabase
        .from("hunter_leads")
        .select("chave_dedup")
        .eq("cidade", cidadeSelecionada.toLowerCase());
      const jaProspectados = new Set((jaConhecidos ?? []).map((l: { chave_dedup: string }) => l.chave_dedup));

      // 2. Chama Apify via Edge Function
      const { data, error } = await supabase.functions.invoke("hunter-scrape", {
        body: {
          query: seg,
          cidade: cidadeSelecionada,
          bairro: bairroSelecionado || undefined,
          maxItems: 25,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultados: ResultadoApify[] = data?.results ?? [];
      if (resultados.length === 0) {
        setErro("Nenhum resultado encontrado. Tente outro segmento ou bairro.");
        setCarregando(false);
        return;
      }

      // 3. Cria campanha
      const { data: campanha, error: errCamp } = await supabase
        .from("hunter_campanhas")
        .insert({
          cidade: cidadeSelecionada,
          bairro: bairroSelecionado || null,
          segmento: seg,
          total: resultados.length,
        })
        .select()
        .single();
      if (errCamp) throw new Error(errCamp.message);

      // 4. Insere leads — já negados ficam marcados automaticamente
      const leadsParaInserir = resultados.map(r => {
        const chave = r.nome.toLowerCase().trim();
        const jaVisto = jaProspectados.has(chave);
        return {
          campanha_id: campanha.id,
          nome: r.nome,
          telefone: r.telefone || "",
          email: r.email || "",
          endereco: r.endereco || "",
          categoria: r.categoria || "",
          rating: r.rating,
          reviews: r.reviews,
          website: r.website || "",
          maps_url: r.maps_url || "",
          cidade: cidadeSelecionada.toLowerCase(),
          status: jaVisto ? "negado" : "novo",
          motivo_negado: jaVisto ? "Já prospectado anteriormente" : null,
        };
      });

      const { data: leadsInseridos, error: errLeads } = await supabase
        .from("hunter_leads")
        .insert(leadsParaInserir)
        .select();
      if (errLeads) throw new Error(errLeads.message);

      setCampanhaAtual(campanha);
      setLeadsAtual(leadsInseridos ?? []);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao buscar.");
    } finally {
      setCarregando(false);
    }
  }

  // ── Ações nos leads ───────────────────────────────────────────────────────
  async function atualizarStatus(lead: HunterLead, status: StatusLead, motivo?: string) {
    const update: Partial<HunterLead> = { status };
    if (motivo !== undefined) update.motivo_negado = motivo;

    await supabase.from("hunter_leads").update(update).eq("id", lead.id);

    const aplicar = (lista: HunterLead[]) =>
      lista.map(l => l.id === lead.id ? { ...l, ...update } : l);

    setLeadsAtual(aplicar);
    setLeadsCampanha(prev => {
      if (!prev[lead.campanha_id]) return prev;
      return { ...prev, [lead.campanha_id]: aplicar(prev[lead.campanha_id]) };
    });
    setModalNegado(null);
    setMotivoInput("");
  }

  async function adicionarAoCRM(lead: HunterLead) {
    const { data: crmLead } = await supabase
      .from("crm_leads")
      .insert({
        nome: lead.nome, empresa: lead.nome, cnpj: "",
        telefone: lead.telefone, email: lead.email,
        etapa: "prospecto",
        valor_estimado: null, tipo_negocio: null,
        observacoes: [
          "Lead captado via Hunter (Google Maps).",
          lead.categoria ? `Categoria: ${lead.categoria}.` : "",
          lead.rating ? `Rating: ${lead.rating}⭐ (${lead.reviews} avaliações).` : "",
          lead.website ? `Site: ${lead.website}.` : "",
        ].filter(Boolean).join(" "),
        endereco_fiscal: lead.endereco,
        endereco_atendimento: lead.endereco,
        data_inicio: new Date().toISOString(),
      })
      .select()
      .single();

    if (crmLead) {
      await supabase.from("hunter_leads").update({
        status: "convertido",
        crm_lead_id: crmLead.id,
      }).eq("id", lead.id);
      atualizarStatus(lead, "convertido");
    }
  }

  function reiniciar() {
    setEtapa("cidade");
    setCidadeInput("");
    setCidadeSelecionada("");
    setBairroSelecionado("");
    setBairroCustom("");
    setSegmento("");
    setLeadsAtual([]);
    setErro("");
    setCampanhaAtual(null);
  }

  const bairros = getBairros(cidadeSelecionada);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]/10">
          <Target className="h-5 w-5 text-[#1a6b2f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Hunter</h1>
          <p className="text-sm text-gray-500">Prospecção inteligente via Google Maps</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setAba("buscar")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              aba === "buscar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            <Search className="h-4 w-4" /> Nova Busca
          </button>
          <button onClick={() => setAba("campanhas")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              aba === "campanhas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            <List className="h-4 w-4" /> Campanhas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">

        {/* ═══════ ABA: NOVA BUSCA ═══════ */}
        {aba === "buscar" && (
          <>
            {/* Breadcrumb */}
            {etapa !== "cidade" && (
              <div className="flex items-center gap-2 mb-6 text-sm">
                {[
                  { key: "cidade",   label: cidadeSelecionada || "Cidade" },
                  { key: "bairro",   label: bairroSelecionado || "Bairro" },
                  { key: "segmento", label: segmento || "Segmento" },
                ].map((item, i) => {
                  const ordem = ["cidade","bairro","segmento","resultados"];
                  const concluido = ordem.indexOf(etapa) > ordem.indexOf(item.key);
                  return (
                    <span key={item.key} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
                      <span className={cn("font-medium transition-colors",
                        concluido ? "text-[#1a6b2f] cursor-pointer hover:underline" : "text-gray-900")}
                        onClick={() => {
                          if (!concluido) return;
                          if (item.key === "cidade") reiniciar();
                          else if (item.key === "bairro") { setEtapa("bairro"); setLeadsAtual([]); }
                          else if (item.key === "segmento") { setEtapa("segmento"); setLeadsAtual([]); }
                        }}>
                        {item.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Etapa 1 — Cidade */}
            {etapa === "cidade" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Em qual cidade prospectar?</p>
                <p className="text-xs text-gray-400 mb-4">Leads salvos · negados não aparecem em buscas futuras</p>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ex: Rio de Janeiro, Balneário Camboriú..."
                      value={cidadeInput}
                      onChange={e => setCidadeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && confirmarCidade()}
                      autoFocus />
                  </div>
                  <button onClick={confirmarCidade} disabled={!cidadeInput.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-8 flex flex-col items-center justify-center py-8">
                  <Target className="h-14 w-14 mb-3 text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">Histórico de prospecção inteligente</p>
                  <p className="text-xs text-gray-300 mt-1">Cada busca vira uma campanha salva para acompanhar</p>
                </div>
              </div>
            )}

            {/* Etapa 2 — Bairro */}
            {etapa === "bairro" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Qual bairro em <span className="text-[#1a6b2f]">{cidadeSelecionada}</span>?
                </p>
                <p className="text-xs text-gray-400 mb-4">Restringe a busca a um bairro específico</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {bairros.map(b => (
                    <button key={b} onClick={() => selecionarBairro(b)}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-[#1a6b2f] hover:text-[#1a6b2f] hover:bg-[#1a6b2f]/5 transition-colors">
                      {b}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ou digite outro bairro..."
                      value={bairroCustom}
                      onChange={e => setBairroCustom(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && bairroCustom && selecionarBairro(bairroCustom)} />
                  </div>
                  {bairroCustom && (
                    <button onClick={() => selecionarBairro(bairroCustom)}
                      className="px-4 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] transition-colors">
                      Confirmar
                    </button>
                  )}
                  <button onClick={() => selecionarBairro("")}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                    Cidade toda
                  </button>
                </div>
              </div>
            )}

            {/* Etapa 3 — Segmento */}
            {etapa === "segmento" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Que tipo de cliente busca?</p>
                <p className="text-xs text-gray-400 mb-4">
                  {bairroSelecionado ? `${bairroSelecionado}, ${cidadeSelecionada}` : `Toda a cidade de ${cidadeSelecionada}`}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {SEGMENTOS.map(s => (
                    <button key={s} onClick={() => buscarResultados(s)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-[#1a6b2f] hover:text-[#1a6b2f] hover:bg-[#1a6b2f]/5 transition-colors text-left">
                      <Building2 className="h-4 w-4 flex-shrink-0 opacity-40" />{s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ou digite outro segmento e pressione Enter..."
                      onKeyDown={e => {
                        const val = (e.target as HTMLInputElement).value;
                        if (e.key === "Enter" && val) buscarResultados(val);
                      }} />
                  </div>
                </div>
              </div>
            )}

            {/* Carregando */}
            {etapa === "resultados" && carregando && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#1a6b2f]" />
                <p className="text-sm font-medium text-gray-600">Buscando no Google Maps…</p>
                <p className="text-xs text-gray-400 mt-1">
                  {segmento}{bairroSelecionado ? ` em ${bairroSelecionado}` : ""}, {cidadeSelecionada}
                </p>
                <p className="text-xs text-gray-300 mt-3">Leva entre 30 e 90 segundos · Salvando como campanha</p>
              </div>
            )}

            {erro && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                <X className="h-4 w-4 flex-shrink-0" />{erro}
              </div>
            )}

            {/* Resultados */}
            {!carregando && leadsAtual.length > 0 && campanhaAtual && (
              <LeadsLista
                leads={leadsAtual}
                titulo={`${leadsAtual.length} leads · ${segmento}${bairroSelecionado ? ` · ${bairroSelecionado}` : ""} · ${cidadeSelecionada}`}
                onNovaBusca={reiniciar}
                onAtualizarStatus={atualizarStatus}
                onAdicionarCRM={adicionarAoCRM}
                onNegar={(lead) => { setModalNegado(lead); setMotivoInput(""); }}
              />
            )}
          </>
        )}

        {/* ═══════ ABA: CAMPANHAS ═══════ */}
        {aba === "campanhas" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Histórico de prospecção</p>
              {carregandoCampanhas && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>

            {!carregandoCampanhas && campanhas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Clock className="h-12 w-12 mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Nenhuma campanha ainda</p>
                <p className="text-xs text-gray-300 mt-1">Faça uma busca para criar sua primeira campanha</p>
              </div>
            )}

            {campanhas.map(camp => {
              const aberta  = campanhaAberta === camp.id;
              const leads   = leadsCampanha[camp.id] ?? [];
              const novos   = leads.filter(l => l.status === "novo").length;
              const negados = leads.filter(l => l.status === "negado").length;
              const convertidos = leads.filter(l => l.status === "convertido").length;

              return (
                <div key={camp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={async () => {
                      if (!aberta) await carregarLeadsCampanha(camp.id);
                      setCampanhaAberta(aberta ? null : camp.id);
                    }}>
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a6b2f]/10">
                      <Target className="h-4 w-4 text-[#1a6b2f]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{camp.segmento}</p>
                      <p className="text-xs text-gray-400">
                        {camp.bairro ? `${camp.bairro}, ` : ""}{camp.cidade}
                        {" · "}{new Date(camp.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{camp.total} leads</span>
                      {aberta && leads.length > 0 && (
                        <>
                          {novos > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{novos} novos</span>}
                          {negados > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{negados} neg.</span>}
                          {convertidos > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{convertidos} CRM</span>}
                        </>
                      )}
                      {aberta ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {aberta && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {leads.length === 0
                        ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
                        : <LeadsLista
                            leads={leads}
                            compact
                            onAtualizarStatus={atualizarStatus}
                            onAdicionarCRM={adicionarAoCRM}
                            onNegar={(lead) => { setModalNegado(lead); setMotivoInput(""); }}
                          />
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal — Negar lead */}
      {modalNegado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setModalNegado(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Ban className="h-5 w-5 text-red-500" />
              <h3 className="font-bold text-gray-900">Negar lead</h3>
            </div>
            <p className="text-sm text-gray-600 mb-0.5 font-medium">{modalNegado.nome}</p>
            <p className="text-xs text-gray-400 mb-4">Este lead não aparecerá em buscas futuras nessa cidade.</p>
            <p className="text-xs font-medium text-gray-600 mb-2">Motivo</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {MOTIVOS_NEGADO.map(m => (
                <button key={m} onClick={() => setMotivoInput(m)}
                  className={cn("px-3 py-1 rounded-full text-xs border transition-colors",
                    motivoInput === m
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "border-gray-200 text-gray-600 hover:border-red-200")}>
                  {m}
                </button>
              ))}
            </div>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Ou descreva o motivo..."
              value={motivoInput}
              onChange={e => setMotivoInput(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setModalNegado(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => atualizarStatus(modalNegado, "negado", motivoInput || "Sem interesse")}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: lista de leads ──────────────────────────────────────────

function LeadsLista({
  leads, titulo, compact = false, onNovaBusca,
  onAtualizarStatus, onAdicionarCRM, onNegar,
}: {
  leads: HunterLead[];
  titulo?: string;
  compact?: boolean;
  onNovaBusca?: () => void;
  onAtualizarStatus: (lead: HunterLead, status: StatusLead, motivo?: string) => void;
  onAdicionarCRM: (lead: HunterLead) => void;
  onNegar: (lead: HunterLead) => void;
}) {
  const [filtro, setFiltro] = useState<StatusLead | "todos">("todos");
  const leadsFiltrados = filtro === "todos" ? leads : leads.filter(l => l.status === filtro);

  return (
    <div className="space-y-2 pt-3">
      {titulo && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{titulo}</p>
          {onNovaBusca && (
            <button onClick={onNovaBusca}
              className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
              <ArrowLeft className="h-3 w-3" /> Nova busca
            </button>
          )}
        </div>
      )}

      {/* Filtro por status */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(["todos","novo","contatado","negado","convertido"] as const).map(f => {
          const count = f === "todos" ? leads.length : leads.filter(l => l.status === f).length;
          if (count === 0 && f !== "todos") return null;
          return (
            <button key={f} onClick={() => setFiltro(f)}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                filtro === f
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
              {f === "todos" ? "Todos" : STATUS_CONFIG[f].label} ({count})
            </button>
          );
        })}
      </div>

      {leadsFiltrados.map(lead => (
        <LeadCard
          key={lead.id}
          lead={lead}
          compact={compact}
          onContatado={() => onAtualizarStatus(lead, "contatado")}
          onNegar={() => onNegar(lead)}
          onCRM={() => onAdicionarCRM(lead)}
        />
      ))}

      {leadsFiltrados.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">Nenhum lead com esse status</div>
      )}
    </div>
  );
}

// ─── Sub-componente: card de lead ─────────────────────────────────────────────

function LeadCard({
  lead, compact = false, onContatado, onNegar, onCRM,
}: {
  lead: HunterLead;
  compact?: boolean;
  onContatado: () => void;
  onNegar: () => void;
  onCRM: () => void;
}) {
  const cfg      = STATUS_CONFIG[lead.status];
  const negado   = lead.status === "negado";
  const convertido = lead.status === "convertido";

  return (
    <div className={cn(
      "bg-white rounded-xl border p-3 transition-all",
      negado     ? "opacity-50 border-red-100 bg-red-50/20" :
      convertido ? "border-green-200 bg-green-50/30" :
                   "border-gray-200 hover:border-gray-300"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
          negado ? "bg-red-100" : convertido ? "bg-green-100" : "bg-gray-100")}>
          {negado    ? <Ban className="h-4 w-4 text-red-400" /> :
           convertido ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                        <Building2 className="h-4 w-4 text-gray-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-semibold text-sm", negado ? "line-through text-gray-400" : "text-gray-900")}>
              {lead.nome}
            </p>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", cfg.cor)}>
              {cfg.label}
            </span>
            {lead.rating && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {lead.rating.toFixed(1)}
              </span>
            )}
          </div>

          {negado && lead.motivo_negado && (
            <p className="text-[11px] text-red-400 mt-0.5">{lead.motivo_negado}</p>
          )}

          {!compact && lead.endereco && (
            <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />{lead.endereco}
            </p>
          )}

          {!negado && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {lead.telefone ? (
                <a href={`tel:${lead.telefone}`}
                  className="flex items-center gap-1 text-xs font-medium text-[#1a6b2f] bg-[#1a6b2f]/8 px-2 py-0.5 rounded-full hover:bg-[#1a6b2f]/15 transition-colors">
                  <Phone className="h-3 w-3" />{lead.telefone}
                </a>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-300 px-2 py-0.5 rounded-full border border-dashed border-gray-200">
                  <Phone className="h-3 w-3" />Sem telefone
                </span>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`}
                  className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
                  <Mail className="h-3 w-3" />{lead.email}
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors">
                  <ExternalLink className="h-3 w-3" />Site
                </a>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        {!negado && !convertido && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={onContatado} title="Marcar como contatado"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-amber-600 hover:border-amber-300 transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            <button onClick={onNegar} title="Negar lead"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">
              <Ban className="h-3.5 w-3.5" />
            </button>
            <button onClick={onCRM}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a6b2f] text-white text-xs font-medium hover:bg-[#155a27] transition-colors">
              <Plus className="h-3.5 w-3.5" /> CRM
            </button>
          </div>
        )}
        {convertido && (
          <div className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
            <CheckCircle className="h-4 w-4" /> No CRM
          </div>
        )}
      </div>
    </div>
  );
}
