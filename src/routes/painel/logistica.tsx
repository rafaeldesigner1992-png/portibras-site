import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, Plus, AlertTriangle, X, ShoppingCart,
  ExternalLink, Clock, Pencil, Trash2, AlertCircle,
  Wrench, CalendarDays as CalendarIcon, Ticket, ChevronRight, MapPin, User, HardHat, Check,
  ClipboardList, ShoppingBag, ChevronDown, ChevronUp, Loader2, BarChart2, FileCheck,
  ClipboardCheck, Upload, FileText, Phone, Mail, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/logistica")({
  component: LogisticaPage,
});

// ─── Estoque ──────────────────────────────────────────────────────────────────
interface ItemEstoque {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  localizacao: string;
}

// ─── Profissionais Terceirizados ──────────────────────────────────────────────
interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  tipo_cobranca: "diaria" | "por_unidade";  // diária = × diasCampo; por_unidade = × qtd portas (ex: pintor)
  custo_diario: number;     // usado quando tipo_cobranca = "diaria"
  custo_unitario: number;   // usado quando tipo_cobranca = "por_unidade"
  ativo: boolean;
}

// ─── Suprimentos ──────────────────────────────────────────────────────────────
interface Suprimento {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  unidade: string;
  custo_unitario: number;
  tempo_instalacao_min: number;  // minutos por unidade para instalação
  profissionais_ids: string[];   // profissionais necessários para instalar
  link_compra: string;
  atualizado_em: string;
}

const DIAS_ALERTA = 15;

function diasDesdeAtualizacao(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Ticket Técnico ───────────────────────────────────────────────────────────
interface TicketTecnico {
  id: string;
  titulo: string;
  cliente: string;
  endereco: string;
  tecnico: string;
  status: string;
  prioridade: string;
  agendado_para: string;
  criado_em: string;
}

const SISTEMAS_EXTERNOS = [
  {
    nome: "Aplicativo de Serviços",
    descricao: "Gestão de ordens de serviço em campo",
    url: "https://www.appsheet.com/start/1fd097c9-0986-4133-bdc5-e381bcd4bf37",
    cor: "bg-blue-50 border-blue-200 text-blue-700",
    icone: Wrench,
  },
  {
    nome: "Aplicativo de Vistorias",
    descricao: "Laudos e vistorias técnicas",
    url: "https://www.appsheet.com/start/755184c3-0072-4536-9f99-420a62a919c5",
    cor: "bg-purple-50 border-purple-200 text-purple-700",
    icone: CalendarIcon,
  },
];

const STATUS_CORES: Record<string, string> = {
  aberto:       "bg-blue-100 text-blue-700",
  em_andamento: "bg-yellow-100 text-yellow-700",
  aguardando:   "bg-orange-100 text-orange-700",
  concluido:    "bg-green-100 text-green-700",
  cancelado:    "bg-gray-100 text-gray-500",
};

const PRIORIDADE_CORES: Record<string, string> = {
  baixa:  "bg-gray-100 text-gray-500",
  normal: "bg-blue-100 text-blue-600",
  alta:   "bg-orange-100 text-orange-700",
  urgente:"bg-red-100 text-red-700",
};

// ─── Pedidos Fechados (do CRM) ────────────────────────────────────────────────
interface PedidoFechado {
  id: string;
  lead_id: string;
  tipo: "orcamento" | "manutencao";
  nome_arquivo: string;
  status: string;
  conteudo: { portas?: number; parcela?: number } | null;
  criado_em: string;
  atualizado_em: string | null;
  enviado_logistica: boolean;
  lead?: { nome_empresa: string; contato: string };
}

// ─── Atendimentos ─────────────────────────────────────────────────────────────
interface Atendimento {
  id: string;
  cliente_id: string | null;
  proposta_id: string | null;
  titulo: string;
  classificacao: "Serviço" | "Vistoria" | "Retorno" | "Operacional" | "Terceirizados";
  status: "Programado" | "Em andamento" | "Concluído" | "Cancelado";
  data_agendada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  responsaveis: string[];
  endereco: string | null;
  atividade: string | null;
  descricao: string | null;
  agendado_com_cliente: boolean;
  em_sistema: boolean;
  relatorio_campo: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface Material {
  id: string;
  atendimento_id: string;
  descricao: string;
  codigo: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  fornecedor: string | null;
  link_compra: string | null;
  status: "Solicitado" | "Comprado" | "Chegou no escritório" | "Enviado ao campo" | "Instalado";
  data_solicitacao: string | null;
  data_compra: string | null;
  data_chegada: string | null;
  data_envio: string | null;
  observacoes: string | null;
}

interface Vistoria {
  id: string;
  lead_id: string | null;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  status: "pendente" | "agendada" | "em_andamento" | "concluida" | "cancelada";
  data_agendada: string | null;
  tecnico_nome: string | null;
  observacoes: string | null;
  dts_url: string | null;
  dts_nome: string | null;
  dts_resumo_ia: string | null;
  dts_materiais: any | null;
  enviado_por: string | null;
  enviado_em: string;
  concluida_em: string | null;
  criado_em: string;
}

const STATUS_VISTORIA_COR: Record<string, string> = {
  "pendente":      "bg-orange-50 text-orange-700 border-orange-200",
  "agendada":      "bg-blue-50 text-blue-700 border-blue-200",
  "em_andamento":  "bg-yellow-50 text-yellow-700 border-yellow-200",
  "concluida":     "bg-green-50 text-green-700 border-green-200",
  "cancelada":     "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_VISTORIA_LABEL: Record<string, string> = {
  "pendente":     "Pendente",
  "agendada":     "Agendada",
  "em_andamento": "Em andamento",
  "concluida":    "Concluída",
  "cancelada":    "Cancelada",
};

const STATUS_ATEND_COR: Record<string, string> = {
  "Programado":   "bg-blue-50 text-blue-700 border-blue-200",
  "Em andamento": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Concluído":    "bg-green-50 text-green-700 border-green-200",
  "Cancelado":    "bg-gray-100 text-gray-500 border-gray-200",
};

const CLASS_COR: Record<string, string> = {
  "Serviço":       "bg-emerald-50 text-emerald-700",
  "Vistoria":      "bg-purple-50 text-purple-700",
  "Retorno":       "bg-sky-50 text-sky-700",
  "Operacional":   "bg-orange-50 text-orange-700",
  "Terceirizados": "bg-pink-50 text-pink-700",
};

const STATUS_MAT_COR: Record<string, string> = {
  "Solicitado":           "bg-gray-100 text-gray-500",
  "Comprado":             "bg-blue-50 text-blue-700",
  "Chegou no escritório": "bg-yellow-50 text-yellow-700",
  "Enviado ao campo":     "bg-purple-50 text-purple-700",
  "Instalado":            "bg-green-50 text-green-700",
};

const RESPONSAVEIS_OPCOES = ["Rafael Nunes", "Matheus Alves", "Dinho", "Marco", "Ajudante"];

const EMPTY_ATEND = {
  titulo: "", classificacao: "Serviço" as const, status: "Programado" as const,
  data_agendada: "", hora_inicio: "", hora_fim: "",
  responsaveis: [] as string[], endereco: "", atividade: "", descricao: "",
  agendado_com_cliente: false, em_sistema: false,
};

const EMPTY_MAT = {
  descricao: "", codigo: "", quantidade: 1, unidade: "un",
  valor_unitario: null as number | null, fornecedor: "", link_compra: "",
  status: "Solicitado" as const, observacoes: "",
};

// ─── Cores por responsável ────────────────────────────────────────────────────
const RESP_CORES: Record<string, { bg: string; text: string; border: string }> = {
  "Rafael Nunes": { bg: "bg-blue-100",    text: "text-blue-800",   border: "border-blue-300" },
  "Matheus Alves":{ bg: "bg-purple-100",  text: "text-purple-800", border: "border-purple-300" },
  "Dinho":        { bg: "bg-orange-100",  text: "text-orange-800", border: "border-orange-300" },
  "Marco":        { bg: "bg-pink-100",    text: "text-pink-800",   border: "border-pink-300" },
  "Ajudante":     { bg: "bg-gray-100",    text: "text-gray-700",   border: "border-gray-300" },
};
const RESP_COR_DEFAULT = { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" };

function corParaResp(r: string) {
  return RESP_CORES[r] ?? RESP_COR_DEFAULT;
}

function GanttView({ atendimentos, carregando }: { atendimentos: Atendimento[]; carregando: boolean }) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Calcular janela de 6 semanas a partir de segunda-feira da semana atual
  const inicioJanela = useMemo(() => {
    const d = new Date(hoje);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=seg
    d.setDate(d.getDate() - dow);
    return d;
  }, []);

  const SEMANAS = 6;
  const DIAS_TOTAL = SEMANAS * 7;

  const diasJanela = useMemo(() => {
    return Array.from({ length: DIAS_TOTAL }, (_, i) => {
      const d = new Date(inicioJanela);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [inicioJanela]);

  // Semanas agrupadas
  const semanas = useMemo(() => {
    const result = [];
    for (let s = 0; s < SEMANAS; s++) {
      const inicio = new Date(inicioJanela);
      inicio.setDate(inicio.getDate() + s * 7);
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicio);
        d.setDate(d.getDate() + i);
        return d;
      });
      result.push({ inicio, dias });
    }
    return result;
  }, [inicioJanela]);

  // Atendimentos com data na janela
  const atendComData = useMemo(() => {
    return atendimentos
      .filter(a => a.data_agendada && a.status !== "Cancelado")
      .map(a => {
        const d = new Date(a.data_agendada! + "T00:00:00");
        return { ...a, dataObj: d };
      })
      .filter(a => {
        const fim = new Date(inicioJanela);
        fim.setDate(fim.getDate() + DIAS_TOTAL);
        return a.dataObj >= inicioJanela && a.dataObj < fim;
      })
      .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime());
  }, [atendimentos, inicioJanela]);

  // Atendimentos sem data
  const semData = atendimentos.filter(a => !a.data_agendada && a.status !== "Cancelado");

  const nomesDia = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  function idxDia(data: Date): number {
    const ms = data.getTime() - inicioJanela.getTime();
    return Math.floor(ms / 86400000);
  }

  function ehHoje(d: Date) {
    return d.toDateString() === hoje.toDateString();
  }

  function ehFds(d: Date) {
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando atendimentos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legenda responsáveis */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Responsáveis:</span>
        {Object.entries(RESP_CORES).map(([nome, cor]) => (
          <span key={nome} className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border", cor.bg, cor.text, cor.border)}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60 inline-block" />
            {nome}
          </span>
        ))}
      </div>

      {/* Grade Gantt */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header semanas + dias */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${DIAS_TOTAL * 44 + 160}px` }}>
            {/* Linha de semanas */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="w-40 shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Atendimento
              </div>
              {semanas.map((s, i) => (
                <div key={i} className="flex border-r border-gray-200 last:border-r-0"
                  style={{ width: `${7 * 44}px` }}>
                  <div className="w-full px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Sem. {s.inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
            {/* Linha de dias */}
            <div className="flex border-b border-gray-200 bg-gray-50/60">
              <div className="w-40 shrink-0 border-r border-gray-200" />
              {diasJanela.map((d, i) => (
                <div key={i}
                  style={{ width: "44px" }}
                  className={cn(
                    "shrink-0 border-r border-gray-100 last:border-r-0 text-center py-1",
                    ehHoje(d) ? "bg-[#1a6b2f]/10" : "",
                    ehFds(d) ? "bg-gray-100/60" : "",
                  )}>
                  <div className={cn("text-[9px] font-medium", ehHoje(d) ? "text-[#1a6b2f] font-bold" : "text-gray-400")}>
                    {nomesDia[(d.getDay() + 6) % 7]}
                  </div>
                  <div className={cn("text-[10px] font-semibold leading-none", ehHoje(d) ? "text-[#1a6b2f]" : "text-gray-600")}>
                    {d.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Linhas de atendimentos */}
            {atendComData.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Nenhum atendimento agendado nas próximas 6 semanas
              </div>
            ) : (
              atendComData.map(a => {
                const idx = idxDia(a.dataObj);
                const primResp = a.responsaveis?.[0] ?? "";
                const cor = corParaResp(primResp);
                return (
                  <div key={a.id} className="flex items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40">
                    {/* Label */}
                    <div className="w-40 shrink-0 border-r border-gray-200 px-3 py-2">
                      <p className="text-xs font-medium text-gray-800 truncate leading-tight">{a.titulo}</p>
                      {a.responsaveis?.length > 0 && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{a.responsaveis.join(", ")}</p>
                      )}
                    </div>
                    {/* Grade */}
                    <div className="relative flex flex-1" style={{ height: "44px" }}>
                      {diasJanela.map((d, di) => (
                        <div key={di}
                          style={{ width: "44px" }}
                          className={cn(
                            "shrink-0 border-r border-gray-100 last:border-r-0 h-full",
                            ehHoje(d) ? "bg-[#1a6b2f]/5" : "",
                            ehFds(d) ? "bg-gray-50" : "",
                          )}
                        />
                      ))}
                      {/* Barra do atendimento */}
                      {idx >= 0 && idx < DIAS_TOTAL && (
                        <div
                          className={cn(
                            "absolute top-2.5 rounded-lg px-2 flex items-center gap-1 border text-[10px] font-semibold truncate",
                            cor.bg, cor.text, cor.border,
                          )}
                          style={{
                            left: `${idx * 44 + 2}px`,
                            width: "40px",
                            height: "22px",
                          }}
                          title={`${a.titulo} — ${a.data_agendada}`}
                        >
                          <span className={cn(
                            "rounded-full px-1 py-0 text-[9px] font-bold shrink-0",
                            a.status === "Concluído" ? "bg-green-200 text-green-800" :
                            a.status === "Em andamento" ? "bg-yellow-200 text-yellow-800" :
                            "bg-white/60 text-gray-600"
                          )}>
                            {a.status === "Concluído" ? "✓" : a.status === "Em andamento" ? "▶" : "○"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Atendimentos sem data */}
      {semData.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            Sem data agendada ({semData.length})
          </h3>
          <div className="space-y-2">
            {semData.map(a => {
              const primResp = a.responsaveis?.[0] ?? "";
              const cor = corParaResp(primResp);
              return (
                <div key={a.id} className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  cor.bg, cor.border
                )}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.titulo}</p>
                    {a.responsaveis?.length > 0 && (
                      <p className="text-xs opacity-70">{a.responsaveis.join(", ")}</p>
                    )}
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0",
                    STATUS_ATEND_COR[a.status]
                  )}>
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo por responsável */}
      {atendimentos.filter(a => a.status !== "Cancelado").length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Carga por responsável</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(RESP_CORES).map(resp => {
              const total = atendimentos.filter(
                a => a.responsaveis?.includes(resp) && a.status !== "Cancelado"
              );
              if (total.length === 0) return null;
              const concluidos = total.filter(a => a.status === "Concluído").length;
              const cor = corParaResp(resp);
              return (
                <div key={resp} className={cn("rounded-xl border p-4", cor.bg, cor.border)}>
                  <p className={cn("text-sm font-semibold", cor.text)}>{resp}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{total.length}</p>
                  <p className="text-xs text-gray-500">{concluidos} concluído{concluidos !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LogisticaPage() {
  const [aba, setAba] = useState<"estoque" | "suprimentos" | "equipe" | "tecnico" | "atendimentos" | "compras" | "gantt" | "vistorias">("atendimentos");

  // ── Estoque ────────────────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(true);
  const [modalEstoque, setModalEstoque] = useState(false);
  const [selEstoque, setSelEstoque] = useState<ItemEstoque | null>(null);
  const [formEstoque, setFormEstoque] = useState<Partial<ItemEstoque>>({
    nome: "", codigo: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, unidade: "un", localizacao: "",
  });

  // ── Pedidos Fechados ───────────────────────────────────────────────────────
  const [pedidosFechados, setPedidosFechados] = useState<PedidoFechado[]>([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);

  // ── Atendimentos ──────────────────────────────────────────────────────────
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregandoAtend, setCarregandoAtend] = useState(false);
  const [modalAtend, setModalAtend] = useState(false);
  const [selAtend, setSelAtend] = useState<Atendimento | null>(null);
  const [formAtend, setFormAtend] = useState<typeof EMPTY_ATEND>({ ...EMPTY_ATEND });
  const [salvandoAtend, setSalvandoAtend] = useState(false);
  const [filtroStatusAtend, setFiltroStatusAtend] = useState<string>("todos");
  const [atendAberto, setAtendAberto] = useState<string | null>(null);

  // ── Vistorias ─────────────────────────────────────────────────────────────
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [carregandoVistorias, setCarregandoVistorias] = useState(false);
  const [vistoriaAberta, setVistoriaAberta] = useState<string | null>(null);
  const [agendandoId, setAgendandoId] = useState<string | null>(null);
  const [dataAgendada, setDataAgendada] = useState("");
  const [tecnicoNome, setTecnicoNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [uploadingDts, setUploadingDts] = useState<string | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [filtroVistoria, setFiltroVistoria] = useState<string>("ativas");

  // ── Materiais (Compras) ────────────────────────────────────────────────────
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [carregandoMat, setCarregandoMat] = useState(false);
  const [modalMat, setModalMat] = useState<{ aberto: boolean; atendimentoId: string | null }>({ aberto: false, atendimentoId: null });
  const [formMat, setFormMat] = useState<typeof EMPTY_MAT>({ ...EMPTY_MAT });
  const [salvandoMat, setSalvandoMat] = useState(false);
  const [atendFiltroCompras, setAtendFiltroCompras] = useState<string | null>(null);

  useEffect(() => {
    if (aba === "atendimentos") { carregarAtendimentos(); carregarPedidosFechados(); }
    if (aba === "gantt") carregarAtendimentos();
    if (aba === "compras") { carregarAtendimentos(); carregarMateriais(); }
    if (aba === "estoque") carregarEstoque();
    if (aba === "vistorias") carregarVistorias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  async function carregarVistorias() {
    setCarregandoVistorias(true);
    const { data } = await supabase
      .from("vistorias")
      .select("*")
      .order("criado_em", { ascending: false });
    if (data) setVistorias(data as Vistoria[]);
    setCarregandoVistorias(false);
  }

  async function agendarVistoria(id: string) {
    if (!dataAgendada) return;
    await supabase.from("vistorias").update({
      status: "agendada",
      data_agendada: dataAgendada,
      tecnico_nome: tecnicoNome || null,
      observacoes: observacoes || null,
    }).eq("id", id);
    setAgendandoId(null);
    setDataAgendada("");
    setTecnicoNome("");
    setObservacoes("");
    await carregarVistorias();
  }

  async function uploadDts(vistoriaId: string, file: File) {
    setUploadingDts(vistoriaId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${vistoriaId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("dts-documentos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("dts-documentos").getPublicUrl(path);

      await supabase.from("vistorias").update({
        dts_url: publicUrl,
        dts_nome: file.name,
        status: "em_andamento",
      }).eq("id", vistoriaId);

      // Aciona análise IA em background
      supabase.functions.invoke("analyze-dts", {
        body: { vistoria_id: vistoriaId, dts_url: publicUrl },
      }).then(() => carregarVistorias());

      await carregarVistorias();
    } catch (e: any) {
      alert("Erro ao fazer upload: " + e.message);
    } finally {
      setUploadingDts(null);
    }
  }

  async function concluirVistoria(v: Vistoria) {
    if (!confirm(`Confirmar conclusão da vistoria de "${v.cliente_nome}"?`)) return;
    setConcluindoId(v.id);
    try {
      await supabase.from("vistorias").update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
      }).eq("id", v.id);

      // Notifica Marilia por email
      await supabase.functions.invoke("notify-vistoria", {
        body: {
          evento: "concluida",
          vistoria: {
            id: v.id,
            cliente_nome: v.cliente_nome,
            cliente_endereco: v.cliente_endereco,
            cliente_telefone: v.cliente_telefone,
            cliente_email: v.cliente_email,
            dts_resumo_ia: v.dts_resumo_ia,
          },
        },
      });

      await carregarVistorias();
    } finally {
      setConcluindoId(null);
    }
  }

  async function carregarAtendimentos() {
    setCarregandoAtend(true);
    const { data } = await supabase.from("atendimentos").select("*").order("data_agendada", { ascending: false });
    if (data) setAtendimentos(data as Atendimento[]);
    setCarregandoAtend(false);
  }

  async function carregarPedidosFechados() {
    setCarregandoPedidos(true);
    const { data } = await supabase
      .from("crm_propostas")
      .select("*, lead:crm_leads(nome_empresa, contato)")
      .eq("status", "fechado")
      .order("atualizado_em", { ascending: false });
    if (data) setPedidosFechados(data as PedidoFechado[]);
    setCarregandoPedidos(false);
  }

  async function carregarMateriais() {
    setCarregandoMat(true);
    const { data } = await supabase.from("atendimentos_materiais").select("*").order("criado_em", { ascending: false });
    if (data) setMateriais(data as Material[]);
    setCarregandoMat(false);
  }

  function abrirModalAtend(atend?: Atendimento) {
    if (atend) {
      setSelAtend(atend);
      setFormAtend({
        titulo: atend.titulo, classificacao: atend.classificacao, status: atend.status,
        data_agendada: atend.data_agendada || "", hora_inicio: atend.hora_inicio || "",
        hora_fim: atend.hora_fim || "", responsaveis: atend.responsaveis || [],
        endereco: atend.endereco || "", atividade: atend.atividade || "",
        descricao: atend.descricao || "", agendado_com_cliente: atend.agendado_com_cliente,
        em_sistema: atend.em_sistema,
      });
    } else {
      setSelAtend(null);
      setFormAtend({ ...EMPTY_ATEND });
    }
    setModalAtend(true);
  }

  async function salvarAtend() {
    if (!formAtend.titulo.trim()) return;
    setSalvandoAtend(true);
    const payload = {
      titulo: formAtend.titulo.trim(),
      classificacao: formAtend.classificacao,
      status: formAtend.status,
      data_agendada: formAtend.data_agendada || null,
      hora_inicio: formAtend.hora_inicio || null,
      hora_fim: formAtend.hora_fim || null,
      responsaveis: formAtend.responsaveis,
      endereco: formAtend.endereco || null,
      atividade: formAtend.atividade || null,
      descricao: formAtend.descricao || null,
      agendado_com_cliente: formAtend.agendado_com_cliente,
      em_sistema: formAtend.em_sistema,
    };
    if (selAtend) await supabase.from("atendimentos").update(payload).eq("id", selAtend.id);
    else await supabase.from("atendimentos").insert(payload);
    setModalAtend(false);
    await carregarAtendimentos();
    setSalvandoAtend(false);
  }

  async function excluirAtend(id: string) {
    if (!confirm("Excluir este atendimento e todos os seus materiais?")) return;
    await supabase.from("atendimentos").delete().eq("id", id);
    await carregarAtendimentos();
  }

  async function atualizarStatusAtend(id: string, status: Atendimento["status"]) {
    await supabase.from("atendimentos").update({ status }).eq("id", id);
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  function abrirModalMat(atendimentoId: string) {
    setFormMat({ ...EMPTY_MAT });
    setModalMat({ aberto: true, atendimentoId });
  }

  async function salvarMat() {
    if (!formMat.descricao.trim() || !modalMat.atendimentoId) return;
    setSalvandoMat(true);
    await supabase.from("atendimentos_materiais").insert({
      atendimento_id: modalMat.atendimentoId,
      descricao: formMat.descricao.trim(),
      codigo: formMat.codigo || null,
      quantidade: Number(formMat.quantidade) || 1,
      unidade: formMat.unidade,
      valor_unitario: formMat.valor_unitario ? Number(formMat.valor_unitario) : null,
      fornecedor: formMat.fornecedor || null,
      link_compra: formMat.link_compra || null,
      status: formMat.status,
      observacoes: formMat.observacoes || null,
    });
    setModalMat({ aberto: false, atendimentoId: null });
    await carregarMateriais();
    setSalvandoMat(false);
  }

  async function atualizarStatusMat(id: string, status: Material["status"]) {
    await supabase.from("atendimentos_materiais").update({ status }).eq("id", id);
    setMateriais(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }

  async function excluirMat(id: string) {
    if (!confirm("Excluir este material?")) return;
    await supabase.from("atendimentos_materiais").delete().eq("id", id);
    await carregarMateriais();
  }

  async function carregarEstoque() {
    setCarregandoEstoque(true);
    const { data } = await supabase.from("logistica_estoque").select("*").order("nome");
    if (data) setItens(data as ItemEstoque[]);
    setCarregandoEstoque(false);
  }

  function abrirEstoque(item?: ItemEstoque) {
    if (item) { setSelEstoque(item); setFormEstoque({ ...item }); }
    else { setSelEstoque(null); setFormEstoque({ nome: "", codigo: "", categoria: "", quantidade: 0, estoque_minimo: 0, unidade: "un", localizacao: "" }); }
    setModalEstoque(true);
  }

  async function salvarEstoque() {
    if (!formEstoque.nome?.trim()) return;
    if (selEstoque) await supabase.from("logistica_estoque").update(formEstoque).eq("id", selEstoque.id);
    else await supabase.from("logistica_estoque").insert(formEstoque);
    setModalEstoque(false);
    carregarEstoque();
  }

  const abaixoMinimo = itens.filter(i => i.quantidade <= i.estoque_minimo);

  // ── Suprimentos ────────────────────────────────────────────────────────────
  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [carregandoSup, setCarregandoSup] = useState(true);
  const [modalSup, setModalSup] = useState(false);
  const [selSup, setSelSup] = useState<Suprimento | null>(null);
  const [buscaSup, setBuscaSup] = useState("");
  const [formSup, setFormSup] = useState<Partial<Suprimento>>({
    nome: "", codigo: "", categoria: "", unidade: "un",
    custo_unitario: 0, link_compra: "",
  });

  // carregarSuprimentos e profissionais são gerenciados pelo useEffect do bloco de profissionais

  async function carregarSuprimentos() {
    setCarregandoSup(true);
    const { data } = await supabase.from("logistica_suprimentos").select("*").order("nome");
    if (data) setSuprimentos(data as Suprimento[]);
    setCarregandoSup(false);
  }

  function abrirSup(s?: Suprimento) {
    if (s) { setSelSup(s); setFormSup({ ...s }); }
    else { setSelSup(null); setFormSup({ nome: "", codigo: "", categoria: "", unidade: "un", custo_unitario: 0, tempo_instalacao_min: 0, profissionais_ids: [], link_compra: "" }); }
    setModalSup(true);
  }

  async function salvarSup() {
    if (!formSup.nome?.trim()) return;
    const payload = { ...formSup, atualizado_em: new Date().toISOString() };
    if (selSup) await supabase.from("logistica_suprimentos").update(payload).eq("id", selSup.id);
    else await supabase.from("logistica_suprimentos").insert(payload);
    setModalSup(false);
    carregarSuprimentos();
  }

  async function excluirSup(id: string) {
    if (!confirm("Excluir este suprimento?")) return;
    await supabase.from("logistica_suprimentos").delete().eq("id", id);
    carregarSuprimentos();
  }

  const supFiltrados = suprimentos.filter(s =>
    !buscaSup ||
    s.nome.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.codigo?.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.categoria?.toLowerCase().includes(buscaSup.toLowerCase())
  );

  const precosDesatualizados = suprimentos.filter(s => s.atualizado_em && diasDesdeAtualizacao(s.atualizado_em) > DIAS_ALERTA);

  // ── Profissionais Terceirizados ─────────────────────────────────────────────
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregandoProf, setCarregandoProf] = useState(true);
  const [modalProf, setModalProf] = useState(false);
  const [selProf, setSelProf] = useState<Profissional | null>(null);
  const [formProf, setFormProf] = useState<Partial<Profissional>>({
    nome: "", especialidade: "", tipo_cobranca: "diaria", custo_diario: 0, custo_unitario: 0, ativo: true,
  });

  // ── Valor de MO Padrão (para orçamentos CRM) ───────────────────────────────
  const [moPadrao, setMoPadrao] = useState<number>(0);
  const [salvandoMo, setSalvandoMo] = useState(false);
  const [moSalvo, setMoSalvo] = useState(false);

  async function carregarMoPadrao() {
    const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "mo_padrao_valor").single();
    if (data) setMoPadrao(Number(data.valor) || 0);
  }

  async function salvarMoPadrao() {
    setSalvandoMo(true);
    await supabase.from("configuracoes").upsert({ chave: "mo_padrao_valor", valor: String(moPadrao) }, { onConflict: "chave" });
    setSalvandoMo(false);
    setMoSalvo(true);
    setTimeout(() => setMoSalvo(false), 2500);
  }

  useEffect(() => {
    if (aba === "equipe") { carregarProfissionais(); carregarMoPadrao(); }
    if (aba === "suprimentos") { carregarSuprimentos(); carregarProfissionais(); }
  }, [aba]);

  async function carregarProfissionais() {
    setCarregandoProf(true);
    const { data } = await supabase.from("logistica_profissionais").select("*").order("nome");
    if (data) setProfissionais(data as Profissional[]);
    setCarregandoProf(false);
  }

  function abrirProf(p?: Profissional) {
    if (p) { setSelProf(p); setFormProf({ ...p }); }
    else { setSelProf(null); setFormProf({ nome: "", especialidade: "", tipo_cobranca: "diaria", custo_diario: 0, custo_unitario: 0, ativo: true }); }
    setModalProf(true);
  }

  async function salvarProf() {
    if (!formProf.nome?.trim()) return;
    if (selProf) await supabase.from("logistica_profissionais").update(formProf).eq("id", selProf.id);
    else await supabase.from("logistica_profissionais").insert(formProf);
    setModalProf(false);
    carregarProfissionais();
  }

  async function excluirProf(id: string) {
    if (!confirm("Excluir este profissional?")) return;
    await supabase.from("logistica_profissionais").delete().eq("id", id);
    carregarProfissionais();
  }

  function toggleProfissionalNoSup(profId: string) {
    const atual = formSup.profissionais_ids ?? [];
    const novo = atual.includes(profId)
      ? atual.filter(id => id !== profId)
      : [...atual, profId];
    setFormSup({ ...formSup, profissionais_ids: novo });
  }

  // ── Técnico ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketTecnico[]>([]);
  const [carregandoTickets, setCarregandoTickets] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("aberto");

  // ── Fila unificada de agendáveis ───────────────────────────────────────────
  interface ItemAgendavel {
    id: string;
    tipo: "vistoria" | "atendimento" | "manutencao";
    cliente: string;
    endereco: string | null;
    bairro: string | null;
    data: string | null;
    status: string;
    tecnico: string | null;
    descricao?: string;
  }
  const [agendaveis, setAgendaveis] = useState<ItemAgendavel[]>([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);

  useEffect(() => { if (aba === "tecnico") { carregarTickets(); carregarAgendaveis(); } }, [aba]);

  async function carregarTickets() {
    setCarregandoTickets(true);
    const { data } = await supabase
      .from("tickets_tecnicos")
      .select("*")
      .order("agendado_para", { ascending: true });
    if (data) setTickets(data as TicketTecnico[]);
    setCarregandoTickets(false);
  }

  function extrairBairro(endereco: string | null): string | null {
    if (!endereco) return null;
    // Tenta extrair bairro de endereços no formato "Rua X, N - Bairro, Cidade - UF"
    const partes = endereco.split(/[-,]/);
    if (partes.length >= 3) return partes[partes.length - 3]?.trim() || null;
    if (partes.length === 2) return partes[1]?.trim() || null;
    return null;
  }

  async function carregarAgendaveis() {
    setCarregandoAgenda(true);
    const itens: ReturnType<typeof useState<any[]>>[0] = [];

    // Vistorias pendentes e agendadas
    const { data: vis } = await supabase
      .from("vistorias")
      .select("id, cliente_nome, cliente_endereco, status, data_agendada, tecnico_nome")
      .in("status", ["pendente", "agendada", "em_andamento"]);

    (vis ?? []).forEach((v: any) => {
      itens.push({
        id: v.id,
        tipo: "vistoria",
        cliente: v.cliente_nome,
        endereco: v.cliente_endereco,
        bairro: extrairBairro(v.cliente_endereco),
        data: v.data_agendada,
        status: v.status,
        tecnico: v.tecnico_nome,
        descricao: "Vistoria técnica",
      });
    });

    // Atendimentos programados ou em andamento
    const { data: atend } = await supabase
      .from("atendimentos")
      .select("id, titulo, endereco, status, data_agendada, responsaveis")
      .in("status", ["Programado", "Em andamento"]);

    (atend ?? []).forEach((a: any) => {
      itens.push({
        id: a.id,
        tipo: "atendimento",
        cliente: a.titulo,
        endereco: a.endereco,
        bairro: extrairBairro(a.endereco),
        data: a.data_agendada,
        status: a.status,
        tecnico: Array.isArray(a.responsaveis) ? a.responsaveis[0] : null,
        descricao: "Atendimento",
      });
    });

    // Contratos ativos (manutenções recorrentes)
    const { data: contr } = await supabase
      .from("ca_contratos")
      .select("id, nome, cliente_nome")
      .eq("status", "active")
      .limit(30);

    (contr ?? []).forEach((c: any) => {
      itens.push({
        id: c.id,
        tipo: "manutencao",
        cliente: c.cliente_nome,
        endereco: null,
        bairro: null,
        data: null,
        status: "ativo",
        tecnico: null,
        descricao: c.nome,
      });
    });

    // Ordenar: sem data primeiro (pendentes), depois por data
    itens.sort((a: any, b: any) => {
      if (!a.data && !b.data) return a.cliente.localeCompare(b.cliente);
      if (!a.data) return -1;
      if (!b.data) return 1;
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });

    setAgendaveis(itens as any);
    setCarregandoAgenda(false);
  }

  function abrirGoogleCalendar(item: any) {
    const titulo = encodeURIComponent(`[${item.tipo === "vistoria" ? "Vistoria" : item.tipo === "atendimento" ? "Atendimento" : "Manutenção"}] ${item.cliente}`);
    const local = encodeURIComponent(item.endereco ?? "");
    const detalhe = encodeURIComponent(`Tipo: ${item.descricao}\nEndereço: ${item.endereco ?? "—"}\nTécnico: ${item.tecnico ?? "—"}`);
    // Data base: amanhã ao meio-dia se não tiver data
    const base = item.data ? new Date(item.data) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; })();
    const fim = new Date(base.getTime() + 2 * 60 * 60 * 1000); // +2h
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${fmt(base)}/${fmt(fim)}&location=${local}&details=${detalhe}`;
    window.open(url, "_blank");
  }

  const ticketsFiltrados = tickets.filter(t =>
    filtroStatus === "todos" || t.status === filtroStatus
  );

  const ticketsAbertos = tickets.filter(t =>
    t.status === "aberto" || t.status === "em_andamento" || t.status === "aguardando"
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logística</h1>
        <p className="mt-1 text-sm text-gray-500">Estoque, suprimentos e agenda técnica</p>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {([
          { key: "atendimentos", label: "Atendimentos",           icon: ClipboardList },
          { key: "vistorias",    label: "Vistorias",              icon: ClipboardCheck },
          { key: "gantt",        label: "Gantt",                  icon: BarChart2 },
          { key: "compras",      label: "Compras",               icon: ShoppingBag },
          { key: "estoque",      label: "Estoque",               icon: Package },
          { key: "suprimentos",  label: "Catálogo",              icon: ShoppingCart },
          { key: "equipe",       label: "Equipe / Terceirizados", icon: HardHat },
          { key: "tecnico",      label: "Área Técnica",          icon: Wrench },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              aba === key
                ? "border-[#1a6b2f] text-[#1a6b2f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            <Icon className="h-4 w-4" />
            {label}
            {key === "estoque" && abaixoMinimo.length > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{abaixoMinimo.length}</span>
            )}
            {key === "suprimentos" && precosDesatualizados.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{precosDesatualizados.length}</span>
            )}
            {key === "vistorias" && vistorias.filter(v => v.status === "pendente" || v.status === "agendada").length > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {vistorias.filter(v => v.status === "pendente" || v.status === "agendada").length}
              </span>
            )}
            {key === "atendimentos" && atendimentos.filter(a => a.status === "Programado" || a.status === "Em andamento").length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {atendimentos.filter(a => a.status === "Programado" || a.status === "Em andamento").length}
              </span>
            )}
            {key === "atendimentos" && pedidosFechados.length > 0 && (
              <span className="ml-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Pedidos fechados">
                {pedidosFechados.length} ✓
              </span>
            )}
            {key === "tecnico" && ticketsAbertos.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{ticketsAbertos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ ABA ATENDIMENTOS ═══════ */}
      {aba === "atendimentos" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {["todos", "Programado", "Em andamento", "Concluído", "Cancelado"].map(s => (
                <button key={s} onClick={() => setFiltroStatusAtend(s)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filtroStatusAtend === s ? "bg-[#1a6b2f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                  {s === "todos" ? "Todos" : s}
                </button>
              ))}
            </div>
            <button onClick={() => abrirModalAtend()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Atendimento
            </button>
          </div>

          {carregandoAtend ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <div className="space-y-3">
              {atendimentos
                .filter(a => filtroStatusAtend === "todos" || a.status === filtroStatusAtend)
                .map(atend => (
                  <div key={atend.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{atend.titulo}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border", STATUS_ATEND_COR[atend.status])}>
                              {atend.status}
                            </span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_COR[atend.classificacao])}>
                              {atend.classificacao}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            {atend.data_agendada && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(atend.data_agendada + "T00:00:00").toLocaleDateString("pt-BR")}
                                {atend.hora_inicio && ` ${atend.hora_inicio}`}
                              </span>
                            )}
                            {atend.responsaveis?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {atend.responsaveis.join(", ")}
                              </span>
                            )}
                            {atend.endereco && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {atend.endereco}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setAtendAberto(atendAberto === atend.id ? null : atend.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          {atendAberto === atend.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button onClick={() => abrirModalAtend(atend)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => excluirAtend(atend.id)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {atendAberto === atend.id && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                        {/* Status rápido */}
                        <div className="mb-3 flex gap-2 flex-wrap">
                          {(["Programado", "Em andamento", "Concluído", "Cancelado"] as Atendimento["status"][]).map(s => (
                            <button key={s} onClick={() => atualizarStatusAtend(atend.id, s)}
                              className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                atend.status === s ? STATUS_ATEND_COR[s] : "border-gray-200 text-gray-500 hover:border-gray-300")}>
                              {s}
                            </button>
                          ))}
                        </div>
                        {/* Flags */}
                        <div className="mb-3 flex gap-4 text-xs text-gray-500">
                          <span className={cn("flex items-center gap-1", atend.agendado_com_cliente ? "text-green-600 font-medium" : "")}>
                            {atend.agendado_com_cliente ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 inline-block rounded-full border border-gray-300" />}
                            Agendado com cliente
                          </span>
                          <span className={cn("flex items-center gap-1", atend.em_sistema ? "text-green-600 font-medium" : "")}>
                            {atend.em_sistema ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 inline-block rounded-full border border-gray-300" />}
                            Em sistema
                          </span>
                        </div>
                        {atend.atividade && <p className="mb-1 text-xs text-gray-600"><span className="font-medium">Atividade:</span> {atend.atividade}</p>}
                        {atend.descricao && <p className="text-xs text-gray-600"><span className="font-medium">Descrição:</span> {atend.descricao}</p>}
                        {/* Materiais deste atendimento */}
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">Materiais</span>
                            <button onClick={() => abrirModalMat(atend.id)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#1a6b2f] hover:bg-green-50">
                              <Plus className="h-3 w-3" /> Adicionar
                            </button>
                          </div>
                          {materiais.filter(m => m.atendimento_id === atend.id).length === 0 ? (
                            <p className="text-xs text-gray-400">Nenhum material cadastrado</p>
                          ) : (
                            <div className="space-y-1">
                              {materiais.filter(m => m.atendimento_id === atend.id).map(mat => (
                                <div key={mat.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                                  <div>
                                    <span className="text-xs font-medium text-gray-800">{mat.descricao}</span>
                                    <span className="ml-2 text-xs text-gray-500">{mat.quantidade} {mat.unidade}</span>
                                    {mat.fornecedor && <span className="ml-2 text-xs text-gray-400">— {mat.fornecedor}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_MAT_COR[mat.status])}>
                                      {mat.status}
                                    </span>
                                    <button onClick={() => excluirMat(mat.id)} className="text-red-400 hover:text-red-600">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {atendimentos.filter(a => filtroStatusAtend === "todos" || a.status === filtroStatusAtend).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                  Nenhum atendimento encontrado
                </div>
              )}
            </div>
          )}

          {/* ── Pedidos Fechados do CRM ── */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-700">Pedidos Fechados</h2>
              {carregandoPedidos ? (
                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {pedidosFechados.length}
                </span>
              )}
              <span className="text-xs text-gray-400">— contratos fechados no CRM</span>
            </div>

            {carregandoPedidos ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : pedidosFechados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                Nenhum pedido fechado ainda
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Proposta</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pedidosFechados.map(p => {
                      const clienteNome = p.lead?.nome_empresa || p.lead?.contato || "—";
                      const valorMensal = p.conteudo?.parcela ?? null;
                      const dataFecho = p.atualizado_em
                        ? new Date(p.atualizado_em).toLocaleDateString("pt-BR")
                        : new Date(p.criado_em).toLocaleDateString("pt-BR");
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{clienteNome}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              p.tipo === "manutencao"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              {p.tipo === "manutencao" ? "Manutenção 12×" : "Orçamento"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-500 truncate max-w-[180px]">
                            {p.nome_arquivo || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {valorMensal ? (
                              <span className="text-sm font-semibold text-gray-800">
                                {valorMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                <span className="text-xs font-normal text-gray-400">/mês</span>
                              </span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{dataFecho}</td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`/painel/crm?lead=${p.lead_id}`}
                              className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline justify-end"
                            >
                              <ExternalLink className="h-3 w-3" /> CRM
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Atendimento */}
          {modalAtend && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalAtend(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900">{selAtend ? "Editar Atendimento" : "Novo Atendimento"}</h3>
                  <button onClick={() => setModalAtend(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="label-field">Título *</label>
                    <input className="input-field" value={formAtend.titulo} onChange={e => setFormAtend(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Portão automático — Empresa ABC" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Classificação</label>
                      <select className="input-field" value={formAtend.classificacao} onChange={e => setFormAtend(f => ({ ...f, classificacao: e.target.value as Atendimento["classificacao"] }))}>
                        {["Serviço", "Vistoria", "Retorno", "Operacional", "Terceirizados"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-field">Status</label>
                      <select className="input-field" value={formAtend.status} onChange={e => setFormAtend(f => ({ ...f, status: e.target.value as Atendimento["status"] }))}>
                        {["Programado", "Em andamento", "Concluído", "Cancelado"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label-field">Data</label>
                      <input type="date" className="input-field" value={formAtend.data_agendada} onChange={e => setFormAtend(f => ({ ...f, data_agendada: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Hora início</label>
                      <input type="time" className="input-field" value={formAtend.hora_inicio} onChange={e => setFormAtend(f => ({ ...f, hora_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Hora fim</label>
                      <input type="time" className="input-field" value={formAtend.hora_fim} onChange={e => setFormAtend(f => ({ ...f, hora_fim: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Responsáveis</label>
                    <div className="flex flex-wrap gap-2">
                      {RESPONSAVEIS_OPCOES.map(r => (
                        <button key={r} type="button"
                          onClick={() => setFormAtend(f => ({ ...f, responsaveis: f.responsaveis.includes(r) ? f.responsaveis.filter(x => x !== r) : [...f.responsaveis, r] }))}
                          className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                            formAtend.responsaveis.includes(r) ? "bg-[#1a6b2f] text-white border-[#1a6b2f]" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Endereço</label>
                    <input className="input-field" value={formAtend.endereco} onChange={e => setFormAtend(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, cidade" />
                  </div>
                  <div>
                    <label className="label-field">Atividade</label>
                    <input className="input-field" value={formAtend.atividade} onChange={e => setFormAtend(f => ({ ...f, atividade: e.target.value }))} placeholder="O que será feito?" />
                  </div>
                  <div>
                    <label className="label-field">Descrição / Observações</label>
                    <textarea className="input-field" rows={3} value={formAtend.descricao} onChange={e => setFormAtend(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes adicionais..." />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formAtend.agendado_com_cliente} onChange={e => setFormAtend(f => ({ ...f, agendado_com_cliente: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700">Agendado com cliente</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formAtend.em_sistema} onChange={e => setFormAtend(f => ({ ...f, em_sistema: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700">Em sistema</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                  <button onClick={() => setModalAtend(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarAtend} disabled={salvandoAtend || !formAtend.titulo.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoAtend ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Material */}
          {modalMat.aberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalMat({ aberto: false, atendimentoId: null })}>
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900">Adicionar Material</h3>
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="label-field">Descrição *</label>
                    <input className="input-field" value={formMat.descricao} onChange={e => setFormMat(f => ({ ...f, descricao: e.target.value }))} placeholder="Nome do material" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Quantidade</label>
                      <input type="number" className="input-field" value={formMat.quantidade} onChange={e => setFormMat(f => ({ ...f, quantidade: Number(e.target.value) }))} min={1} />
                    </div>
                    <div>
                      <label className="label-field">Unidade</label>
                      <select className="input-field" value={formMat.unidade} onChange={e => setFormMat(f => ({ ...f, unidade: e.target.value }))}>
                        {["un", "m", "m²", "m³", "kg", "L", "cx", "pç", "par", "rolo"].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Fornecedor</label>
                    <input className="input-field" value={formMat.fornecedor} onChange={e => setFormMat(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
                  </div>
                  <div>
                    <label className="label-field">Status</label>
                    <select className="input-field" value={formMat.status} onChange={e => setFormMat(f => ({ ...f, status: e.target.value as Material["status"] }))}>
                      {["Solicitado", "Comprado", "Chegou no escritório", "Enviado ao campo", "Instalado"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Observações</label>
                    <textarea className="input-field" rows={2} value={formMat.observacoes} onChange={e => setFormMat(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarMat} disabled={salvandoMat || !formMat.descricao.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoMat ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ ABA GANTT ═══════ */}
      {/* ═══════ ABA VISTORIAS ═══════ */}
      {aba === "vistorias" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {[
                { key: "ativas",    label: "Ativas" },
                { key: "pendente",  label: "Pendentes" },
                { key: "agendada",  label: "Agendadas" },
                { key: "concluida", label: "Concluídas" },
                { key: "todas",     label: "Todas" },
              ].map(f => (
                <button key={f.key} onClick={() => setFiltroVistoria(f.key)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filtroVistoria === f.key ? "bg-[#1a6b2f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={carregarVistorias} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <Loader2 className={cn("h-3.5 w-3.5", carregandoVistorias && "animate-spin")} /> Atualizar
            </button>
          </div>

          {carregandoVistorias ? (
            <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando vistorias...
            </div>
          ) : (() => {
            const lista = vistorias.filter(v => {
              if (filtroVistoria === "ativas") return v.status === "pendente" || v.status === "agendada" || v.status === "em_andamento";
              if (filtroVistoria === "todas") return true;
              return v.status === filtroVistoria;
            });
            if (lista.length === 0) return (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ClipboardCheck className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma vistoria encontrada</p>
                <p className="text-xs mt-1">As vistorias enviadas pelo CRM aparecerão aqui</p>
              </div>
            );
            return (
              <div className="space-y-3">
                {lista.map(v => {
                  const aberto = vistoriaAberta === v.id;
                  const agendando = agendandoId === v.id;
                  return (
                    <div key={v.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      {/* Cabeçalho do card */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setVistoriaAberta(aberto ? null : v.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{v.cliente_nome}</span>
                            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_VISTORIA_COR[v.status])}>
                              {STATUS_VISTORIA_LABEL[v.status]}
                            </span>
                            {v.dts_url && (
                              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> DTS
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {v.cliente_endereco && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="h-3 w-3" /> {v.cliente_endereco}
                              </span>
                            )}
                            {v.data_agendada && (
                              <span className="flex items-center gap-1 text-xs text-blue-600">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(v.data_agendada).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {v.enviado_por && (
                              <span className="text-xs text-gray-400">Enviado por {v.enviado_por}</span>
                            )}
                          </div>
                        </div>
                        {aberto ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                      </div>

                      {/* Detalhes expandidos */}
                      {aberto && (
                        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                          {/* Dados do cliente */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {v.cliente_telefone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <a href={`tel:${v.cliente_telefone}`} className="text-blue-600 hover:underline">{v.cliente_telefone}</a>
                              </div>
                            )}
                            {v.cliente_email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">{v.cliente_email}</span>
                              </div>
                            )}
                            {v.tecnico_nome && (
                              <div className="flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">Técnico: {v.tecnico_nome}</span>
                              </div>
                            )}
                          </div>

                          {v.observacoes && (
                            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{v.observacoes}</p>
                          )}

                          {/* Formulário de agendamento */}
                          {v.status === "pendente" && (
                            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                              {!agendando ? (
                                <button
                                  onClick={() => { setAgendandoId(v.id); setDataAgendada(""); setTecnicoNome(""); setObservacoes(""); }}
                                  className="flex items-center gap-2 text-sm font-medium text-orange-700 hover:text-orange-800"
                                >
                                  <CalendarIcon className="h-4 w-4" /> Agendar vistoria
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-orange-800 mb-2">Agendar vistoria</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-600">Data e hora *</label>
                                      <input type="datetime-local" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)}
                                        className="input-field w-full mt-0.5" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Técnico responsável</label>
                                      <select value={tecnicoNome} onChange={e => setTecnicoNome(e.target.value)}
                                        className="input-field w-full mt-0.5">
                                        <option value="">Selecione...</option>
                                        {RESPONSAVEIS_OPCOES.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <textarea rows={2} placeholder="Observações (opcional)"
                                    value={observacoes} onChange={e => setObservacoes(e.target.value)}
                                    className="input-field w-full resize-none" />
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={() => setAgendandoId(null)}
                                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                      Cancelar
                                    </button>
                                    <button onClick={() => agendarVistoria(v.id)}
                                      className="flex-1 rounded-lg bg-[#1a6b2f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#155824]">
                                      Confirmar agendamento
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Upload DTS */}
                          {(v.status === "agendada" || v.status === "em_andamento") && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                                <FileText className="h-4 w-4" /> Documento Técnico de Segurança (DTS)
                              </p>
                              {v.dts_url ? (
                                <div className="space-y-2">
                                  <a href={v.dts_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    {v.dts_nome ?? "Ver DTS"}
                                  </a>
                                  {v.dts_resumo_ia && (
                                    <div className="rounded-md bg-white border border-blue-100 px-3 py-2">
                                      <p className="text-[11px] font-semibold text-blue-700 mb-1">📋 Análise IA</p>
                                      <p className="text-xs text-gray-700 whitespace-pre-line">{v.dts_resumo_ia}</p>
                                    </div>
                                  )}
                                  {!v.dts_resumo_ia && (
                                    <p className="text-xs text-blue-600 italic">Análise IA em processamento...</p>
                                  )}
                                </div>
                              ) : (
                                <label className={cn(
                                  "flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-800",
                                  uploadingDts === v.id && "opacity-50 cursor-not-allowed"
                                )}>
                                  {uploadingDts === v.id ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                                  ) : (
                                    <><Upload className="h-4 w-4" /> Fazer upload do DTS (PDF)</>
                                  )}
                                  <input type="file" accept=".pdf" className="hidden"
                                    disabled={uploadingDts === v.id}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDts(v.id, f); }} />
                                </label>
                              )}
                            </div>
                          )}

                          {/* DTS em vistorias concluídas */}
                          {v.status === "concluida" && v.dts_url && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                              <p className="text-xs font-semibold text-green-800 mb-2">📋 DTS Anexado</p>
                              <a href={v.dts_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-green-700 hover:underline">
                                <ExternalLink className="h-3.5 w-3.5" /> {v.dts_nome ?? "Ver DTS"}
                              </a>
                              {v.dts_resumo_ia && (
                                <p className="mt-2 text-xs text-gray-600 whitespace-pre-line">{v.dts_resumo_ia}</p>
                              )}
                            </div>
                          )}

                          {/* Botão Concluir */}
                          {(v.status === "agendada" || v.status === "em_andamento") && v.dts_url && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => concluirVistoria(v)}
                                disabled={concluindoId === v.id}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {concluindoId === v.id ? (
                                  <><Loader2 className="h-4 w-4 animate-spin" /> Concluindo...</>
                                ) : (
                                  <><Check className="h-4 w-4" /> Vistoria Concluída</>
                                )}
                              </button>
                            </div>
                          )}

                          {v.status === "concluida" && v.concluida_em && (
                            <p className="text-xs text-gray-400 text-right">
                              Concluída em {new Date(v.concluida_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {aba === "gantt" && (
        <GanttView atendimentos={atendimentos} carregando={carregandoAtend} />
      )}

      {/* ═══════ ABA COMPRAS ═══════ */}
      {aba === "compras" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Materiais agrupados por atendimento</p>
            <div className="flex items-center gap-2">
              <select className="input-field w-auto" value={atendFiltroCompras ?? ""} onChange={e => setAtendFiltroCompras(e.target.value || null)}>
                <option value="">Todos os atendimentos</option>
                {atendimentos.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
              </select>
            </div>
          </div>

          {carregandoMat ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <div className="space-y-4">
              {atendimentos
                .filter(a => !atendFiltroCompras || a.id === atendFiltroCompras)
                .filter(a => materiais.some(m => m.atendimento_id === a.id))
                .map(atend => {
                  const mats = materiais.filter(m => m.atendimento_id === atend.id);
                  return (
                    <div key={atend.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{atend.titulo}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_COR[atend.classificacao])}>{atend.classificacao}</span>
                        </div>
                        <button onClick={() => abrirModalMat(atend.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#1a6b2f] hover:bg-green-50">
                          <Plus className="h-3 w-3" /> Material
                        </button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {mats.map(mat => (
                          <div key={mat.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">{mat.descricao}</span>
                                {mat.codigo && <span className="text-xs text-gray-400">#{mat.codigo}</span>}
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                                <span>{mat.quantidade} {mat.unidade}</span>
                                {mat.fornecedor && <span>— {mat.fornecedor}</span>}
                                {mat.valor_total && <span className="font-medium text-gray-700">R$ {mat.valor_total.toFixed(2)}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select value={mat.status} onChange={e => atualizarStatusMat(mat.id, e.target.value as Material["status"])}
                                className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer focus:outline-none", STATUS_MAT_COR[mat.status])}>
                                {["Solicitado", "Comprado", "Chegou no escritório", "Enviado ao campo", "Instalado"].map(s => <option key={s}>{s}</option>)}
                              </select>
                              <button onClick={() => excluirMat(mat.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              {atendimentos.filter(a => materiais.some(m => m.atendimento_id === a.id)).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                  Nenhum material cadastrado. Adicione materiais na aba Atendimentos.
                </div>
              )}
            </div>
          )}

          {/* Modal Material */}
          {modalMat.aberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalMat({ aberto: false, atendimentoId: null })}>
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900">Adicionar Material</h3>
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="label-field">Descrição *</label>
                    <input className="input-field" value={formMat.descricao} onChange={e => setFormMat(f => ({ ...f, descricao: e.target.value }))} placeholder="Nome do material" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Quantidade</label>
                      <input type="number" className="input-field" value={formMat.quantidade} onChange={e => setFormMat(f => ({ ...f, quantidade: Number(e.target.value) }))} min={1} />
                    </div>
                    <div>
                      <label className="label-field">Unidade</label>
                      <select className="input-field" value={formMat.unidade} onChange={e => setFormMat(f => ({ ...f, unidade: e.target.value }))}>
                        {["un", "m", "m²", "m³", "kg", "L", "cx", "pç", "par", "rolo"].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Fornecedor</label>
                    <input className="input-field" value={formMat.fornecedor} onChange={e => setFormMat(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
                  </div>
                  <div>
                    <label className="label-field">Status</label>
                    <select className="input-field" value={formMat.status} onChange={e => setFormMat(f => ({ ...f, status: e.target.value as Material["status"] }))}>
                      {["Solicitado", "Comprado", "Chegou no escritório", "Enviado ao campo", "Instalado"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Observações</label>
                    <textarea className="input-field" rows={2} value={formMat.observacoes} onChange={e => setFormMat(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarMat} disabled={salvandoMat || !formMat.descricao.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoMat ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ ABA ESTOQUE ═══════ */}
      {aba === "estoque" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{itens.length} item{itens.length !== 1 ? "s" : ""} no estoque</p>
            <button onClick={() => abrirEstoque()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Item
            </button>
          </div>

          {abaixoMinimo.length > 0 && (
            <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">{abaixoMinimo.length} item{abaixoMinimo.length !== 1 ? "s" : ""} abaixo do estoque mínimo</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {abaixoMinimo.map(i => (
                  <span key={i.id} className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    {i.nome} ({i.quantidade} {i.unidade})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoEstoque ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <Package className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum item cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Qtd</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Mín</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Localização</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itens.map((item) => {
                    const critico = item.quantidade <= item.estoque_minimo;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                          {item.codigo && <p className="text-xs text-gray-400">{item.codigo}</p>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.categoria || "—"}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">{item.quantidade} {item.unidade}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-400">{item.estoque_minimo}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.localizacao || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium",
                            critico ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                            {critico ? "⚠ Baixo" : "OK"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => abrirEstoque(item)} className="text-xs text-[#1a6b2f] hover:underline">Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════ ABA SUPRIMENTOS ═══════ */}
      {aba === "suprimentos" && (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <input type="text" placeholder="Buscar por nome, código ou categoria…" value={buscaSup}
                onChange={e => setBuscaSup(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
            </div>
            <button onClick={() => abrirSup()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Suprimento
            </button>
          </div>

          {precosDesatualizados.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {precosDesatualizados.length} suprimento{precosDesatualizados.length > 1 ? "s" : ""} com preço não confirmado (mais de {DIAS_ALERTA} dias sem atualização)
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  {precosDesatualizados.map(s => s.nome).join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoSup ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : supFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum suprimento cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Suprimento</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Categoria</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Custo Unit.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Tempo Inst.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Últ. Atualização</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Link</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {supFiltrados.map((s) => {
                    const dias = s.atualizado_em ? diasDesdeAtualizacao(s.atualizado_em) : 9999;
                    const desatualizado = dias > DIAS_ALERTA;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{s.nome}</p>
                          {s.codigo && <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 hidden md:table-cell">{s.categoria || "—"}</td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-gray-800">
                            {s.custo_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="ml-1 text-xs text-gray-400">/{s.unidade}</span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          {s.tempo_instalacao_min > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                              <Clock className="h-3 w-3 text-gray-400" />
                              {s.tempo_instalacao_min < 60
                                ? `${s.tempo_instalacao_min}min`
                                : `${Math.floor(s.tempo_instalacao_min / 60)}h${s.tempo_instalacao_min % 60 > 0 ? `${s.tempo_instalacao_min % 60}min` : ""}`}
                              <span className="text-gray-400">/{s.unidade}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          {s.atualizado_em ? (
                            <div className="flex items-center gap-2">
                              <span className={cn("flex items-center gap-1 text-xs", desatualizado ? "text-amber-600 font-medium" : "text-gray-400")}>
                                <Clock className="h-3 w-3" />
                                {new Date(s.atualizado_em).toLocaleDateString("pt-BR")}
                                {desatualizado && ` (${dias}d)`}
                              </span>
                              {desatualizado && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Preço não confirmado
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          {s.link_compra ? (
                            <a href={s.link_compra} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
                              <ExternalLink className="h-3 w-3" /> Ver link
                            </a>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => abrirSup(s)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => excluirSup(s.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════ ABA TÉCNICO ═══════ */}
      {aba === "tecnico" && (
        <>
          {/* Cards de acesso aos sistemas externos */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Sistemas de Campo</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SISTEMAS_EXTERNOS.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
                    s.cor
                  )}>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/60 shadow-sm">
                    <s.icone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.nome}</p>
                    <p className="text-xs opacity-70">{s.descricao}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-50" />
                </a>
              ))}
            </div>
          </div>

          {/* Agenda de tickets */}
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Agenda de Serviços</h2>
              {ticketsAbertos.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {ticketsAbertos.length} aberto{ticketsAbertos.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                { v: "aberto",       l: "Abertos" },
                { v: "em_andamento", l: "Em andamento" },
                { v: "aguardando",   l: "Aguardando" },
                { v: "todos",        l: "Todos" },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => setFiltroStatus(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    filtroStatus === v
                      ? "bg-white shadow-sm text-gray-800"
                      : "text-gray-500 hover:text-gray-700"
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoTickets ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando agenda…</div>
            ) : ticketsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <CalendarIcon className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum ticket encontrado</p>
                <p className="mt-1 text-xs text-gray-300">
                  Os tickets são cadastrados via AppSheet e sincronizados aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ticketsFiltrados.map((t) => {
                  const dataAgendada = t.agendado_para
                    ? new Date(t.agendado_para).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    : null;
                  const hora = t.agendado_para
                    ? new Date(t.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : null;
                  const statusLabel = t.status?.replace(/_/g, " ") ?? "—";
                  return (
                    <div key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60">
                      {/* data */}
                      <div className="flex-shrink-0 w-14 text-center">
                        {dataAgendada ? (
                          <>
                            <p className="text-lg font-bold text-gray-800 leading-none">
                              {new Date(t.agendado_para).getDate()}
                            </p>
                            <p className="text-[10px] uppercase text-gray-400 font-medium">
                              {new Date(t.agendado_para).toLocaleDateString("pt-BR", { month: "short" })}
                            </p>
                            {hora && <p className="text-[10px] text-gray-400 mt-0.5">{hora}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>

                      {/* linha vertical */}
                      <div className="flex-shrink-0 w-px self-stretch bg-gray-100 mx-1" />

                      {/* conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.titulo}</p>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {t.prioridade && (
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                                PRIORIDADE_CORES[t.prioridade] ?? "bg-gray-100 text-gray-500")}>
                                {t.prioridade}
                              </span>
                            )}
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                              STATUS_CORES[t.status] ?? "bg-gray-100 text-gray-500")}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {t.cliente && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <User className="h-3 w-3" /> {t.cliente}
                            </span>
                          )}
                          {t.tecnico && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Wrench className="h-3 w-3" /> {t.tecnico}
                            </span>
                          )}
                          {t.endereco && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3" /> {t.endereco}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nota informativa */}
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Os tickets são gerenciados nos aplicativos de campo (AppSheet) e sincronizados aqui pela tabela <code className="font-mono bg-gray-100 px-1 rounded">tickets_tecnicos</code> no Supabase.
            </p>
          </div>

          {/* ── Fila de Agendamentos ── */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-[#1a6b2f]" />
                <h2 className="text-sm font-semibold text-gray-700">Fila de Agendamentos</h2>
                {agendaveis.length > 0 && (
                  <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-xs font-medium text-[#1a6b2f]">
                    {agendaveis.length} {agendaveis.length === 1 ? "item" : "itens"}
                  </span>
                )}
              </div>
              <button onClick={carregarAgendaveis}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                <Loader2 className={cn("h-3 w-3", carregandoAgenda && "animate-spin")} /> Atualizar
              </button>
            </div>

            {carregandoAgenda ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : agendaveis.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
                <CalendarIcon className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhum item pendente de agendamento</p>
              </div>
            ) : (() => {
              // Agrupar por bairro
              const grupos: Record<string, typeof agendaveis> = {};
              agendaveis.forEach(item => {
                const bairro = item.bairro ?? "Sem bairro identificado";
                if (!grupos[bairro]) grupos[bairro] = [];
                grupos[bairro].push(item);
              });

              const TIPO_COR: Record<string, string> = {
                vistoria:    "bg-orange-50 text-orange-700 border-orange-200",
                atendimento: "bg-blue-50 text-blue-700 border-blue-200",
                manutencao:  "bg-purple-50 text-purple-700 border-purple-200",
              };
              const TIPO_LABEL: Record<string, string> = {
                vistoria:    "Vistoria",
                atendimento: "Atendimento",
                manutencao:  "Manutenção",
              };

              return (
                <div className="space-y-4">
                  {Object.entries(grupos).map(([bairro, itens]) => (
                    <div key={bairro} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{bairro}</span>
                        <span className="ml-auto text-xs text-gray-400">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {itens.map(item => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{item.cliente}</span>
                                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TIPO_COR[item.tipo])}>
                                  {TIPO_LABEL[item.tipo]}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                {item.endereco && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <MapPin className="h-3 w-3" /> {item.endereco}
                                  </span>
                                )}
                                {item.data && (
                                  <span className="flex items-center gap-1 text-xs text-blue-600">
                                    <CalendarIcon className="h-3 w-3" />
                                    {new Date(item.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {item.tecnico && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <User className="h-3 w-3" /> {item.tecnico}
                                  </span>
                                )}
                                {item.descricao && item.tipo === "manutencao" && (
                                  <span className="text-xs text-gray-400 italic">{item.descricao}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => abrirGoogleCalendar(item)}
                              title="Agendar no Google Calendar"
                              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <CalendarIcon className="h-3.5 w-3.5" /> Google Calendar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Modal Estoque ── */}
      {modalEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalEstoque(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selEstoque ? "Editar Item" : "Novo Item"}</h2>
              <button onClick={() => setModalEstoque(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Nome *", field: "nome" },
                { label: "Código / Referência", field: "codigo" },
                { label: "Categoria", field: "categoria" },
                { label: "Localização", field: "localizacao" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                  <input type="text"
                    value={(formEstoque as Record<string, unknown>)[field] as string || ""}
                    onChange={e => setFormEstoque({ ...formEstoque, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Qtd</label>
                  <input type="number" min={0} value={formEstoque.quantidade ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, quantidade: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mínimo</label>
                  <input type="number" min={0} value={formEstoque.estoque_minimo ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, estoque_minimo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formEstoque.unidade || "un"}
                    onChange={e => setFormEstoque({ ...formEstoque, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEstoque(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarEstoque} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ABA EQUIPE ═══════ */}
      {aba === "equipe" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {profissionais.length} profissional{profissionais.length !== 1 ? "is" : ""} cadastrado{profissionais.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Cada profissional é vinculado aos suprimentos que ele instala</p>
            </div>
            <button onClick={() => abrirProf()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Profissional
            </button>
          </div>

          {carregandoProf ? (
            <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
          ) : profissionais.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <HardHat className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Nenhum profissional cadastrado</p>
              <p className="text-xs mt-1 text-gray-300">Cadastre pedreiros, pintores, ajudantes e outros terceirizados</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profissionais.map(p => (
                <div key={p.id} className={cn(
                  "rounded-xl border bg-white p-4 shadow-sm",
                  p.ativo ? "border-gray-200" : "border-gray-100 opacity-60"
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-[#1a6b2f]/10 p-2">
                        <HardHat className="h-4 w-4 text-[#1a6b2f]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.nome}</p>
                        <p className="text-xs text-gray-400">{p.especialidade || "Sem especialidade"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => abrirProf(p)} className="rounded-md p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => excluirProf(p.id)} className="rounded-md p-1 text-gray-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400">
                      {p.tipo_cobranca === "por_unidade" ? "Custo por unidade" : "Custo diário"}
                    </span>
                    <span className="text-sm font-bold text-[#1a6b2f]">
                      {(p.tipo_cobranca === "por_unidade" ? p.custo_unitario : p.custo_diario)
                        .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        {p.tipo_cobranca === "por_unidade" ? "/un" : "/dia"}
                      </span>
                    </span>
                  </div>
                  {!p.ativo && (
                    <span className="mt-2 block text-[10px] text-gray-300 font-medium text-center">Inativo — não entra nos orçamentos</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Valor de MO Padrão */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Valor de Mão de Obra para Orçamentos</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Valor padrão de MO que aparece pré-preenchido na calculadora do CRM (pode ser ajustado por orçamento)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">R$</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={moPadrao}
                  onChange={e => setMoPadrao(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-1 focus:ring-[#1a6b2f]/20"
                  placeholder="0"
                />
              </div>
              <button
                onClick={salvarMoPadrao}
                disabled={salvandoMo}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
                  moSalvo
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-[#1a6b2f] text-white hover:bg-[#155824] shadow-sm"
                )}
              >
                {moSalvo ? <><Check className="h-4 w-4" /> Salvo</> : salvandoMo ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>

          {/* Info sobre vinculação */}
          {profissionais.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Como vincular profissionais aos itens</p>
                  <p className="text-xs text-blue-500 mt-1">
                    Vá em <strong>Catálogo</strong> → edite um suprimento → na seção "Profissionais necessários", selecione quem é preciso para instalar aquele item.
                    O orçamento calculará automaticamente o custo de cada profissional com base nos dias de campo estimados.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal Profissional ── */}
      {modalProf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalProf(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selProf ? "Editar Profissional" : "Novo Profissional"}</h2>
              <button onClick={() => setModalProf(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formProf.nome || ""}
                  onChange={e => setFormProf({ ...formProf, nome: e.target.value })}
                  placeholder="Ex: João Pedreiro, Carlos Pintor…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Especialidade</label>
                <input type="text" value={formProf.especialidade || ""}
                  onChange={e => setFormProf({ ...formProf, especialidade: e.target.value })}
                  placeholder="Ex: Pedreiro, Pintor, Técnico fotoluminescente, Ajudante…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Forma de cobrança</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["diaria", "por_unidade"] as const).map(tipo => (
                    <button key={tipo} type="button"
                      onClick={() => setFormProf({ ...formProf, tipo_cobranca: tipo })}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                        formProf.tipo_cobranca === tipo
                          ? "border-[#1a6b2f] bg-[#1a6b2f]/10 text-[#1a6b2f]"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}>
                      {tipo === "diaria" ? "Por diária" : "Por unidade"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {formProf.tipo_cobranca === "por_unidade"
                    ? "Cobra por unidade instalada — ex: pintor cobra por porta"
                    : "Cobra por dia de campo — ex: pedreiro, técnico, ajudante"}
                </p>
              </div>
              {formProf.tipo_cobranca === "por_unidade" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo por unidade (R$)</label>
                  <input type="number" min={0} step={10} value={formProf.custo_unitario ?? 0}
                    onChange={e => setFormProf({ ...formProf, custo_unitario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo diário (R$)</label>
                  <input type="number" min={0} step={10} value={formProf.custo_diario ?? 0}
                    onChange={e => setFormProf({ ...formProf, custo_diario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="ativo-prof" checked={formProf.ativo ?? true}
                  onChange={e => setFormProf({ ...formProf, ativo: e.target.checked })}
                  className="rounded border-gray-300 text-[#1a6b2f]" />
                <label htmlFor="ativo-prof" className="text-sm text-gray-700">Profissional ativo (entra nos orçamentos)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalProf(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarProf} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suprimento ── */}
      {modalSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalSup(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selSup ? "Editar Suprimento" : "Novo Suprimento"}</h2>
              <button onClick={() => setModalSup(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formSup.nome || ""}
                  onChange={e => setFormSup({ ...formSup, nome: e.target.value })}
                  placeholder="Ex: Dobradiça Corta-Fogo 3/4"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Código / Ref.</label>
                  <input type="text" value={formSup.codigo || ""}
                    onChange={e => setFormSup({ ...formSup, codigo: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                  <input type="text" value={formSup.categoria || ""}
                    onChange={e => setFormSup({ ...formSup, categoria: e.target.value })}
                    placeholder="Ex: Ferragens"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
                  <input type="number" min={0} step={0.01} value={formSup.custo_unitario ?? 0}
                    onChange={e => setFormSup({ ...formSup, custo_unitario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formSup.unidade || "un"}
                    onChange={e => setFormSup({ ...formSup, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo", "par", "jg"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tempo de instalação (minutos/unidade)
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} step={1} value={formSup.tempo_instalacao_min ?? 0}
                    onChange={e => setFormSup({ ...formSup, tempo_instalacao_min: Number(e.target.value) })}
                    className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                  <span className="text-sm text-gray-400">min/{formSup.unidade || "un"}</span>
                  {(formSup.tempo_instalacao_min ?? 0) > 0 && (
                    <span className="text-xs text-[#1a6b2f] font-medium">
                      ≈ {(formSup.tempo_instalacao_min ?? 0) < 60
                        ? `${formSup.tempo_instalacao_min}min`
                        : `${Math.floor((formSup.tempo_instalacao_min ?? 0) / 60)}h${(formSup.tempo_instalacao_min ?? 0) % 60 > 0 ? `${(formSup.tempo_instalacao_min ?? 0) % 60}min` : ""}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Usado para estimar dias de roteiro no orçamento</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Link de compra</label>
                <input type="url" value={formSup.link_compra || ""}
                  onChange={e => setFormSup({ ...formSup, link_compra: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              {/* ── Profissionais necessários ── */}
              {profissionais.filter(p => p.ativo).length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <HardHat className="h-3.5 w-3.5 text-gray-400" />
                      Profissionais necessários para instalar
                    </span>
                  </label>
                  <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {profissionais.filter(p => p.ativo).map(p => {
                      const selecionado = (formSup.profissionais_ids ?? []).includes(p.id);
                      return (
                        <label key={p.id} className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
                          selecionado ? "bg-[#1a6b2f]/10" : "hover:bg-white"
                        )}>
                          <input type="checkbox" checked={selecionado}
                            onChange={() => toggleProfissionalNoSup(p.id)}
                            className="rounded border-gray-300 text-[#1a6b2f]" />
                          <span className="flex-1 text-sm text-gray-700">{p.nome}</span>
                          {p.especialidade && <span className="text-xs text-gray-400">{p.especialidade}</span>}
                          <span className="text-xs font-medium text-[#1a6b2f]">
                            {(p.tipo_cobranca === "por_unidade" ? p.custo_unitario : p.custo_diario)
                              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            {p.tipo_cobranca === "por_unidade" ? "/un" : "/dia"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">O custo de cada profissional será calculado por dias de campo no orçamento</p>
                </div>
              )}

              {selSup?.atualizado_em && (
                <p className="text-xs text-gray-400">
                  Última atualização: {new Date(selSup.atualizado_em).toLocaleDateString("pt-BR")} — ao salvar, a data será atualizada para hoje.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalSup(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarSup} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
