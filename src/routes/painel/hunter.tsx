import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, MapPin, Phone, Mail, Building2, Plus, Loader2,
  CheckCircle, X, ExternalLink, Target, ChevronRight, ArrowLeft, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/hunter")({
  component: HunterPage,
});

interface Resultado {
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

// Bairros por cidade (para seleção rápida)
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
  "Condomínio Residencial",
  "Condomínio Comercial",
  "Shopping Center",
  "Hospital",
  "Escola / Faculdade",
  "Hotel",
  "Supermercado",
  "Indústria / Galpão",
  "Academia",
  "Banco / Agência",
];

function getBairros(cidade: string): string[] {
  const k = Object.keys(BAIRROS_POR_CIDADE).find(c =>
    cidade.toLowerCase().includes(c)
  );
  return BAIRROS_POR_CIDADE[k ?? "default"];
}

export default function HunterPage() {
  // Etapas: cidade → bairro → segmento → resultados
  const [etapa, setEtapa] = useState<"cidade" | "bairro" | "segmento" | "resultados">("cidade");
  const [cidadeInput, setCidadeInput]         = useState("");
  const [cidadeSelecionada, setCidadeSelecionada] = useState("");
  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const [segmento, setSegmento]               = useState("");
  const [resultados, setResultados]           = useState<Resultado[]>([]);
  const [carregando, setCarregando]           = useState(false);
  const [erro, setErro]                       = useState("");
  const [adicionando, setAdicionando]         = useState<string | null>(null);
  const [confirmados, setConfirmados]         = useState<Set<string>>(new Set());
  const [bairroCustom, setBairroCustom]       = useState("");

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
    setResultados([]);
    setEtapa("resultados");

    try {
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

      const lista: Resultado[] = data?.results ?? [];
      if (lista.length === 0) {
        setErro("Nenhum resultado encontrado. Tente outro segmento ou bairro.");
      }
      setResultados(lista);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao buscar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarAoCRM(r: Resultado) {
    const key = r.nome + r.endereco;
    setAdicionando(key);
    try {
      await supabase.from("crm_leads").insert({
        nome: r.nome,
        empresa: r.nome,
        cnpj: "",
        telefone: r.telefone,
        email: r.email,
        etapa: "prospecto",
        valor_estimado: null,
        tipo_negocio: null,
        observacoes: [
          `Lead captado via Hunter — Google Maps (Apify).`,
          r.categoria ? `Categoria: ${r.categoria}.` : "",
          r.rating ? `Rating: ${r.rating}⭐ (${r.reviews} avaliações).` : "",
          r.website ? `Site: ${r.website}.` : "",
          bairroSelecionado ? `Bairro: ${bairroSelecionado}.` : "",
        ].filter(Boolean).join(" "),
        prazo: null,
        proximo_contato: null,
        endereco_fiscal: r.endereco,
        endereco_atendimento: r.endereco,
        data_inicio: new Date().toISOString(),
      });
      setConfirmados(prev => new Set(prev).add(key));
    } catch {
      setErro("Erro ao adicionar ao CRM.");
    } finally {
      setAdicionando(null);
    }
  }

  function abrirMaps(r: Resultado) {
    const url = r.maps_url
      || (r.lat && r.lon ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.nome + " " + r.endereco)}`);
    window.open(url, "_blank");
  }

  function reiniciar() {
    setEtapa("cidade");
    setCidadeInput("");
    setCidadeSelecionada("");
    setBairroSelecionado("");
    setBairroCustom("");
    setSegmento("");
    setResultados([]);
    setErro("");
    setConfirmados(new Set());
  }

  const bairros = getBairros(cidadeSelecionada);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]/10">
          <Target className="h-5 w-5 text-[#1a6b2f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Hunter</h1>
          <p className="text-sm text-gray-500">Encontre clientes no Google Maps e adicione ao CRM</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
          Google Maps via Apify
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">

        {/* Breadcrumb de progresso */}
        {etapa !== "cidade" && (
          <div className="flex items-center gap-2 mb-6 text-sm">
            {[
              { key: "cidade",   label: cidadeSelecionada || "Cidade" },
              { key: "bairro",   label: bairroSelecionado || "Bairro" },
              { key: "segmento", label: segmento || "Segmento" },
            ].map((item, i) => {
              const ordem = ["cidade", "bairro", "segmento", "resultados"];
              const idxItem  = ordem.indexOf(item.key);
              const idxAtual = ordem.indexOf(etapa);
              const concluido = idxAtual > idxItem;
              return (
                <span key={item.key} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
                  <span
                    className={cn("font-medium transition-colors",
                      concluido ? "text-[#1a6b2f] cursor-pointer hover:underline" : "text-gray-900"
                    )}
                    onClick={() => {
                      if (!concluido) return;
                      if (item.key === "cidade") reiniciar();
                      else if (item.key === "bairro") { setEtapa("bairro"); setResultados([]); }
                      else if (item.key === "segmento") { setEtapa("segmento"); setResultados([]); }
                    }}
                  >{item.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* ETAPA 1 — Cidade */}
        {etapa === "cidade" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-semibold text-gray-700 mb-1">Em qual cidade você quer prospectar?</p>
            <p className="text-xs text-gray-400 mb-4">Os dados vêm diretamente do Google Maps</p>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                  placeholder="Ex: Rio de Janeiro, Balneário Camboriú..."
                  value={cidadeInput}
                  onChange={e => setCidadeInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmarCidade()}
                  autoFocus
                />
              </div>
              <button
                onClick={confirmarCidade}
                disabled={!cidadeInput.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Empty state ilustrativo */}
            <div className="mt-8 flex flex-col items-center justify-center py-8 text-gray-300">
              <Target className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-400">Dados reais do Google Maps</p>
              <p className="text-xs text-gray-300 mt-1">Nome · Telefone · Endereço · Rating · Site</p>
            </div>
          </div>
        )}

        {/* ETAPA 2 — Bairro */}
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
                <input
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                  placeholder="Ou digite outro bairro..."
                  value={bairroCustom}
                  onChange={e => setBairroCustom(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && bairroCustom && selecionarBairro(bairroCustom)}
                />
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

        {/* ETAPA 3 — Segmento */}
        {etapa === "segmento" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-semibold text-gray-700 mb-1">Que tipo de cliente você busca?</p>
            <p className="text-xs text-gray-400 mb-4">
              {bairroSelecionado
                ? `Buscará em ${bairroSelecionado}, ${cidadeSelecionada}`
                : `Buscará em toda a cidade de ${cidadeSelecionada}`}
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
                <input
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                  placeholder="Ou digite outro segmento e pressione Enter..."
                  onKeyDown={e => {
                    const val = (e.target as HTMLInputElement).value;
                    if (e.key === "Enter" && val) buscarResultados(val);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 4 — Carregando */}
        {etapa === "resultados" && carregando && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#1a6b2f]" />
            <p className="text-sm font-medium text-gray-600">Buscando no Google Maps…</p>
            <p className="text-xs text-gray-400 mt-1">
              {segmento}{bairroSelecionado ? ` em ${bairroSelecionado}` : ""}, {cidadeSelecionada}
            </p>
            <p className="text-xs text-gray-300 mt-3">Isso leva entre 30 e 90 segundos</p>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            <X className="h-4 w-4 flex-shrink-0" />{erro}
          </div>
        )}

        {/* Resultados */}
        {!carregando && resultados.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} · {segmento}
                {bairroSelecionado ? ` · ${bairroSelecionado}` : ""} · {cidadeSelecionada}
              </p>
              <button onClick={reiniciar}
                className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
                <ArrowLeft className="h-3 w-3" /> Nova busca
              </button>
            </div>

            {resultados.map((r, i) => {
              const key = r.nome + r.endereco;
              const jaAdicionado   = confirmados.has(key);
              const carregandoEste = adicionando === key;
              return (
                <div key={i} className={cn(
                  "bg-white rounded-xl border shadow-sm p-4 transition-all",
                  jaAdicionado ? "border-green-200 bg-green-50/40" : "border-gray-200 hover:border-gray-300"
                )}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{r.nome}</p>
                        {r.rating && (
                          <div className="flex items-center gap-1 flex-shrink-0 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {r.rating.toFixed(1)}
                            {r.reviews ? <span className="text-gray-400">({r.reviews})</span> : null}
                          </div>
                        )}
                      </div>
                      {r.categoria && <p className="text-[11px] text-gray-400 mt-0.5">{r.categoria}</p>}
                      {r.endereco && (
                        <p className="flex items-start gap-1 text-xs text-gray-500 mt-1.5">
                          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />{r.endereco}
                        </p>
                      )}

                      {/* Contatos em destaque */}
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {r.telefone ? (
                          <a href={`tel:${r.telefone}`}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#1a6b2f] bg-[#1a6b2f]/8 px-2.5 py-1 rounded-full hover:bg-[#1a6b2f]/15 transition-colors">
                            <Phone className="h-3 w-3" />{r.telefone}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-300 px-2.5 py-1 rounded-full border border-dashed border-gray-200">
                            <Phone className="h-3 w-3" />Sem telefone
                          </span>
                        )}
                        {r.email && (
                          <a href={`mailto:${r.email}`}
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                            <Mail className="h-3 w-3" />{r.email}
                          </a>
                        )}
                        {r.website && (
                          <a href={r.website} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full hover:bg-gray-100 transition-colors border border-gray-200">
                            <ExternalLink className="h-3 w-3" />Site
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                      <button onClick={() => abrirMaps(r)} title="Ver no Google Maps"
                        className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      {jaAdicionado ? (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> Adicionado
                        </div>
                      ) : (
                        <button onClick={() => adicionarAoCRM(r)} disabled={carregandoEste}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a6b2f] text-white text-xs font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                          {carregandoEste
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Plus className="h-3.5 w-3.5" />}
                          Add ao CRM
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state inicial */}
        {etapa === "cidade" && !carregando && resultados.length === 0 && !erro && (
          <></>
        )}
      </div>
    </div>
  );
}
