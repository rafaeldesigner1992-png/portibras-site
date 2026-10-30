import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, Plus, AlertTriangle, X, ShoppingCart,
  ExternalLink, Clock, Pencil, Trash2, AlertCircle,
  Wrench, CalendarDays, Ticket, ChevronRight, MapPin, User, Users, HardHat
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
    icone: CalendarDays,
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

function LogisticaPage() {
  const [aba, setAba] = useState<"estoque" | "suprimentos" | "equipe" | "tecnico">("estoque");

  // ── Estoque ────────────────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(true);
  const [modalEstoque, setModalEstoque] = useState(false);
  const [selEstoque, setSelEstoque] = useState<ItemEstoque | null>(null);
  const [formEstoque, setFormEstoque] = useState<Partial<ItemEstoque>>({
    nome: "", codigo: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, unidade: "un", localizacao: "",
  });

  useEffect(() => { carregarEstoque(); }, []);

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

  useEffect(() => {
    if (aba === "equipe") carregarProfissionais();
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

  useEffect(() => { if (aba === "tecnico") carregarTickets(); }, [aba]);

  async function carregarTickets() {
    setCarregandoTickets(true);
    const { data } = await supabase
      .from("tickets_tecnicos")
      .select("*")
      .order("agendado_para", { ascending: true });
    if (data) setTickets(data as TicketTecnico[]);
    setCarregandoTickets(false);
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
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {([
          { key: "estoque",     label: "Estoque",             icon: Package },
          { key: "suprimentos", label: "Catálogo",            icon: ShoppingCart },
          { key: "equipe",      label: "Equipe / Terceirizados", icon: HardHat },
          { key: "tecnico",     label: "Área Técnica",        icon: Wrench },
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
            {key === "tecnico" && ticketsAbertos.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{ticketsAbertos.length}</span>
            )}
          </button>
        ))}
      </div>

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
                <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
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

          {/* Info sobre vinculação */}
          {profissionais.length > 0 && (
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
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
