import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Search, Phone, Mail, X, LayoutList, Columns,
  Building2, FileText, Calendar, MessageSquare, ChevronRight,
  Loader2, Send, Pencil, Trash2, MapPin, Navigation,
  Calculator, ShoppingCart, Save, Check, AlertCircle, Clock, Download
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

interface Suprimento {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  custo_unitario: number;
  tempo_instalacao_min: number;
  profissionais_ids: string[];
}

interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  tipo_cobranca: "diaria" | "por_unidade";  // diária = × diasCampo; por_unidade = × qtd de portas
  custo_diario: number;      // usado quando tipo_cobranca = "diaria"
  custo_unitario: number;    // usado quando tipo_cobranca = "por_unidade"
  ativo: boolean;
}

interface ItemOrcamento {
  suprimento_id: string;
  nome: string;
  unidade: string;
  custo_unitario: number;   // preço de compra (editável pelo vendedor)
  quantidade: number;
  descricao: string;        // descrição/variação do item (ex: "90 min, 0,80x2,10m")
}

interface Orcamento {
  id?: string;
  lead_id: string;
  itens: ItemOrcamento[];
  custo_total: number;
  margem_pct: number;
  imposto_pct: number;
  preco_final: number;
  observacoes: string;
  criado_em?: string;
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

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Calculadora de Orçamento ─────────────────────────────────────────────────
function CalculadoraOrcamento({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [margemPct, setMargemPct] = useState(30);
  const [impostoPct, setImpostoPct] = useState(10);
  const [obsOrc, setObsOrc] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [orcamentoExistente, setOrcamentoExistente] = useState<Orcamento | null>(null);
  const [busca, setBusca] = useState("");

  // Configs globais de margem (carregadas do banco)
  const [margemMin, setMargemMin] = useState(25);
  const [margemIdeal, setMargemIdeal] = useState(45);

  // Profissionais terceirizados (custo por profissional × diasCampo)
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);

  // ID único para cada ocorrência do item no orçamento (permite múltiplas variações)
  const [proximoId, setProximoId] = useState(1);

  // Minutos produtivos por dia de campo
  const MIN_DIA = 360;

  useEffect(() => {
    async function init() {
      setCarregando(true);
      const [{ data: sups }, { data: orc }, { data: cfgs }, { data: profs }] = await Promise.all([
        supabase.from("logistica_suprimentos").select("id, nome, codigo, unidade, custo_unitario, tempo_instalacao_min, profissionais_ids").order("nome"),
        supabase.from("crm_orcamentos").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }).limit(1),
        supabase.from("configuracoes").select("chave, valor").in("chave", ["imposto_padrao_pct", "margem_minima_pct", "margem_ideal_pct"]),
        supabase.from("logistica_profissionais").select("*").eq("ativo", true).order("nome"),
      ]);
      if (sups) setSuprimentos(sups as Suprimento[]);
      if (profs) setProfissionais(profs as Profissional[]);
      if (cfgs) {
        for (const row of cfgs) {
          if (row.chave === "imposto_padrao_pct") setImpostoPct(Number(row.valor) || 10);
          if (row.chave === "margem_minima_pct") setMargemMin(Number(row.valor) || 25);
          if (row.chave === "margem_ideal_pct") setMargemIdeal(Number(row.valor) || 45);
        }
      }
      if (orc && orc.length > 0) {
        const o = orc[0] as Orcamento;
        setOrcamentoExistente(o);
        // garante que itens salvos têm o campo descricao
        const itensCarregados = (o.itens || []).map((it: ItemOrcamento, idx: number) => ({
          ...it,
          descricao: it.descricao ?? "",
          _uid: idx + 1,
        }));
        setItens(itensCarregados);
        setProximoId(itensCarregados.length + 1);
        setMargemPct(o.margem_pct ?? 30);
        const impCfg = cfgs?.find(r => r.chave === "imposto_padrao_pct");
        setImpostoPct(o.imposto_pct ?? (impCfg ? Number(impCfg.valor) : 10));
        setObsOrc(o.observacoes || "");
      }
      setCarregando(false);
    }
    init();
  }, [lead.id]);

  // Adiciona item ao orçamento: se já existe e usuário clicar, incrementa qtd
  function addItem(sup: Suprimento) {
    // Verifica se já existe algum item com esse suprimento_id (sem variação específica)
    // Incrementa o ÚLTIMO item desse tipo adicionado
    const existentes = itens.filter(i => i.suprimento_id === sup.id);
    if (existentes.length > 0) {
      const ultimo = existentes[existentes.length - 1];
      setItens(its => its.map(i =>
        (i as ItemOrcamento & { _uid: number })._uid === (ultimo as ItemOrcamento & { _uid: number })._uid
          ? { ...i, quantidade: i.quantidade + 1 }
          : i
      ));
    } else {
      const uid = proximoId;
      setProximoId(n => n + 1);
      setItens(its => [...its, {
        suprimento_id: sup.id,
        nome: sup.nome,
        unidade: sup.unidade,
        custo_unitario: sup.custo_unitario,
        quantidade: 1,
        descricao: "",
        _uid: uid,
      } as ItemOrcamento & { _uid: number }]);
    }
  }

  // Adiciona NOVA variação do item (mesmo produto, linha separada)
  function addVariacao(sup: Suprimento) {
    const uid = proximoId;
    setProximoId(n => n + 1);
    setItens(its => [...its, {
      suprimento_id: sup.id,
      nome: sup.nome,
      unidade: sup.unidade,
      custo_unitario: sup.custo_unitario,
      quantidade: 1,
      descricao: "",
      _uid: uid,
    } as ItemOrcamento & { _uid: number }]);
  }

  function removeItem(uid: number) {
    setItens(its => its.filter(i => (i as ItemOrcamento & { _uid: number })._uid !== uid));
  }

  function setQtd(uid: number, qtd: number) {
    if (qtd <= 0) { removeItem(uid); return; }
    setItens(its => its.map(i =>
      (i as ItemOrcamento & { _uid: number })._uid === uid ? { ...i, quantidade: qtd } : i
    ));
  }

  function setPreco(uid: number, preco: number) {
    setItens(its => its.map(i =>
      (i as ItemOrcamento & { _uid: number })._uid === uid ? { ...i, custo_unitario: preco } : i
    ));
  }

  function setDescricao(uid: number, desc: string) {
    setItens(its => its.map(i =>
      (i as ItemOrcamento & { _uid: number })._uid === uid ? { ...i, descricao: desc } : i
    ));
  }

  // Cálculos de tempo e mão de obra
  const totalMinInstalacao = itens.reduce((acc, i) => {
    const sup = suprimentos.find(s => s.id === i.suprimento_id);
    return acc + (sup?.tempo_instalacao_min ?? 0) * i.quantidade;
  }, 0);
  const diasCampo = totalMinInstalacao > 0 ? Math.ceil(totalMinInstalacao / MIN_DIA) : 0;

  // Custo MO por profissional — dois modelos:
  // "diaria"      → custo_diario × diasCampo (pedreiro, técnico, ajudante)
  // "por_unidade" → custo_unitario × quantidade total de portas vinculadas ao profissional (pintor)
  const profIdsNecessarios = new Set<string>();
  itens.forEach(i => {
    const sup = suprimentos.find(s => s.id === i.suprimento_id);
    (sup?.profissionais_ids ?? []).forEach(pid => profIdsNecessarios.add(pid));
  });

  const custoPorProfissional = profissionais
    .filter(p => profIdsNecessarios.has(p.id))
    .map(p => {
      let total = 0;
      let descCobranca = "";
      if (p.tipo_cobranca === "por_unidade") {
        // soma as quantidades de todos os itens vinculados a este profissional
        const qtdTotal = itens.reduce((acc, i) => {
          const sup = suprimentos.find(s => s.id === i.suprimento_id);
          return (sup?.profissionais_ids ?? []).includes(p.id) ? acc + i.quantidade : acc;
        }, 0);
        total = p.custo_unitario * qtdTotal;
        descCobranca = `${qtdTotal} un × ${fmt(p.custo_unitario)}`;
      } else {
        total = p.custo_diario * diasCampo;
        descCobranca = `${diasCampo}d × ${fmt(p.custo_diario)}`;
      }
      return { id: p.id, nome: p.nome, especialidade: p.especialidade, total, descCobranca };
    });
  const custoMO = custoPorProfissional.reduce((acc, p) => acc + p.total, 0);

  // Cálculos financeiros (MO entra na base de custo)
  const custoMateriais = itens.reduce((acc, i) => acc + i.custo_unitario * i.quantidade, 0);
  const custoTotal = custoMateriais + custoMO;
  const valorMargem = custoTotal * (margemPct / 100);
  const subtotalComMargem = custoTotal + valorMargem;
  const valorImposto = subtotalComMargem * (impostoPct / 100);
  const precoFinal = subtotalComMargem + valorImposto;

  // Margem real sobre preço de venda (para o semáforo)
  // margem_real = (precoFinal - custoTotal - valorImposto) / precoFinal * 100
  const margemRealPct = precoFinal > 0 ? ((precoFinal - custoTotal - valorImposto) / precoFinal) * 100 : 0;

  async function salvarOrcamento() {
    setSalvando(true);
    // Remove _uid antes de salvar (campo interno de controle)
    const itensSalvar = itens.map(({ ...i }) => {
      const item = i as ItemOrcamento & { _uid?: number };
      delete item._uid;
      return item;
    });
    const payload: Orcamento = {
      lead_id: lead.id,
      itens: itensSalvar,
      custo_total: custoTotal,
      margem_pct: margemPct,
      imposto_pct: impostoPct,
      preco_final: precoFinal,
      observacoes: obsOrc,
    };
    if (orcamentoExistente?.id) {
      await supabase.from("crm_orcamentos").update(payload).eq("id", orcamentoExistente.id);
    } else {
      const { data } = await supabase.from("crm_orcamentos").insert(payload).select().single();
      if (data) setOrcamentoExistente(data as Orcamento);
    }
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  const supFiltrados = suprimentos.filter(s =>
    !busca || s.nome.toLowerCase().includes(busca.toLowerCase()) || s.codigo?.toLowerCase().includes(busca.toLowerCase())
  );

  if (carregando) return <div className="flex items-center justify-center py-12 text-sm text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando catálogo…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#1a6b2f]" />
          <span className="text-sm font-semibold text-gray-800">Calculadora de Orçamento</span>
          {orcamentoExistente && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">SALVO</span>}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Catálogo de suprimentos */}
        <div className="w-[260px] flex-shrink-0 border-r border-gray-100 flex flex-col">
          <div className="px-3 pt-3 pb-2">
            <input type="text" placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#1a6b2f]" />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {supFiltrados.length === 0 && (
              <div className="py-6 text-center">
                <ShoppingCart className="h-6 w-6 text-gray-200 mx-auto mb-1" />
                <p className="text-xs text-gray-300">Nenhum suprimento</p>
              </div>
            )}
            {supFiltrados.map(s => {
              const qtdTotal = itens.filter(i => i.suprimento_id === s.id).reduce((acc, i) => acc + i.quantidade, 0);
              const variacoes = itens.filter(i => i.suprimento_id === s.id).length;
              const adicionado = qtdTotal > 0;
              return (
                <div key={s.id} className={cn("rounded-lg border transition-colors", adicionado ? "border-green-200 bg-green-50" : "border-transparent")}>
                  <button onClick={() => addItem(s)} className="w-full text-left px-2.5 py-2 hover:bg-green-50/60 rounded-lg">
                    <p className="text-xs font-medium text-gray-800 leading-tight">{s.nome}</p>
                    <p className="text-[10px] text-[#1a6b2f] font-semibold mt-0.5">{fmt(s.custo_unitario)}/{s.unidade}</p>
                    {adicionado && (
                      <p className="text-[10px] text-green-600 mt-0.5">
                        ✓ {qtdTotal} {s.unidade}{variacoes > 1 ? ` · ${variacoes} variações` : ""}
                      </p>
                    )}
                  </button>
                  {/* Botão para adicionar variação separada */}
                  {adicionado && (
                    <button onClick={() => addVariacao(s)}
                      className="w-full text-[10px] text-green-700 font-semibold px-2.5 pb-1.5 text-left hover:text-green-900 flex items-center gap-1">
                      <Plus className="h-2.5 w-2.5" /> Adicionar variação
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Área principal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Itens selecionados */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">Clique nos itens ao lado para adicionar</p>
              </div>
            ) : itens.map(item => {
              const uid = (item as ItemOrcamento & { _uid: number })._uid;
              // Busca o preço de referência do catálogo
              const supRef = suprimentos.find(s => s.id === item.suprimento_id);
              return (
                <div key={uid} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
                  {/* Linha 1: nome + controles de qtd + total + remover */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{item.nome}</p>
                      {/* Campo de descrição/variação */}
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={e => setDescricao(uid, e.target.value)}
                        placeholder="Descrição / variação (ex: 90min, 0,80×2,10m)…"
                        className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600 outline-none focus:border-[#1a6b2f] placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setQtd(uid, item.quantidade - 1)} className="w-5 h-5 rounded bg-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-300 flex items-center justify-center">−</button>
                      <input type="number" min={1} value={item.quantidade} onChange={e => setQtd(uid, Number(e.target.value))}
                        className="w-10 text-center text-xs border border-gray-200 rounded px-1 py-0.5 bg-white outline-none focus:border-[#1a6b2f]" />
                      <button onClick={() => setQtd(uid, item.quantidade + 1)} className="w-5 h-5 rounded bg-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-300 flex items-center justify-center">+</button>
                      <button onClick={() => removeItem(uid)} className="text-gray-300 hover:text-red-500 ml-1"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {/* Linha 2: preço de compra editável + subtotal */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">Preço compra</label>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.custo_unitario}
                        onChange={e => setPreco(uid, Number(e.target.value))}
                        className="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-center outline-none focus:border-[#1a6b2f]"
                      />
                      <span className="text-[10px] text-gray-400">/{item.unidade}</span>
                      {supRef && supRef.custo_unitario !== item.custo_unitario && (
                        <span className="text-[10px] text-amber-500 font-medium">
                          ref: {fmt(supRef.custo_unitario)}
                        </span>
                      )}
                      {supRef && supRef.custo_unitario === item.custo_unitario && supRef.custo_unitario > 0 && (
                        <span className="text-[10px] text-gray-300">ref: {fmt(supRef.custo_unitario)}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0">{fmt(item.custo_unitario * item.quantidade)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Painel de parâmetros e resultado */}
          <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
            {/* Parâmetros */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Margem de lucro (%)</label>
                <input type="number" min={0} max={100} step={0.5} value={margemPct}
                  onChange={e => setMargemPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  Imposto / Encargos (%)
                  <span className="ml-1 font-normal text-gray-300 normal-case tracking-normal">· alíquota fiscal</span>
                </label>
                <input type="number" min={0} max={100} step={0.5} value={impostoPct}
                  onChange={e => setImpostoPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              </div>
            </div>

            {/* Tempo de instalação */}
            {totalMinInstalacao > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 flex items-start gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-blue-700">
                    {totalMinInstalacao < 60
                      ? `${totalMinInstalacao} min`
                      : `${Math.floor(totalMinInstalacao / 60)}h${totalMinInstalacao % 60 > 0 ? `${totalMinInstalacao % 60}min` : ""}`}
                    {" "}de instalação estimada
                  </span>
                  <span className="text-blue-500 ml-1">
                    = {diasCampo} {diasCampo === 1 ? "dia" : "dias"} de roteiro
                    {custoMO > 0 && ` · MO: ${fmt(custoMO)}`}
                  </span>
                </div>
              </div>
            )}

            {/* Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Materiais</span><span className="font-semibold text-gray-700">{fmt(custoMateriais)}</span>
              </div>
              {custoPorProfissional.map(p => (
                <div key={p.id} className="flex justify-between text-gray-500">
                  <span>{p.especialidade || p.nome} ({p.descCobranca})</span>
                  <span className="font-semibold text-blue-600">+ {fmt(p.total)}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-500">
                <span>Margem ({margemPct}%)</span><span className="font-semibold text-green-600">+ {fmt(valorMargem)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Impostos/Encargos ({impostoPct}%)</span><span className="font-semibold text-orange-500">+ {fmt(valorImposto)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-bold text-gray-900">
                <span>Preço de venda sugerido</span><span className="text-[#1a6b2f] text-base">{fmt(precoFinal)}</span>
              </div>

              {/* Semáforo de margem */}
              {itens.length > 0 && (() => {
                const abaixoMin = margemRealPct < margemMin;
                const abaixoIdeal = margemRealPct < margemIdeal;
                const cor = abaixoMin
                  ? "bg-red-50 border-red-200 text-red-700"
                  : abaixoIdeal
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-green-50 border-green-200 text-green-700";
                const emoji = abaixoMin ? "🔴" : abaixoIdeal ? "🟡" : "🟢";
                const msg = abaixoMin
                  ? `Margem abaixo do mínimo (${margemMin}%)`
                  : abaixoIdeal
                  ? `Margem aceitável — ideal é ${margemIdeal}%`
                  : `Margem excelente!`;
                return (
                  <div className={cn("mt-1 flex items-center justify-between rounded-lg border px-2.5 py-1.5", cor)}>
                    <span className="flex items-center gap-1.5 font-semibold text-xs">
                      <span>{emoji}</span>
                      <span>{msg}</span>
                    </span>
                    <span className="font-bold text-sm">{margemRealPct.toFixed(1)}%</span>
                  </div>
                );
              })()}
            </div>

            {/* Observações */}
            <textarea rows={2} value={obsOrc} onChange={e => setObsOrc(e.target.value)}
              placeholder="Observações do orçamento…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none outline-none focus:border-[#1a6b2f]" />

            {/* Salvar */}
            <button onClick={salvarOrcamento} disabled={salvando || itens.length === 0}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors",
                salvo ? "bg-green-500" : "bg-[#1a6b2f] hover:bg-[#155824]",
                (salvando || itens.length === 0) && "opacity-50 cursor-not-allowed"
              )}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {salvo ? "Orçamento salvo!" : salvando ? "Salvando…" : "Salvar orçamento no card"}
            </button>

            {itens.length === 0 && (
              <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" /> Adicione ao menos um item para salvar
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Orçamento de Contrato de Manutenção 12x ─────────────────────────────────
function OrcamentoManutencao({ lead }: { lead: Lead }) {
  const [portas, setPortas] = useState(20);
  const [parcela, setParcela] = useState(300);
  const [custoCorretivo, setCustoCorretivo] = useState(280);
  const [frequencia, setFrequencia] = useState(1.5);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [copiado, setCopiado] = useState<"texto" | "zap" | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Número de proposta único por sessão
  const numProposta = useRef(`PB-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`);

  // Cálculos
  const corrAnual = portas * custoCorretivo * frequencia;
  const corrMensal = corrAnual / 12;
  const economia = corrMensal - parcela;
  const economiaAnual = economia * 12;
  const porPorta = portas > 0 ? parcela / portas : 0;
  const porDia = parcela / 30; // custo diário TOTAL do plano

  function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function copiar(texto: string, tipo: "texto" | "zap") {
    navigator.clipboard.writeText(texto).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopiado(tipo);
    setTimeout(() => setCopiado(null), 2500);
  }

  async function gerarPDF() {
    setGerandoPdf(true);
    try {
      // Carrega pdfmake dinamicamente se ainda não estiver presente
      if (!(window as Record<string, unknown>).pdfMake) {
        await new Promise<void>((resolve, reject) => {
          const s1 = document.createElement("script");
          s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js";
          s1.onload = () => {
            const s2 = document.createElement("script");
            s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js";
            s2.onload = () => resolve();
            s2.onerror = reject;
            document.head.appendChild(s2);
          };
          s1.onerror = reject;
          document.head.appendChild(s1);
        });
      }

      const pm = (window as Record<string, unknown>).pdfMake as {
        createPdf: (def: unknown) => { download: (name: string) => void };
      };

      const verde = "#1a6b2f";
      const laranja = "#C94500";
      const cinza = "#6b7280";
      const data = new Date().toLocaleDateString("pt-BR");
      const nomeArquivo = `${numProposta.current}_${(lead.empresa || lead.nome || "PORTIBRAS").replace(/\s+/g, "_")}.pdf`;

      const docDef = {
        pageSize: "A4",
        pageMargins: [48, 48, 48, 48],
        defaultStyle: { font: "Roboto", fontSize: 10, color: "#1f2937" },
        content: [
          // Cabeçalho — logo + dados lead
          {
            columns: [
              {
                stack: [
                  { text: "PORTIBRAS", fontSize: 26, bold: true, color: "#1f2937", characterSpacing: 1 },
                  { text: "SOLUÇÕES EM PORTAS CORTA-FOGO · NBR 11.742", fontSize: 7, color: cinza, characterSpacing: 0.5, margin: [0, 2, 0, 0] },
                ],
              },
              {
                stack: [
                  { text: `Para: ${lead.empresa || lead.nome || "—"}`, fontSize: 9, bold: true, alignment: "right", color: "#1f2937" },
                  { text: `Responsável: ${lead.nome || "—"}`, fontSize: 9, color: "#1f2937", alignment: "right" },
                  { text: `Data: ${data}`, fontSize: 9, color: "#1f2937", alignment: "right" },
                  { text: `Proposta nº ${numProposta.current}`, fontSize: 9, bold: true, color: laranja, alignment: "right", margin: [0, 2, 0, 0] },
                ],
              },
            ],
          },
          { canvas: [{ type: "line", x1: 0, y1: 6, x2: 499, y2: 6, lineWidth: 1.5, lineColor: "#e5e7eb" }], margin: [0, 8, 0, 14] },

          // A SITUAÇÃO ATUAL
          { text: "A SITUAÇÃO ATUAL", fontSize: 8, bold: true, color: laranja, characterSpacing: 1, margin: [0, 0, 0, 6] },
          {
            text: "Portas corta-fogo são equipamentos críticos de segurança, exigidos pela NBR 11.742:2018 e fiscalizados pelo Corpo de Bombeiros. Sem manutenção preventiva, elas degradam silenciosamente — e podem falhar quando mais importam.",
            fontSize: 9, color: "#374151", lineHeight: 1.5, margin: [0, 0, 0, 8],
          },
          {
            text: "Manutenção corretiva parece econômica, mas soma rápido: custo de visita emergencial, peças fora de programa e porta inoperante. Sem laudo DTS atualizado, o condomínio fica exposto a multas e responsabilidade civil.",
            fontSize: 9, color: "#374151", lineHeight: 1.5, margin: [0, 0, 0, 14],
          },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 14] },

          // NOSSA PROPOSTA
          { text: "NOSSA PROPOSTA", fontSize: 8, bold: true, color: laranja, characterSpacing: 1, margin: [0, 0, 0, 6] },
          {
            text: [
              { text: "Plano de Manutenção Preventiva Parcelado em 12× ", bold: true },
              { text: "— sem fidelidade oculta, sem surpresas. São " },
              { text: "2 roteiros completos de manutenção por ano", bold: true },
              { text: " (a cada 6 meses), com laudo técnico DTS incluído em cada visita." },
            ],
            fontSize: 9, color: "#374151", lineHeight: 1.5, margin: [0, 0, 0, 14],
          },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 14] },

          // O QUE ESTÁ INCLUÍDO
          { text: "O QUE ESTÁ INCLUÍDO", fontSize: 8, bold: true, color: laranja, characterSpacing: 1, margin: [0, 0, 0, 6] },
          {
            ul: [
              `2 roteiros completos de manutenção/ano (a cada 6 meses) nas ${portas} portas`,
              "Ajustes de mola, lubrificação de dobradiças e regulagem de batentes",
              "Laudo técnico DTS em cada roteiro de manutenção (NBR 11.742:2018)",
              "Registro fotográfico antes e depois de cada serviço",
              "Atendimento prioritário em emergências — incluído no plano",
              "Conformidade plena com a NBR 11.742:2018",
            ],
            fontSize: 9, color: "#374151", lineHeight: 1.6, margin: [0, 0, 0, 16],
          },

          // Box 12 PARCELAS
          {
            table: {
              widths: ["*"],
              body: [[
                {
                  stack: [
                    { text: "12 PARCELAS MENSAIS DE", fontSize: 8, bold: true, color: laranja, alignment: "center", characterSpacing: 1, margin: [0, 0, 0, 4] },
                    { text: fmtBRL(parcela), fontSize: 32, bold: true, color: laranja, alignment: "center" },
                    { text: `${portas} portas · ${fmtBRL(porPorta)}/porta/mês · ${fmtBRL(porDia)}/dia total`, fontSize: 8, color: cinza, alignment: "center", margin: [0, 4, 0, 0] },
                  ],
                  border: [true, true, true, true],
                  borderColor: [laranja, laranja, laranja, laranja],
                  margin: [16, 14, 16, 14],
                },
              ]],
            },
            margin: [0, 0, 0, 16],
          },

          // COMPARATIVO
          { text: "COMPARATIVO", fontSize: 8, bold: true, color: laranja, characterSpacing: 1, margin: [0, 0, 0, 6] },
          {
            table: {
              widths: ["*", "auto", "auto"],
              headerRows: 1,
              body: [
                [
                  { text: "", border: [false, false, false, true] },
                  { text: "Sem Plano", bold: true, color: cinza, fontSize: 8, alignment: "right", border: [false, false, false, true] },
                  { text: "Com PORTIBRAS", bold: true, color: laranja, fontSize: 8, alignment: "right", border: [false, false, false, true] },
                ],
                [
                  { text: "Custo mensal", fontSize: 9, border: [false, false, false, false] },
                  { text: "R$ 0*", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                  { text: fmtBRL(parcela), color: laranja, bold: true, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                ],
                [
                  { text: "Visita emergencial", fontSize: 9, border: [false, false, false, false] },
                  { text: `${fmtBRL(custoCorretivo)}+`, color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                  { text: "Incluída", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                ],
                [
                  { text: "Laudo técnico DTS", fontSize: 9, border: [false, false, false, false] },
                  { text: "Separado", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                  { text: "Incluído", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                ],
                [
                  { text: "Conformidade NBR", fontSize: 9, border: [false, false, false, false] },
                  { text: "Risco", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                  { text: "Garantida", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                ],
                [
                  { text: "Previsibilidade", fontSize: 9, border: [false, false, false, false] },
                  { text: "Não", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                  { text: "Sim", color: laranja, fontSize: 9, alignment: "right", border: [false, false, false, false] },
                ],
              ],
            },
            layout: { hLineColor: "#e5e7eb", vLineColor: "#ffffff", hLineWidth: () => 0.5 },
            margin: [0, 0, 0, 4],
          },
          { text: `* Até a primeira emergência — custo estimado de ${fmtBRL(corrAnual)}/ano sem plano`, fontSize: 7, color: cinza, margin: [0, 2, 0, 14] },

          // Bloco economia
          ...(economia > 0 ? [{
            columns: [
              {
                stack: [
                  { text: "ECONOMIA ESTIMADA/MÊS", fontSize: 7, bold: true, color: verde, characterSpacing: 0.5 },
                  { text: fmtBRL(economia), fontSize: 20, bold: true, color: verde, margin: [0, 2, 0, 0] },
                ],
                margin: [12, 10, 12, 10],
              },
              {
                stack: [
                  { text: "ECONOMIA ESTIMADA/ANO", fontSize: 7, bold: true, color: verde, characterSpacing: 0.5 },
                  { text: fmtBRL(economiaAnual), fontSize: 20, bold: true, color: verde, margin: [0, 2, 0, 0] },
                ],
                margin: [12, 10, 12, 10],
              },
            ],
            margin: [0, 0, 0, 16],
          }] : []),

          // PRÓXIMO PASSO
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 12] },
          { text: "PRÓXIMO PASSO", fontSize: 8, bold: true, color: laranja, characterSpacing: 1, margin: [0, 0, 0, 6] },
          {
            text: "Entre em contato e receba uma proposta detalhada sem compromisso. Nossa equipe apresenta o plano completo, confirma os valores e responde todas as dúvidas — por telefone, WhatsApp ou e-mail.",
            fontSize: 9, color: "#374151", lineHeight: 1.5, margin: [0, 0, 0, 20],
          },

          // Rodapé
          {
            columns: [
              {
                stack: [
                  { text: "PORTIBRAS", fontSize: 9, bold: true, color: "#1f2937" },
                  { text: "(22) 99104-8162", fontSize: 8, color: cinza },
                  { text: "vendas@portibras.com.br", fontSize: 8, color: cinza },
                ],
              },
              {
                table: {
                  widths: ["*"],
                  body: [[{ text: "Solicitar Orçamento", color: "#ffffff", bold: true, fontSize: 9, alignment: "center", margin: [12, 6, 12, 6], fillColor: laranja, border: [false, false, false, false] }]],
                },
                alignment: "right",
              },
            ],
          },
        ],
      };

      pm.createPdf(docDef).download(nomeArquivo);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  }

  function buildTexto(whatsapp: boolean) {
    const hr = whatsapp ? "━━━━━━━━━━━━━━━━━━━━━━━━" : "────────────────────────────────";
    const b = (s: string) => whatsapp ? `*${s}*` : s;
    const i = (s: string) => whatsapp ? `_${s}_` : s;
    const lines = [
      b("PORTIBRAS"),
      i("Soluções em Portas Corta-Fogo · NBR 11.742"),
      hr,
      `Para: ${b(lead.empresa || lead.nome || "—")}`,
      `Responsável: ${b(lead.nome || "—")}`,
      lead.endereco_fiscal ? `Endereço: ${lead.endereco_fiscal}` : "",
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      `Proposta nº ${numProposta.current}`,
      hr,
      "",
      b("A SITUAÇÃO ATUAL"),
      "",
      "Portas corta-fogo são equipamentos críticos de segurança, exigidos pela NBR 11.742:2018 e fiscalizados pelo Corpo de Bombeiros. Sem manutenção preventiva, elas degradam silenciosamente — e podem falhar quando mais importam.",
      "",
      "Manutenção corretiva parece econômica, mas soma rápido: custo de visita emergencial, peças fora de programa e porta inoperante. Sem laudo DTS atualizado, o condomínio fica exposto a multas e responsabilidade civil.",
      "",
      hr,
      b("NOSSA PROPOSTA"),
      "",
      `Plano de Manutenção Preventiva Parcelado em ${b("12×")} — sem fidelidade oculta, sem surpresas. São ${b("2 roteiros completos de manutenção por ano")} (a cada 6 meses), com laudo técnico DTS incluído em cada visita.`,
      "",
      b("O QUE ESTÁ INCLUÍDO"),
      "",
      `✓ 2 roteiros completos de manutenção/ano (a cada 6 meses) nas ${b(String(portas) + " portas")}`,
      "✓ Ajustes de mola, lubrificação de dobradiças e regulagem de batentes",
      "✓ Laudo técnico DTS em cada roteiro de manutenção (NBR 11.742:2018)",
      "✓ Registro fotográfico antes e depois de cada serviço",
      "✓ Atendimento prioritário em emergências — incluído no plano",
      "✓ Conformidade plena com a NBR 11.742:2018",
      "",
      hr,
      b(`12 PARCELAS MENSAIS DE ${fmtBRL(parcela)}`),
      `${portas} portas · ${fmtBRL(porPorta)}/porta/mês · ${fmtBRL(porDia)}/dia total`,
      "",
      ...(economia > 0 ? [
        hr,
        `${b("ECONOMIA ESTIMADA/MÊS:")} ${fmtBRL(economia)}`,
        `${b("ECONOMIA ESTIMADA/ANO:")} ${fmtBRL(economiaAnual)}`,
        "",
      ] : []),
      hr,
      b("PRÓXIMO PASSO"),
      "",
      "Entre em contato e receba uma proposta detalhada sem compromisso. Nossa equipe apresenta o plano completo, confirma os valores e responde todas as dúvidas — por telefone, WhatsApp ou e-mail.",
      "",
      "📞 (22) 99104-8162",
      "✉ vendas@portibras.com.br",
      "",
      "PORTIBRAS — Soluções em Portas Corta-Fogo",
    ].filter(l => l !== undefined).join("\n");
    return lines;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-5">
      {/* Calculadora */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Simulador de Manutenção 12×</p>
        <p className="text-xs text-gray-400 mb-4">Defina o número de portas e a parcela mensal para calcular a proposta</p>

        {/* Portas */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Número de portas</label>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-[#1a6b2f] w-16 tabular-nums">{portas}</span>
            <div className="flex-1">
              <input
                type="range" min={1} max={200} value={portas}
                onChange={e => setPortas(Number(e.target.value))}
                className="w-full accent-[#1a6b2f]"
              />
              <input
                type="number" min={1} max={999} value={portas}
                onChange={e => setPortas(Math.max(1, Number(e.target.value)))}
                className="mt-1 w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]"
              />
            </div>
          </div>
        </div>

        {/* Parcela */}
        <div className="rounded-lg border-2 border-[#1a6b2f] bg-green-50/60 p-4 mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1a6b2f] mb-2">Parcela mensal desejada</label>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#1a6b2f]">R$</span>
            <input
              type="number" min={1} step={10} value={parcela}
              onChange={e => setParcela(Math.max(1, Number(e.target.value)))}
              className="w-36 rounded-lg border-2 border-[#1a6b2f] bg-white px-3 py-2 text-2xl font-bold text-[#1a6b2f] text-center outline-none focus:ring-2 focus:ring-[#1a6b2f]/30"
            />
            <span className="text-xs text-gray-400">= <strong className="text-gray-700">{fmtBRL(porPorta)}</strong>/porta</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-green-50 border border-green-100 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1a6b2f] mb-1">Parcela mensal</p>
            <p className="text-lg font-bold text-[#1a6b2f]">{fmtBRL(parcela)}</p>
            <p className="text-[10px] text-gray-400">12× mensais</p>
          </div>
          <div className={cn("rounded-lg border p-3", economia > 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Economia/mês</p>
            <p className={cn("text-lg font-bold", economia > 0 ? "text-green-600" : "text-red-500")}>
              {economia > 0 ? fmtBRL(economia) : "—"}
            </p>
            <p className="text-[10px] text-gray-400">vs. corretiva</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Economia/ano</p>
            <p className="text-lg font-bold text-gray-700">{economiaAnual > 0 ? fmtBRL(economiaAnual) : "—"}</p>
            <p className="text-[10px] text-gray-400">período total</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          Custo diário total do plano: <strong className="text-gray-700">{fmtBRL(porDia)}/dia</strong>
        </p>

        {/* Config corretiva */}
        <button
          onClick={() => setMostrarConfig(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
        >
          <Calculator className="h-3.5 w-3.5" />
          Ajustar parâmetros da corretiva
          <ChevronRight className={cn("h-3 w-3 transition-transform", mostrarConfig && "rotate-90")} />
        </button>
        {mostrarConfig && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Parâmetros de referência</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700">Custo médio por chamado (R$)</p>
                <p className="text-[10px] text-gray-400">Valor médio de uma visita corretiva avulsa</p>
              </div>
              <input
                type="number" min={1} value={custoCorretivo}
                onChange={e => setCustoCorretivo(Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-right outline-none focus:border-[#1a6b2f]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700">Chamados/porta/ano</p>
                <p className="text-[10px] text-gray-400">Sem manutenção preventiva</p>
              </div>
              <input
                type="number" min={0.1} max={10} step={0.1} value={frequencia}
                onChange={e => setFrequencia(Math.max(0.1, Number(e.target.value)))}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-right outline-none focus:border-[#1a6b2f]"
              />
            </div>
          </div>
        )}

        {/* Aviso NBR */}
        <div className="rounded-lg bg-amber-50 border-l-4 border-amber-400 p-3 flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700 leading-relaxed">
            Sem laudo DTS documentado, o condomínio está em <strong className="text-amber-700">não conformidade com a NBR 11.742:2018</strong> — sujeito a autuação pelo Corpo de Bombeiros. O plano preventivo inclui laudo técnico DTS em cada roteiro.
          </p>
        </div>
      </div>

      {/* Prévia da proposta */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Prévia da proposta</p>

        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-base font-bold tracking-widest text-gray-900">PORTIBRAS</p>
            <p className="text-[9px] text-gray-400 tracking-wide">SOLUÇÕES EM PORTAS CORTA-FOGO · NBR 11.742</p>
            <p className="text-[10px] text-[#C94500] font-semibold mt-0.5">Proposta nº {numProposta.current}</p>
          </div>
          <div className="text-right text-[10px] text-gray-500 leading-relaxed">
            <div>Para: <strong className="text-gray-800">{lead.empresa || lead.nome || "—"}</strong></div>
            <div>Responsável: <strong className="text-gray-800">{lead.nome || "—"}</strong></div>
            <div>Data: <strong className="text-gray-800">{new Date().toLocaleDateString("pt-BR")}</strong></div>
          </div>
        </div>
        <div className="h-0.5 bg-[#C94500] rounded mb-3" />

        <p className="text-[9px] font-bold uppercase tracking-widest text-[#C94500] mb-1">Nossa Proposta</p>
        <p className="text-xs text-gray-700 mb-1.5 leading-relaxed">
          <strong>Plano de Manutenção Preventiva Parcelado em 12×</strong> — sem fidelidade oculta, sem surpresas — para <strong>{portas} portas</strong>, com 2 roteiros completos/ano (a cada 6 meses) e laudo técnico incluído em cada visita.
        </p>

        {/* O que está incluído */}
        <ul className="mb-3 space-y-0.5">
          {[
            "2 roteiros completos de manutenção preventiva/ano",
            "Laudo técnico DTS em cada roteiro",
            "Peças de desgaste incluídas",
            "Atendimento emergencial prioritário",
            "Relatório fotográfico por visita",
            "Conformidade plena com a NBR 11.742:2018",
          ].map(item => (
            <li key={item} className="flex items-start gap-1 text-[10px] text-gray-700">
              <span className="text-[#C94500] font-bold mt-px">✓</span>
              {item}
            </li>
          ))}
        </ul>

        {/* Investimento */}
        <div className="rounded-lg bg-[#FFF2EC] border-2 border-[#C94500] p-3 text-center mb-3">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#C94500] mb-0.5">12 Parcelas Mensais de</p>
          <p className="text-2xl font-bold text-[#C94500]">{fmtBRL(parcela)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{portas} portas · {fmtBRL(porPorta)}/porta/mês · {fmtBRL(porDia)}/dia total</p>
        </div>

        {/* Tabela comparativa */}
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[10.5px] border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-2 py-1.5 text-gray-500 font-semibold" />
                <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Sem Plano</th>
                <th className="text-left px-2 py-1.5 text-gray-500 font-semibold text-[#1a6b2f]">Com PORTIBRAS</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Custo mensal", "R$ 0*", fmtBRL(parcela)],
                ["Visita emergencial", fmtBRL(custoCorretivo) + "+", "Incluída ✓"],
                ["Laudo técnico DTS", "Separado ✗", "Incluído ✓"],
                ["Conformidade NBR", "Risco ✗", "Garantida ✓"],
                ["Previsibilidade", "Nenhuma ✗", "Total ✓"],
              ].map(([row, sem, com]) => (
                <tr key={row} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-600">{row}</td>
                  <td className="px-2 py-1.5 text-red-500">{sem}</td>
                  <td className="px-2 py-1.5 text-[#1a6b2f] font-semibold">{com}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] text-gray-400 mt-1">* Até a primeira emergência — custo estimado de {fmtBRL(corrAnual)}/ano sem plano</p>
        </div>

        {/* Economia */}
        {economia > 0 && (
          <div className="rounded-lg bg-green-50 border border-green-100 p-3 flex justify-around mb-3">
            <div className="text-center">
              <p className="text-[9px] font-medium text-green-700 mb-0.5">Economia/mês</p>
              <p className="text-base font-bold text-green-700">{fmtBRL(economia)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-medium text-green-700 mb-0.5">Economia/ano</p>
              <p className="text-base font-bold text-green-700">{fmtBRL(economiaAnual)}</p>
            </div>
          </div>
        )}

        {/* Próximo passo */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Próximo Passo</p>
          <p className="text-[10px] text-gray-700 leading-relaxed">
            Confirme o número de portas e a data preferida para a primeira visita técnica. Emitimos o contrato digital em até 24 h e agendamos o 1º roteiro sem custo adicional. <strong>Sem fidelidade oculta</strong> — caso não esteja satisfeito, basta comunicar com 30 dias de antecedência.
          </p>
        </div>

        <div className="h-px bg-gray-100 mb-3" />
        <div className="flex justify-between items-end">
          <div className="text-[10px] text-gray-500 leading-relaxed">
            <strong>PORTIBRAS</strong><br />
            📞 (22) 99104-8162<br />
            ✉ vendas@portibras.com.br
          </div>
          <div className="rounded-md bg-[#C94500] text-white px-3 py-1.5 text-[10px] font-bold">
            Solicitar Orçamento
          </div>
        </div>
      </div>

      {/* Botões de exportação */}
      <div className="flex gap-2 flex-wrap pb-2">
        <button
          onClick={() => copiar(buildTexto(false), "texto")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors",
            copiado === "texto" ? "bg-green-500" : "bg-[#1a6b2f] hover:bg-[#155824]"
          )}
        >
          {copiado === "texto" ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {copiado === "texto" ? "Copiado!" : "Copiar Proposta"}
        </button>
        <button
          onClick={() => copiar(buildTexto(true), "zap")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
            copiado === "zap" ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          {copiado === "zap" ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          {copiado === "zap" ? "Copiado!" : "Formato WhatsApp"}
        </button>
        <button
          onClick={gerarPDF}
          disabled={gerandoPdf}
          className="flex items-center gap-1.5 rounded-lg border border-[#C94500] px-4 py-2.5 text-sm font-medium text-[#C94500] hover:bg-orange-50 disabled:opacity-50 transition-colors"
        >
          {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [filtroEtapa, setFiltroEtapa] = useState<Etapa | "todas">("todas");
  const [filtroPrazo, setFiltroPrazo] = useState("");

  const [modal, setModal] = useState(false);
  const [selecionado, setSelecionado] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState("");

  const [cardAberto, setCardAberto] = useState<Lead | null>(null);
  const [abaCard, setAbaCard] = useState<"historico" | "orcamento" | "manutencao">("historico");
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
    const { data } = await supabase.from("crm_conversas").select("*").eq("lead_id", leadId).order("criado_em", { ascending: true });
    if (data) setConversas(data as Conversa[]);
    setTimeout(() => conversaRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
  }

  function abrirCard(lead: Lead) {
    setCardAberto(lead);
    setAbaCard("historico");
    carregarConversas(lead.id);
  }

  function abrirModal(lead?: Lead) {
    if (lead) { setSelecionado(lead); setForm({ ...lead }); }
    else { setSelecionado(null); setForm({ nome: "", empresa: "", cnpj: "", telefone: "", email: "", etapa: "prospecto", valor_estimado: null, observacoes: "", prazo: null, endereco_fiscal: "", endereco_atendimento: "" }); }
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
      const partes = [
        d.logradouro && d.numero ? `${d.logradouro}, ${d.numero}` : d.logradouro,
        d.complemento, d.bairro,
        d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : d.municipio,
        d.cep ? d.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
      ].filter(Boolean);
      setForm(f => ({
        ...f,
        empresa: d.razao_social || f.empresa,
        email: d.email || f.email,
        telefone: d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/\D/g, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : f.telefone,
        endereco_fiscal: partes.join(", ") || f.endereco_fiscal,
      }));
    } catch { setErroCNPJ("CNPJ não encontrado na Receita Federal."); }
    finally { setBuscandoCNPJ(false); }
  }

  async function salvar() {
    if (!form.nome?.trim()) return;
    const payload = { ...form, cnpj: form.cnpj?.replace(/\D/g, "") || "" };
    if (selecionado) await supabase.from("crm_leads").update(payload).eq("id", selecionado.id);
    else await supabase.from("crm_leads").insert(payload);
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
    await supabase.from("crm_conversas").insert({ lead_id: cardAberto.id, texto: novaMsg.trim(), autor: "Rafael" });
    setNovaMsg("");
    await carregarConversas(cardAberto.id);
    setEnviando(false);
  }

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
      <div className="flex flex-col flex-1 min-w-0 p-6 overflow-auto">
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
            <p className="mt-0.5 text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} na pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView("lista")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm", view === "lista" ? "bg-[#1a6b2f] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <LayoutList className="h-4 w-4" /> Lista
              </button>
              <button onClick={() => setView("kanban")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm", view === "kanban" ? "bg-[#1a6b2f] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <Columns className="h-4 w-4" /> Kanban
              </button>
            </div>
            <button onClick={() => abrirModal()} className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Lead
            </button>
          </div>
        </div>

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
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#1a6b2f]" />
            {filtroPrazo && <button onClick={() => setFiltroPrazo("")} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        <div className="mb-5 flex gap-2 flex-wrap">
          {ETAPA_ORDER.map(e => {
            const total = porEtapa[e].reduce((acc, l) => acc + (l.valor_estimado ?? 0), 0);
            return (
              <button key={e} onClick={() => setFiltroEtapa(filtroEtapa === e ? "todas" : e)}
                className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity", ETAPAS[e].bg, ETAPAS[e].cor, filtroEtapa !== "todas" && filtroEtapa !== e && "opacity-40")}>
                {ETAPAS[e].label} <span className="font-bold">({porEtapa[e].length})</span>
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
              <div className="flex flex-col items-center py-16 text-gray-400"><p className="text-sm">Nenhum lead encontrado</p></div>
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
                    {totalEtapa > 0 && <p className={cn("text-xs font-bold", cfg.cor)}>{totalEtapa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {cards.map(lead => {
                      const vencido = lead.prazo && lead.prazo < hoje;
                      return (
                        <div key={lead.id} onClick={() => abrirCard(lead)}
                          className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{lead.nome}</p>
                          {lead.empresa && <p className="mt-0.5 text-xs text-gray-400">{lead.empresa}</p>}
                          {lead.valor_estimado && <p className="mt-2 text-xs font-semibold text-[#1a6b2f]">{lead.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                          {lead.prazo && <p className={cn("mt-1 flex items-center gap-1 text-xs", vencido ? "text-red-500" : "text-gray-400")}><Calendar className="h-3 w-3" />{vencido && "⚠ "}{new Date(lead.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</p>}
                          {lead.telefone && <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Phone className="h-3 w-3" />{lead.telefone}</p>}
                        </div>
                      );
                    })}
                    {cards.length === 0 && <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-xs text-gray-300">Nenhum lead</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CARD DETALHADO — Modal fullscreen */}
      {cardAberto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => setCardAberto(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 flex-shrink-0" title="Fechar">
                <X className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{cardAberto.nome}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {cardAberto.empresa && <span className="text-sm text-gray-500">{cardAberto.empresa}</span>}
                  {cardAberto.cnpj && <span className="text-xs text-gray-400 font-mono">{formatCNPJ(cardAberto.cnpj)}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Etapas rápidas */}
              <div className="hidden md:flex items-center gap-1.5">
                {ETAPA_ORDER.map(e => (
                  <button key={e} onClick={() => mudarEtapa(cardAberto, e)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-all", cardAberto.etapa === e ? cn(ETAPAS[e].bg, ETAPAS[e].cor, ETAPAS[e].border, "ring-2 ring-offset-1", ETAPAS[e].border) : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100")}>
                    {ETAPAS[e].label}
                  </button>
                ))}
              </div>
              <button onClick={() => abrirModal(cardAberto)} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <Pencil className="h-4 w-4" /> Editar
              </button>
            </div>
          </div>

          {/* Etapas em mobile */}
          <div className="md:hidden px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap bg-white flex-shrink-0">
            {ETAPA_ORDER.map(e => (
              <button key={e} onClick={() => mudarEtapa(cardAberto, e)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-all", cardAberto.etapa === e ? cn(ETAPAS[e].bg, ETAPAS[e].cor, ETAPAS[e].border) : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100")}>
                {ETAPAS[e].label}
              </button>
            ))}
          </div>

          {/* Corpo: layout 2 colunas em desktop */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Coluna esquerda — info do lead */}
            <div className="w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50/40">
              {/* Dados de contato */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Contato</p>
                {cardAberto.telefone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <span>{cardAberto.telefone}</span>
                  </div>
                )}
                {cardAberto.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <span className="break-all">{cardAberto.email}</span>
                  </div>
                )}
                {cardAberto.valor_estimado && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <span className="font-semibold text-[#1a6b2f]">
                      {cardAberto.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                )}
                {cardAberto.prazo && (
                  <div className={cn("flex items-center gap-2 text-sm", cardAberto.prazo < hoje ? "text-red-500" : "text-gray-600")}>
                    <Calendar className="h-4 w-4 flex-shrink-0 text-gray-300" />
                    <span>{cardAberto.prazo < hoje && "⚠ "}{new Date(cardAberto.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
              </div>

              {/* Endereços */}
              {(cardAberto.endereco_fiscal || cardAberto.endereco_atendimento) && (
                <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                  {cardAberto.endereco_fiscal && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Endereço Fiscal</p>
                      <p className="flex items-start gap-1.5 text-sm text-gray-600">
                        <MapPin className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />{cardAberto.endereco_fiscal}
                      </p>
                    </div>
                  )}
                  {cardAberto.endereco_atendimento && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Endereço de Atendimento</p>
                      <p className="flex items-start gap-1.5 text-sm text-gray-600">
                        <Navigation className="h-3.5 w-3.5 text-[#1a6b2f] mt-0.5 flex-shrink-0" />{cardAberto.endereco_atendimento}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              {cardAberto.observacoes && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Observações</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{cardAberto.observacoes}</p>
                </div>
              )}
            </div>

            {/* Coluna direita — abas */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Abas */}
              <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
                <button onClick={() => setAbaCard("historico")}
                  className={cn("flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors",
                    abaCard === "historico" ? "border-[#1a6b2f] text-[#1a6b2f]" : "border-transparent text-gray-400 hover:text-gray-600")}>
                  <MessageSquare className="h-4 w-4" /> Histórico
                </button>
                <button onClick={() => setAbaCard("orcamento")}
                  className={cn("flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors",
                    abaCard === "orcamento" ? "border-[#1a6b2f] text-[#1a6b2f]" : "border-transparent text-gray-400 hover:text-gray-600")}>
                  <Calculator className="h-4 w-4" /> Orçamento
                </button>
                <button onClick={() => setAbaCard("manutencao")}
                  className={cn("flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors",
                    abaCard === "manutencao" ? "border-[#C94500] text-[#C94500]" : "border-transparent text-gray-400 hover:text-gray-600")}>
                  <FileText className="h-4 w-4" /> Manutenção 12×
                </button>
              </div>

              {/* Conteúdo da aba */}
              {abaCard === "historico" && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div ref={conversaRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
                    {conversas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                        <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma conversa registrada</p>
                      </div>
                    ) : conversas.map(c => (
                      <div key={c.id} className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700">{c.autor}</span>
                          <span className="text-xs text-gray-400">{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.texto}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-5 border-t border-gray-100 flex gap-3">
                    <textarea rows={2} value={novaMsg} onChange={e => setNovaMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }}}
                      placeholder="Registrar interação…"
                      className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
                    <button onClick={enviarMensagem} disabled={enviando || !novaMsg.trim()}
                      className="flex items-center justify-center rounded-lg bg-[#1a6b2f] px-4 text-white hover:bg-[#155824] disabled:opacity-40">
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {abaCard === "orcamento" && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CalculadoraOrcamento lead={cardAberto} onClose={() => setAbaCard("historico")} />
                </div>
              )}

              {abaCard === "manutencao" && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <OrcamentoManutencao lead={cardAberto} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal lead */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selecionado ? "Editar Lead" : "Novo Lead"}</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">CNPJ</label>
                <div className="flex gap-2">
                  <input type="text" value={formatCNPJ(form.cnpj || "")}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, cnpj: v })); setErroCNPJ(""); }}
                    placeholder="00.000.000/0001-00"
                    className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] font-mono" />
                  <button type="button" onClick={() => buscarCNPJ(form.cnpj || "")} disabled={buscandoCNPJ || (form.cnpj?.replace(/\D/g, "")?.length !== 14)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    {buscandoCNPJ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} Buscar
                  </button>
                </div>
                {erroCNPJ && <p className="mt-1 text-xs text-red-500">{erroCNPJ}</p>}
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
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
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
                  <input type="date" value={form.prazo || ""} onChange={e => setForm({ ...form, prazo: e.target.value || null })}
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
                <input type="text" value={form.endereco_fiscal ?? ""} onChange={e => setForm({ ...form, endereco_fiscal: e.target.value })}
                  placeholder="Rua, Nº, Bairro, Cidade - UF, CEP"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-[#1a6b2f]" /> Endereço de Atendimento / Entrega</span>
                </label>
                <input type="text" value={form.endereco_atendimento ?? ""} onChange={e => setForm({ ...form, endereco_atendimento: e.target.value })}
                  placeholder="Local onde será feito o serviço ou entrega"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Observações</label>
                <textarea rows={3} value={form.observacoes ?? ""} onChange={e => setForm({ ...form, observacoes: e.target.value })}
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
