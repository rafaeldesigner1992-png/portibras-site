import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, MapPin, Phone, Mail, Building2, Plus, Loader2, CheckCircle, X, ExternalLink, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/hunter")({
  component: HunterPage,
});

interface Resultado {
  nome: string;
  endereco: string;
  telefone?: string;
  email?: string;
  cnpj?: string;
  cidade?: string;
  lat?: number;
  lon?: number;
  fonte: "osm" | "cnpj";
  adicionado?: boolean;
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
  situacao_cadastral?: number;
}

function formatarTelefone(ddd: string, tel: string): string {
  const t = tel.replace(/\D/g, "");
  return `(${ddd}) ${t}`;
}

function limparCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export default function HunterPage() {
  const [modo, setModo] = useState<"busca" | "cnpj">("busca");
  const [busca, setBusca] = useState("");
  const [cidade, setCidade] = useState("Rio de Janeiro");
  const [cnpjInput, setCnpjInput] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());

  async function buscarOSM() {
    if (!busca.trim()) return;
    setCarregando(true);
    setErro("");
    setResultados([]);
    try {
      const query = encodeURIComponent(`${busca} ${cidade} Brasil`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=20&addressdetails=1&extratags=1&accept-language=pt-BR`;
      const res = await fetch(url, { headers: { "User-Agent": "Portibras-Hunter/1.0" } });
      const data = await res.json();

      const lista: Resultado[] = data
        .filter((r: any) => r.display_name)
        .map((r: any) => {
          const addr = r.address ?? {};
          const nome = r.namedetails?.name || r.name || r.display_name.split(",")[0];
          const partes = [
            r.extratags?.["addr:street"] || addr.road,
            r.extratags?.["addr:housenumber"] || addr.house_number,
            addr.suburb || addr.neighbourhood || addr.quarter,
            addr.city || addr.town || addr.municipality,
            addr.state,
          ].filter(Boolean);
          return {
            nome,
            endereco: partes.join(", ") || r.display_name,
            telefone: r.extratags?.phone || r.extratags?.["contact:phone"] || undefined,
            email: r.extratags?.email || r.extratags?.["contact:email"] || undefined,
            cidade: addr.city || addr.town || cidade,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            fonte: "osm" as const,
          };
        });

      if (lista.length === 0) setErro("Nenhum resultado encontrado. Tente termos mais específicos.");
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
      const tel = d.ddd_telefone_1
        ? formatarTelefone(d.ddd_telefone_1.slice(0, 2), d.ddd_telefone_1.slice(2))
        : undefined;

      setResultados([{
        nome: nomeEmpresa,
        endereco: partes.join(", "),
        telefone: tel,
        email: d.email || undefined,
        cnpj: cnpj,
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
      const payload = {
        nome: r.nome,
        empresa: r.nome,
        cnpj: r.cnpj?.replace(/\D/g, "") ?? "",
        telefone: r.telefone ?? "",
        email: r.email ?? "",
        etapa: "prospecto" as const,
        valor_estimado: null,
        tipo_negocio: null,
        observacoes: `Lead captado via Hunter — ${r.fonte === "osm" ? "OpenStreetMap" : "Receita Federal"}.`,
        prazo: null,
        proximo_contato: null,
        endereco_fiscal: r.endereco,
        endereco_atendimento: r.endereco,
        data_inicio: new Date().toISOString(),
      };
      const { error } = await supabase.from("crm_leads").insert(payload);
      if (error) throw error;
      setConfirmados(prev => new Set(prev).add(key));
    } catch {
      setErro("Erro ao adicionar ao CRM. Tente novamente.");
    } finally {
      setAdicionando(null);
    }
  }

  function abrirMaps(r: Resultado) {
    const q = r.lat && r.lon
      ? `${r.lat},${r.lon}`
      : encodeURIComponent(`${r.nome} ${r.endereco}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]/10">
          <Target className="h-5 w-5 text-[#1a6b2f]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hunter</h1>
          <p className="text-sm text-gray-500">Encontre clientes e adicione direto ao CRM</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">

        {/* Tabs de modo */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <button onClick={() => { setModo("busca"); setResultados([]); setErro(""); }}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              modo === "busca" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            🔍 Busca por Segmento
          </button>
          <button onClick={() => { setModo("cnpj"); setResultados([]); setErro(""); }}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              modo === "cnpj" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            🏢 Busca por CNPJ
          </button>
        </div>

        {/* Formulário de busca */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          {modo === "busca" ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Buscar por tipo de negócio</p>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                    placeholder='Ex: condomínio, shopping, hospital...'
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && buscarOSM()}
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f] w-48"
                    placeholder="Cidade"
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && buscarOSM()}
                  />
                </div>
                <button onClick={buscarOSM} disabled={carregando || !busca.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </button>
              </div>
              <p className="text-[11px] text-gray-400">Fonte: OpenStreetMap · dados públicos e gratuitos</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Buscar por CNPJ</p>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
                    placeholder="00.000.000/0001-00"
                    value={cnpjInput}
                    onChange={e => setCnpjInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && buscarCNPJ()}
                  />
                </div>
                <button onClick={buscarCNPJ} disabled={carregando || cnpjInput.replace(/\D/g, "").length !== 14}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1a6b2f] text-white rounded-lg text-sm font-medium hover:bg-[#155a27] disabled:opacity-50 transition-colors">
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Consultar
                </button>
              </div>
              <p className="text-[11px] text-gray-400">Fonte: Receita Federal via BrasilAPI · gratuito</p>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            <X className="h-4 w-4 flex-shrink-0" />{erro}
          </div>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}
            </p>
            {resultados.map((r, i) => {
              const key = r.nome + r.endereco;
              const jaAdicionado = confirmados.has(key);
              const carregandoEste = adicionando === key;
              return (
                <div key={i} className={cn(
                  "bg-white rounded-xl border shadow-sm p-4 flex items-start gap-4 transition-all",
                  jaAdicionado ? "border-green-200 bg-green-50/40" : "border-gray-200 hover:border-gray-300"
                )}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{r.nome}</p>
                    {r.cnpj && <p className="text-[11px] text-gray-400 mt-0.5">{r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {r.endereco && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3 flex-shrink-0" />{r.endereco}
                        </span>
                      )}
                      {r.telefone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3 flex-shrink-0" />{r.telefone}
                        </span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="h-3 w-3 flex-shrink-0" />{r.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => abrirMaps(r)}
                      title="Ver no Google Maps"
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
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!carregando && resultados.length === 0 && !erro && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma busca realizada ainda</p>
            <p className="text-xs mt-1">Digite um segmento ou CNPJ para encontrar potenciais clientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
