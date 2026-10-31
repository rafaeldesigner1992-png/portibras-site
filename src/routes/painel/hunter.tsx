import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, MapPin, Phone, Mail, Building2, Plus, Loader2, CheckCircle, X, ExternalLink, Target, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/hunter")({
  component: HunterPage,
});

interface Resultado {
  nome: string;
  endereco: string;
  bairro?: string;
  telefone?: string;
  email?: string;
  cnpj?: string;
  cidade?: string;
  lat?: number;
  lon?: number;
  fonte: "osm" | "cnpj";
}

interface CnpjData {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
  cnpj?: string;
}

function limparCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

// Busca bairros via OSM/Nominatim
async function fetchBairros(cidade: string): Promise<string[]> {
  const query = encodeURIComponent(`${cidade}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1&accept-language=pt-BR`;
  const res = await fetch(url, { headers: { "User-Agent": "Portibras-Hunter/1.0" } });
  const data = await res.json();
  if (!data[0]) return [];

  // Busca bairros populares conhecidos por cidade
  const bairrosPorCidade: Record<string, string[]> = {
    "rio de janeiro": ["Flamengo","Botafogo","Copacabana","Ipanema","Leblon","Tijuca","Barra da Tijuca","Méier","Madureira","Campo Grande","Santa Cruz","Recreio","Jacarepaguá","Grajaú","Laranjeiras","Glória","Catete","Lapa","Centro","Ilha do Governador"],
    "são paulo": ["Moema","Itaim Bibi","Pinheiros","Jardins","Vila Mariana","Lapa","Santana","Santo André","Tatuapé","Brooklin","Vila Olímpia","Perdizes","Vila Madalena","Higienópolis","Centro","Morumbi","Campo Belo","Saúde","Ipiranga","Tucuruvi"],
    "belo horizonte": ["Savassi","Lourdes","Funcionários","Buritis","Pampulha","Barreiro","Venda Nova","Contagem","Centro","Anchieta","Mangabeiras","Floresta","Santa Efigênia","Gutierrez"],
    "curitiba": ["Batel","Água Verde","Bigorrilho","Juvevê","Boa Vista","Portão","Cajuru","Xaxim","Centro","Bacacheri","Cabral","Mercês","Rebouças"],
    "salvador": ["Barra","Pituba","Ondina","Rio Vermelho","Itaigara","Caminho das Árvores","Paralela","Brotas","Liberdade","Itapuã","Piatã","Stella Maris"],
    "default": ["Centro","Jardim","Vila Nova","Santa Maria","São José","Boa Vista","Nova Esperança","Bairro Alto","Jardim América","Vila Progresso"],
  };

  const cidadeLower = cidade.toLowerCase();
  const chave = Object.keys(bairrosPorCidade).find(k => cidadeLower.includes(k)) ?? "default";
  return bairrosPorCidade[chave];
}

export default function HunterPage() {
  const [modo, setModo] = useState<"busca" | "cnpj">("busca");

  // Etapas do fluxo de busca: cidade → bairro → segmento → resultados
  const [etapa, setEtapa] = useState<"cidade" | "bairro" | "segmento" | "resultados">("cidade");
  const [cidadeInput, setCidadeInput] = useState("");
  const [cidadeSelecionada, setCidadeSelecionada] = useState("");
  const [bairros, setBairros] = useState<string[]>([]);
  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const [segmento, setSegmento] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());

  // CNPJ
  const [cnpjInput, setCnpjInput] = useState("");

  const SEGMENTOS = ["Condomínio Residencial","Condomínio Comercial","Shopping Center","Hospital","Escola / Faculdade","Hotel","Supermercado","Indústria / Galpão","Academia","Banco / Agência","Outro..."];

  async function confirmarCidade() {
    if (!cidadeInput.trim()) return;
    setCarregando(true);
    setErro("");
    try {
      const lista = await fetchBairros(cidadeInput);
      setCidadeSelecionada(cidadeInput);
      setBairros(lista);
      setEtapa("bairro");
    } catch {
      setErro("Erro ao carregar bairros. Continue mesmo assim.");
      setCidadeSelecionada(cidadeInput);
      setEtapa("bairro");
    } finally {
      setCarregando(false);
    }
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
      const termo = `${seg} ${bairroSelecionado} ${cidadeSelecionada} Brasil`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(termo)}&format=json&limit=20&addressdetails=1&extratags=1&accept-language=pt-BR`;
      const res = await fetch(url, { headers: { "User-Agent": "Portibras-Hunter/1.0" } });
      const data = await res.json();

      const lista: Resultado[] = data
        .filter((r: any) => r.display_name)
        .map((r: any) => {
          const addr = r.address ?? {};
          const nome = r.namedetails?.name || r.name || r.display_name.split(",")[0];
          const partes = [
            addr.road || r.extratags?.["addr:street"],
            addr.house_number || r.extratags?.["addr:housenumber"],
          ].filter(Boolean);
          const bairroAddr = addr.suburb || addr.neighbourhood || addr.quarter || bairroSelecionado;
          const cidadeAddr = addr.city || addr.town || cidadeSelecionada;
          return {
            nome,
            endereco: [...partes, bairroAddr, cidadeAddr].filter(Boolean).join(", "),
            bairro: bairroAddr,
            telefone: r.extratags?.phone || r.extratags?.["contact:phone"] || undefined,
            email: r.extratags?.email || r.extratags?.["contact:email"] || undefined,
            cidade: cidadeAddr,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            fonte: "osm" as const,
          };
        });

      if (lista.length === 0) setErro("Nenhum resultado encontrado. Tente outro segmento ou bairro.");
      setResultados(lista);
    } catch {
      setErro("Erro ao buscar. Verifique sua conexão.");
    } finally {
      setCarregando(false);
    }
  }

  async function buscarCNPJ() {
    const cnpj = limparCnpj(cnpjInput);
    if (cnpj.length !== 14) { setErro("CNPJ inválido — deve ter 14 dígitos."); return; }
    setCarregando(true);
    setErro("");
    setResultados([]);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const d: CnpjData = await res.json();
      const nomeEmpresa = d.nome_fantasia?.trim() || d.razao_social || "Empresa";
      const partes = [d.logradouro, d.numero, d.bairro, d.municipio, d.uf].filter(Boolean);
      const ddd = d.ddd_telefone_1?.slice(0, 2) ?? "";
      const num = d.ddd_telefone_1?.slice(2) ?? "";
      setResultados([{
        nome: nomeEmpresa,
        endereco: partes.join(", "),
        bairro: d.bairro,
        telefone: ddd && num ? `(${ddd}) ${num}` : undefined,
        email: d.email || undefined,
        cnpj,
        cidade: d.municipio || "",
        fonte: "cnpj",
      }]);
    } catch {
      setErro("CNPJ não encontrado na Receita Federal.");
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
        cnpj: r.cnpj?.replace(/\D/g, "") ?? "",
        telefone: r.telefone ?? "",
        email: r.email ?? "",
        etapa: "prospecto",
        valor_estimado: null,
        tipo_negocio: null,
        observacoes: `Lead captado via Hunter — ${r.fonte === "osm" ? "OpenStreetMap" : "Receita Federal"}.${r.bairro ? ` Bairro: ${r.bairro}.` : ""}`,
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
    const q = r.lat && r.lon ? `${r.lat},${r.lon}` : encodeURIComponent(`${r.nome} ${r.endereco}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  function reiniciar() {
    setEtapa("cidade");
    setCidadeInput("");
    setCidadeSelecionada("");
    setBairroSelecionado("");
    setSegmento("");
    setResultados([]);
    setErro("");
    setConfirmados(new Set());
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]/10">
          <Target className="h-5 w-5 text-[#1a6b2f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Hunter</h1>
          <p className="text-sm text-gray-500">Encontre clientes e adicione direto ao CRM</p>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => { setModo("busca"); reiniciar(); }}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", modo === "busca" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            🔍 Busca por Segmento
          </button>
          <button onClick={() => { setModo("cnpj"); setErro(""); setResultados([]); }}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", modo === "cnpj" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            🏢 Busca por CNPJ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">

        {modo === "cnpj" ? (
          /* ── MODO CNPJ ── */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Buscar por CNPJ</p>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                  placeholder="00.000.000/0001-00" value={cnpjInput}
                  onChange={e => setCnpjInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && buscarCNPJ()} />
              </div>
              <button onClick={buscarCNPJ} disabled={carregando || cnpjInput.replace(/\D/g, "").length !== 14}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Fonte: Receita Federal via BrasilAPI · gratuito</p>
          </div>
        ) : (
          /* ── MODO BUSCA POR SEGMENTO ── */
          <>
            {/* Breadcrumb de progresso */}
            <div className="flex items-center gap-2 mb-6 text-sm">
              {[
                { key: "cidade", label: cidadeSelecionada || "Cidade" },
                { key: "bairro", label: bairroSelecionado || "Bairro" },
                { key: "segmento", label: segmento || "Segmento" },
              ].map((item, i) => {
                const etapas = ["cidade", "bairro", "segmento", "resultados"];
                const idx = etapas.indexOf(item.key);
                const atual = etapas.indexOf(etapa);
                const concluido = atual > idx;
                const corrente = etapa === item.key;
                return (
                  <span key={item.key} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
                    <span className={cn("font-medium",
                      concluido ? "text-[#1a6b2f] cursor-pointer hover:underline" : corrente ? "text-gray-900" : "text-gray-300"
                    )}
                      onClick={() => {
                        if (concluido) {
                          if (item.key === "cidade") reiniciar();
                          else if (item.key === "bairro") { setEtapa("bairro"); setResultados([]); }
                          else if (item.key === "segmento") { setEtapa("segmento"); setResultados([]); }
                        }
                      }}>
                      {item.label}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* ETAPA 1 — Cidade */}
            {etapa === "cidade" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Em qual cidade você quer prospectar?</p>
                <p className="text-xs text-gray-400 mb-4">Digite o nome da cidade para começar</p>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ex: Rio de Janeiro, São Paulo..."
                      value={cidadeInput} onChange={e => setCidadeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && confirmarCidade()} autoFocus />
                  </div>
                  <button onClick={confirmarCidade} disabled={carregando || !cidadeInput.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Próximo <ChevronRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 2 — Bairro */}
            {etapa === "bairro" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Qual bairro em <span className="text-[#1a6b2f]">{cidadeSelecionada}</span>?</p>
                <p className="text-xs text-gray-400 mb-4">Selecione ou digite um bairro específico</p>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {bairros.map(b => (
                    <button key={b} onClick={() => selecionarBairro(b)}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-[#1a6b2f] hover:text-[#1a6b2f] hover:bg-[#1a6b2f]/5 transition-colors">
                      {b}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ou digite outro bairro..."
                      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).value && selecionarBairro((e.target as HTMLInputElement).value)} />
                  </div>
                  <button onClick={() => selecionarBairro("")}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Todos os bairros
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3 — Segmento */}
            {etapa === "segmento" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Que tipo de cliente você busca?</p>
                <p className="text-xs text-gray-400 mb-4">Selecione o segmento ou digite o que preferir</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {SEGMENTOS.slice(0, -1).map(s => (
                    <button key={s} onClick={() => buscarResultados(s)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-[#1a6b2f] hover:text-[#1a6b2f] hover:bg-[#1a6b2f]/5 transition-colors text-left">
                      <Building2 className="h-4 w-4 flex-shrink-0 opacity-40" />{s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                      placeholder="Ou digite outro segmento..."
                      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).value && buscarResultados((e.target as HTMLInputElement).value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 4 — Resultados */}
            {etapa === "resultados" && carregando && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#1a6b2f]" />
                <p className="text-sm">Buscando {segmento} em {bairroSelecionado || cidadeSelecionada}…</p>
              </div>
            )}
          </>
        )}

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            <X className="h-4 w-4 flex-shrink-0" />{erro}
          </div>
        )}

        {/* Lista de resultados */}
        {resultados.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} · {segmento || "CNPJ"}{bairroSelecionado ? ` · ${bairroSelecionado}` : ""}{cidadeSelecionada ? ` · ${cidadeSelecionada}` : ""}
              </p>
              {modo === "busca" && (
                <button onClick={reiniciar} className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
                  <ArrowLeft className="h-3 w-3" /> Nova busca
                </button>
              )}
            </div>
            {resultados.map((r, i) => {
              const key = r.nome + r.endereco;
              const jaAdicionado = confirmados.has(key);
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
                      <p className="font-semibold text-gray-900 text-sm">{r.nome}</p>
                      {r.cnpj && <p className="text-[11px] text-gray-400">{r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</p>}
                      {r.endereco && (
                        <p className="flex items-start gap-1 text-xs text-gray-500 mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />{r.endereco}
                        </p>
                      )}
                      {/* Dados de contato em destaque */}
                      <div className="flex flex-wrap gap-3 mt-2">
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                          {carregandoEste ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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

        {/* Empty state */}
        {!carregando && resultados.length === 0 && !erro && modo === "busca" && etapa === "cidade" && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Selecione uma cidade para começar</p>
            <p className="text-xs mt-1">Depois escolha o bairro e o segmento que quer prospectar</p>
          </div>
        )}
      </div>
    </div>
  );
}
