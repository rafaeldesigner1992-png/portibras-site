import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, Plus, TrendingUp, TrendingDown, X, Settings2, Check,
  Loader2, Car, Building2, AlertTriangle, Trash2, Pencil,
  BarChart3, Target, Gauge, CreditCard, ChevronDown, ChevronUp, Info,
  RefreshCw, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle,
  FileText, Repeat
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Interfaces Conta Azul ────────────────────────────────────────────────────
interface CaVenda {
  id: string;
  numero: string | null;
  cliente_nome: string;
  valor_total: number;
  status: string;
  data_emissao: string | null;
  data_vencimento: string | null;
  observacao: string | null;
  sincronizado_em: string;
}

interface CaCobranca {
  id: string;
  descricao: string;
  cliente_nome: string | null;
  valor: number;
  vencimento: string | null;
  status: string;
  pago_em: string | null;
  valor_pago: number;
  tipo: string;
  sincronizado_em: string;
}

interface CaContrato {
  id: string;
  nome: string;
  cliente_nome: string;
  cliente_documento: string | null;
  valor: number;
  periodicidade: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  sincronizado_em: string;
}

interface CrmContrato {
  id: string;
  nome_arquivo: string;
  status: string;
  conteudo: { parcela?: number } | null;
  lead?: { nome: string; empresa: string };
}

interface CaSaldo {
  id: string;
  nome: string;
  tipo: string | null;
  saldo: number;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  ativo: boolean;
  sincronizado_em: string;
}

interface CaContaPagar {
  id: string;
  descricao: string;
  fornecedor_nome: string | null;
  valor: number;
  vencimento: string | null;
  status: string;
  pago_em: string | null;
  valor_pago: number;
  categoria: string | null;
  sincronizado_em: string;
}

export const Route = createFileRoute("/painel/financeiro")({
  component: FinanceiroPage,
});

// ─── Interfaces ──────────────────────────────────────────────────────────────
type Tipo = "receita" | "despesa";

interface Lancamento {
  id: string;
  descricao: string;
  tipo: Tipo;
  valor: number;
  categoria: string;
  data: string;
  pago: boolean;
}

interface CustoFixo {
  id: string;
  nome: string;
  valor_mensal: number;
  categoria: string;
  ativo: boolean;
}

interface Divida {
  id: string;
  credor: string;
  descricao: string;
  categoria: string;
  valor_total: number;
  valor_pago: number;
  parcela_mensal: number;
  vencimento_dia: number;         // dia do mês (1–28)
  data_inicio: string;            // ISO date
  ativo: boolean;
  // campos expandidos
  status: "em_dia" | "em_atraso" | "quitada" | "negociando";
  parcelas_pagas: number;
  total_parcelas: number | null;
  sinal: number;
  observacoes: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v: number) {
  return v.toFixed(1) + "%";
}

const CATS_CUSTO = ["Administrativo", "Veículo", "Pessoal", "Tecnologia", "Instalações", "Marketing", "Outros"];
const CATS_DIVIDA = [
  "🏦 Banco / Financeira",
  "📦 Fornecedor",
  "💼 Imposto / Governo",
  "👥 Pessoal",
  "💳 Cartão",
  "📱 Serviço",
  "👨‍⚖️ Jurídico",
  "🔧 Outro",
];

const STATUS_DIVIDA: Record<string, { label: string; cor: string; bg: string }> = {
  em_dia:      { label: "🟡 Em dia",      cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  em_atraso:   { label: "🔴 Em atraso",   cor: "text-red-700",    bg: "bg-red-50 border-red-200" },
  quitada:     { label: "✅ Quitada",     cor: "text-green-700",  bg: "bg-green-50 border-green-200" },
  negociando:  { label: "⏸️ Negociando",  cor: "text-gray-700",   bg: "bg-gray-50 border-gray-200" },
};

// ─── Componente principal ────────────────────────────────────────────────────
function FinanceiroPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";

  // ── Lançamentos ──
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Lancamento>>({
    descricao: "", tipo: "receita", valor: 0, categoria: "",
    data: new Date().toISOString().slice(0, 10), pago: false,
  });

  // ── Configurações fiscais e de margem ──
  const [aliquota, setAliquota] = useState(10);
  const [aliquotaInput, setAliquotaInput] = useState("10");
  const [salvandoAliquota, setSalvandoAliquota] = useState(false);
  const [aliquotaSalva, setAliquotaSalva] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [margemMinInput, setMargemMinInput] = useState("25");
  const [margemIdealInput, setMargemIdealInput] = useState("45");
  const [margemMetaInput, setMargemMetaInput] = useState("20");
  const [salvandoMargem, setSalvandoMargem] = useState(false);
  const [margemSalva, setMargemSalva] = useState(false);

  // ── Veículo / km ──
  const [precoCombInput, setPrecoCombInput] = useState("6.50");
  const [consumoKmInput, setConsumoKmInput] = useState("10");
  const [custoManutInput, setCustoManutInput] = useState("0.15");
  const [enderecoEscritorioInput, setEnderecoEscritorioInput] = useState("");
  const [enderecoCasaInput, setEnderecoCasaInput] = useState("");
  const [salvandoVeiculo, setSalvandoVeiculo] = useState(false);
  const [veiculoSalvo, setVeiculoSalvo] = useState(false);

  // ── Pedágios ──
  // Trajetos pré-cadastrados (combustível + pedágios vinculados)
  interface PedagioTrajeto { id: string; nome: string; valor: number; }
  interface Trajeto { id: string; nome: string; combustivel: number; pedagogios: PedagioTrajeto[]; }
  const [trajetos, setTrajetos] = useState<Trajeto[]>([]);
  const [salvandoTrajeto, setSalvandoTrajeto] = useState(false);
  const [trajetoSalvo, setTrajetoSalvo] = useState(false);
  // Formulário novo trajeto
  const [novoTrajetoNome, setNovoTrajetoNome] = useState("");
  const [novoTrajComb, setNovoTrajComb] = useState("");
  // Pedágios dentro do formulário de novo trajeto
  const [novoTrajPedNome, setNovoTrajPedNome] = useState("");
  const [novoTrajPedValor, setNovoTrajPedValor] = useState("");
  const [novoTrajPedsTemp, setNovoTrajPedsTemp] = useState<PedagioTrajeto[]>([]);
  // Expansão/edição de trajeto existente
  const [trajetoExpandido, setTrajetoExpandido] = useState<string | null>(null);

  // ── Custos Fixos ──
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [carregandoCF, setCarregandoCF] = useState(true);
  const [modalCF, setModalCF] = useState(false);
  const [selCF, setSelCF] = useState<CustoFixo | null>(null);
  const [formCF, setFormCF] = useState<Partial<CustoFixo>>({ nome: "", valor_mensal: 0, categoria: "Administrativo", ativo: true });

  // ── Dívidas ──
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [carregandoDiv, setCarregandoDiv] = useState(true);
  const [modalDiv, setModalDiv] = useState(false);
  const [selDiv, setSelDiv] = useState<Divida | null>(null);
  const [formDiv, setFormDiv] = useState<Partial<Divida>>({
    credor: "", descricao: "", categoria: "🏦 Banco / Financeira",
    valor_total: 0, valor_pago: 0, parcela_mensal: 0,
    vencimento_dia: 10, data_inicio: new Date().toISOString().slice(0, 10), ativo: true,
    status: "em_dia", parcelas_pagas: 0, total_parcelas: null, sinal: 0, observacoes: "",
  });

  // ── Materiais a Comprar (para KPI de meta) ──
  const [totalMateriaisComprar, setTotalMateriaisComprar] = useState(0);

  async function carregarMateriaisComprar() {
    // Soma materiais manuais pendentes
    const { data: manuais } = await supabase
      .from("logistica_materiais_comprar")
      .select("custo_unitario, quantidade")
      .eq("status", "Pendente");
    const totalManuais = (manuais ?? []).reduce((s, m) => s + ((m.custo_unitario ?? 0) * (m.quantidade ?? 1)), 0);

    // Soma itens de aquisições de pedidos pendentes/pedido
    const { data: aquis } = await supabase
      .from("logistica_aquisicoes")
      .select("custo_unitario, quantidade")
      .in("status", ["pendente", "pedido"]);
    const totalAquis = (aquis ?? []).reduce((s, a) => s + ((a.custo_unitario ?? 0) * (a.quantidade ?? 1)), 0);

    setTotalMateriaisComprar(totalManuais + totalAquis);
  }

  // ── UI state ──
  const [secaoAberta, setSecaoAberta] = useState<"config" | "custos" | "dividas" | "saude" | null>("saude");
  const [abaAtiva, setAbaAtiva] = useState<"interno" | "conta-azul" | "vendas" | "compras">("interno");

  // ── Compras a Pagar ──────────────────────────────────────────────────────
  interface CompraPagar {
    id: string;
    aquisicao_id: string | null;
    pedido_id: string | null;
    descricao: string;
    fornecedor: string | null;
    valor: number;
    vencimento: string | null;
    status: "pendente" | "pago" | "cancelado";
    pago_em: string | null;
    valor_pago: number | null;
    forma_pagamento: string | null;
    observacoes: string | null;
    criado_em: string;
    // join info
    _pedido_nome?: string;
    _aquisicao_nome?: string;
  }
  interface AquisicaoOpcao {
    id: string;
    pedido_id: string;
    nome: string;
    quantidade: number;
    unidade: string;
    fornecedor: string | null;
    custo_unitario: number | null;
    status: string;
    _pedido_nome?: string;
  }

  const [comprasPagar, setComprasPagar] = useState<CompraPagar[]>([]);
  const [carregandoCompras, setCarregandoCompras] = useState(false);
  const [modalCompra, setModalCompra] = useState(false);
  const [compraEditando, setCompraEditando] = useState<CompraPagar | null>(null);
  const [formCompra, setFormCompra] = useState<Partial<CompraPagar>>({});
  const [subAbaCompras, setSubAbaCompras] = useState<"pendente" | "pago">("pendente");
  const [aquisicoesFin, setAquisicoesFin] = useState<AquisicaoOpcao[]>([]);
  const [buscaAquisFin, setBuscaAquisFin] = useState("");

  async function carregarComprasPagar() {
    setCarregandoCompras(true);
    const { data } = await supabase
      .from("financeiro_compras_pagar")
      .select("*")
      .order("vencimento", { ascending: true });
    if (!data) { setCarregandoCompras(false); return; }

    // Buscar nomes dos pedidos
    const pedidoIds = [...new Set(data.filter(c => c.pedido_id).map(c => c.pedido_id as string))];
    const mapaPedido: Record<string, string> = {};
    if (pedidoIds.length) {
      const { data: peds } = await supabase.from("logistica_pedidos")
        .select("id, cliente_nome, cliente_empresa").in("id", pedidoIds);
      for (const p of (peds ?? [])) {
        mapaPedido[p.id] = p.cliente_empresa || p.cliente_nome || "Pedido";
      }
    }
    // Buscar nomes das aquisições
    const aquisIds = [...new Set(data.filter(c => c.aquisicao_id).map(c => c.aquisicao_id as string))];
    const mapaAquis: Record<string, string> = {};
    if (aquisIds.length) {
      const { data: aq } = await supabase.from("logistica_aquisicoes")
        .select("id, nome").in("id", aquisIds);
      for (const a of (aq ?? [])) mapaAquis[a.id] = a.nome;
    }

    setComprasPagar(data.map(c => ({
      ...c,
      _pedido_nome: c.pedido_id ? mapaPedido[c.pedido_id] : undefined,
      _aquisicao_nome: c.aquisicao_id ? mapaAquis[c.aquisicao_id] : undefined,
    })) as CompraPagar[]);
    setCarregandoCompras(false);
  }

  async function carregarAquisicoesFin() {
    const { data: aq } = await supabase.from("logistica_aquisicoes")
      .select("id, pedido_id, nome, quantidade, unidade, fornecedor, custo_unitario, status")
      .in("status", ["pendente", "pedido", "recebido"])
      .order("criado_em", { ascending: false });
    if (!aq) return;
    const pedidoIds = [...new Set(aq.map(a => a.pedido_id))];
    const mapaPedido: Record<string, string> = {};
    if (pedidoIds.length) {
      const { data: peds } = await supabase.from("logistica_pedidos")
        .select("id, cliente_nome, cliente_empresa").in("id", pedidoIds);
      for (const p of (peds ?? [])) mapaPedido[p.id] = p.cliente_empresa || p.cliente_nome || "Pedido";
    }
    setAquisicoesFin(aq.map(a => ({ ...a, _pedido_nome: mapaPedido[a.pedido_id] })) as AquisicaoOpcao[]);
  }

  function abrirNovaCompra() {
    setCompraEditando(null);
    setFormCompra({ status: "pendente", valor: 0, vencimento: new Date().toISOString().slice(0, 10) });
    setBuscaAquisFin("");
    setModalCompra(true);
  }

  function abrirEditarCompra(c: CompraPagar) {
    setCompraEditando(c);
    setFormCompra({ ...c });
    setBuscaAquisFin("");
    setModalCompra(true);
  }

  async function salvarCompra() {
    if (!formCompra.descricao?.trim() || !formCompra.valor) return;
    const payload = {
      aquisicao_id: formCompra.aquisicao_id || null,
      pedido_id: formCompra.pedido_id || null,
      descricao: formCompra.descricao,
      fornecedor: formCompra.fornecedor || null,
      valor: formCompra.valor,
      vencimento: formCompra.vencimento || null,
      status: formCompra.status ?? "pendente",
      pago_em: formCompra.pago_em || null,
      valor_pago: formCompra.valor_pago || null,
      forma_pagamento: formCompra.forma_pagamento || null,
      observacoes: formCompra.observacoes || null,
    };
    if (compraEditando) {
      await supabase.from("financeiro_compras_pagar").update(payload).eq("id", compraEditando.id);
    } else {
      await supabase.from("financeiro_compras_pagar").insert(payload);
    }
    setModalCompra(false);
    carregarComprasPagar();
  }

  async function marcarCompraPaga(c: CompraPagar) {
    await supabase.from("financeiro_compras_pagar").update({
      status: "pago",
      pago_em: new Date().toISOString().slice(0, 10),
      valor_pago: c.valor,
    }).eq("id", c.id);
    carregarComprasPagar();
  }

  async function excluirCompra(id: string) {
    if (!confirm("Excluir esta conta a pagar?")) return;
    await supabase.from("financeiro_compras_pagar").delete().eq("id", id);
    carregarComprasPagar();
  }

  // ── Vendas fechadas do CRM ─────────────────────────────────────────────
  interface VendaCRM {
    id: string;
    descricao: string;
    valor: number;
    data: string;
    pago: boolean;
    categoria: string;
    observacoes: string | null;
    crm_lead_id: string | null;
    criado_em: string;
  }
  const [vendas, setVendas] = useState<VendaCRM[]>([]);
  const [carregandoVendas, setCarregandoVendas] = useState(false);
  const [filtroMesVendas, setFiltroMesVendas] = useState(() => new Date().toISOString().slice(0, 7));
  const [excluindoVenda, setExcluindoVenda] = useState<VendaCRM | null>(null);
  const [processandoExclusaoVenda, setProcessandoExclusaoVenda] = useState(false);

  async function confirmarExclusaoVenda() {
    if (!excluindoVenda) return;
    setProcessandoExclusaoVenda(true);
    await supabase.from("financeiro_lancamentos").delete().eq("id", excluindoVenda.id);
    setVendas(vs => vs.filter(v => v.id !== excluindoVenda.id));
    setExcluindoVenda(null);
    setProcessandoExclusaoVenda(false);
  }

  // ── A Faturar (pedidos logísticos aguardando cobrança) ─────────────────
  type StatusCobranca = "aguardando" | "cobrado_parcial" | "cobrado_total";

  interface PedidoFaturar {
    id: string;
    cliente_nome: string | null;
    cliente_empresa: string | null;
    cliente_telefone: string | null;
    tipo_servico: string | null;
    valor_venda: number | null;
    tipo_cobranca: "antes" | "apos" | "sem_cobranca";
    etapa: string;
    cobrado: boolean;
    status_cobranca: StatusCobranca;
    obs_cobranca: string | null;
    cobrado_em: string | null;
    criado_em: string;
    crm_lead_id: string | null;
  }
  const [subAbaFaturar, setSubAbaFaturar] = useState<"pendente" | "faturado">("pendente");
  const [pedidosFaturar, setPedidosFaturar] = useState<PedidoFaturar[]>([]);
  const [pedidosFaturados, setPedidosFaturados] = useState<PedidoFaturar[]>([]);
  const [carregandoFaturar, setCarregandoFaturar] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState<string | null>(null);
  const [salvandoObs, setSalvandoObs] = useState<string | null>(null);
  const [obsEditando, setObsEditando] = useState<Record<string, string>>({});

  const CAMPOS_FATURAR = "id,cliente_nome,cliente_empresa,cliente_telefone,tipo_servico,valor_venda,tipo_cobranca,etapa,cobrado,status_cobranca,obs_cobranca,cobrado_em,criado_em,crm_lead_id";

  async function carregarPedidosFaturar() {
    setCarregandoFaturar(true);
    const [pendente, faturado] = await Promise.all([
      supabase
        .from("logistica_pedidos")
        .select(CAMPOS_FATURAR)
        .neq("status_cobranca", "cobrado_total")
        .not("tipo_cobranca", "eq", "sem_cobranca")
        .not("etapa", "in", "(cancelado)")
        .order("criado_em", { ascending: false }),
      supabase
        .from("logistica_pedidos")
        .select(CAMPOS_FATURAR)
        .eq("status_cobranca", "cobrado_total")
        .not("tipo_cobranca", "eq", "sem_cobranca")
        .order("cobrado_em", { ascending: false })
        .limit(100),
    ]);
    setPedidosFaturar((pendente.data ?? []) as PedidoFaturar[]);
    setPedidosFaturados((faturado.data ?? []) as PedidoFaturar[]);
    setCarregandoFaturar(false);
  }

  async function salvarObs(id: string, obs: string) {
    setSalvandoObs(id);
    await supabase.from("logistica_pedidos").update({ obs_cobranca: obs || null }).eq("id", id);
    const atualizar = (ps: PedidoFaturar[]) => ps.map(p => p.id === id ? { ...p, obs_cobranca: obs || null } : p);
    setPedidosFaturar(atualizar);
    setPedidosFaturados(atualizar);
    setSalvandoObs(null);
  }

  async function atualizarStatusCobranca(id: string, status: StatusCobranca) {
    setAtualizandoStatus(id);
    const cobrado = status === "cobrado_total";
    await supabase
      .from("logistica_pedidos")
      .update({
        status_cobranca: status,
        cobrado,
        ...(cobrado ? { cobrado_em: new Date().toISOString() } : {}),
      })
      .eq("id", id);
    if (status === "cobrado_total") {
      // Move da lista pendente para faturados
      setPedidosFaturar(ps => {
        const pedido = ps.find(p => p.id === id);
        if (pedido) setPedidosFaturados(fs => [{ ...pedido, status_cobranca: "cobrado_total", cobrado: true, cobrado_em: new Date().toISOString() }, ...fs]);
        return ps.filter(p => p.id !== id);
      });
    } else {
      // Atualiza o status na lista
      setPedidosFaturar(ps => ps.map(p => p.id === id ? { ...p, status_cobranca: status } : p));
    }
    setAtualizandoStatus(null);
  }

  useEffect(() => {
    if (abaAtiva === "vendas") { carregarVendas(); carregarPedidosFaturar(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva]);

  async function carregarVendas() {
    setCarregandoVendas(true);
    const inicio = `${filtroMesVendas}-01`;
    const fim = new Date(filtroMesVendas + "-01");
    fim.setMonth(fim.getMonth() + 1);
    const { data } = await supabase
      .from("financeiro_lancamentos")
      .select("*")
      .eq("tipo", "receita")
      .gte("data", inicio)
      .lt("data", fim.toISOString().slice(0, 10))
      .order("data", { ascending: false });
    setVendas((data ?? []) as VendaCRM[]);
    setCarregandoVendas(false);
  }

  useEffect(() => {
    if (abaAtiva === "vendas") carregarVendas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroMesVendas]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Conta Azul state ──
  const [caVendas, setCaVendas] = useState<CaVenda[]>([]);
  const [caCobrancas, setCaCobrancas] = useState<CaCobranca[]>([]);
  const [caContratos, setCaContratos] = useState<CaContrato[]>([]);
  const [caSaldos, setCaSaldos] = useState<CaSaldo[]>([]);
  const [caContasPagar, setCaContasPagar] = useState<CaContaPagar[]>([]);
  const [crmContratos, setCrmContratos] = useState<CrmContrato[]>([]);
  const [carregandoCA, setCarregandoCA] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);
  const [caConectado, setCaConectado] = useState(false);
  const [filtroMeses, setFiltroMeses] = useState<1 | 2 | 3>(1);
  const [horizonteFuturo, setHorizonteFuturo] = useState<30 | 60 | 90>(30);
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    carregar();
    carregarConfig();
    carregarCustosFixos();
    carregarDividas();
    verificarCA();
    carregarMateriaisComprar();
  }, []);

  // Carrega CA na inicialização (para os KPIs do topo) e quando aba CA ativa
  useEffect(() => {
    if (caConectado) carregarDadosCA();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caConectado]);

  useEffect(() => {
    if (abaAtiva === "conta-azul" && caConectado) {
      carregarDadosCA();
    }
  }, [abaAtiva, caConectado]);

  async function verificarCA() {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ca_access_token")
      .single();
    setCaConectado(!!data?.valor);

    const { data: sync } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ca_ultimo_sync")
      .single();
    if (sync?.valor) setUltimoSync(sync.valor);
  }

  const carregarDadosCA = useCallback(async () => {
    setCarregandoCA(true);
    const [v, c, ct, s, cp, crm] = await Promise.all([
      supabase.from("ca_vendas").select("*").order("data_emissao", { ascending: false }).limit(1000),
      supabase.from("ca_cobrancas").select("*").order("vencimento", { ascending: true }).limit(1000),
      supabase.from("ca_contratos").select("*").order("cliente_nome").limit(500),
      supabase.from("ca_saldos").select("*").order("nome").limit(50),
      supabase.from("ca_contas_pagar").select("*").order("vencimento", { ascending: true }).limit(1000),
      supabase.from("crm_propostas").select("*, lead:crm_leads(nome, empresa)").eq("status", "fechado").limit(500),
    ]);
    if (v.data) setCaVendas(v.data as CaVenda[]);
    if (c.data) setCaCobrancas(c.data as CaCobranca[]);
    if (ct.data) setCaContratos(ct.data as CaContrato[]);
    if (s.data) setCaSaldos(s.data as CaSaldo[]);
    if (cp.data) setCaContasPagar(cp.data as CaContaPagar[]);
    if (crm.data) setCrmContratos(crm.data as CrmContrato[]);
    setCarregandoCA(false);
  }, []);

  async function sincronizarCA() {
    setSincronizando(true);
    try {
      await supabase.functions.invoke("sync-conta-azul");
      await carregarDadosCA();
      await verificarCA();
    } catch (e) {
      console.error("Erro ao sincronizar:", e);
    }
    setSincronizando(false);
  }

  async function debugContratos() {
    try {
      const { data, error } = await supabase.functions.invoke("sync-conta-azul", {
        body: { debug: true },
      });
      if (error) { alert("Erro: " + JSON.stringify(error)); return; }
      // Pega o endpoint de contratos e mostra o 1º item
      const chave = Object.keys(data ?? {}).find(k => k.includes("contratos") && !k.includes("recorrencia"));
      const raw = chave ? (data as any)[chave] : data;
      alert("JSON bruto dos contratos:\n\n" + JSON.stringify(raw, null, 2).substring(0, 3000));
    } catch (e) {
      alert("Erro debug: " + String(e));
    }
  }

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("financeiro_lancamentos").select("*").order("data", { ascending: false });
    if (data) setLancamentos(data as Lancamento[]);
    setCarregando(false);
  }

  async function carregarConfig() {
    const { data } = await supabase.from("configuracoes").select("*")
      .in("chave", ["imposto_padrao_pct", "margem_minima_pct", "margem_ideal_pct", "margem_meta_pct",
        "veiculo_preco_combustivel", "veiculo_consumo_km_l", "veiculo_custo_manut_km",
        "veiculo_endereco_escritorio", "veiculo_endereco_casa", "trajetos_lista"]);
    if (data) {
      for (const row of data) {
        if (row.chave === "imposto_padrao_pct") { setAliquota(Number(row.valor)); setAliquotaInput(String(Number(row.valor))); setConfigId(row.id); }
        if (row.chave === "margem_minima_pct") setMargemMinInput(String(Number(row.valor)));
        if (row.chave === "margem_ideal_pct") setMargemIdealInput(String(Number(row.valor)));
        if (row.chave === "margem_meta_pct") setMargemMetaInput(String(Number(row.valor)));
        if (row.chave === "veiculo_preco_combustivel") setPrecoCombInput(String(Number(row.valor)));
        if (row.chave === "veiculo_consumo_km_l") setConsumoKmInput(String(Number(row.valor)));
        if (row.chave === "veiculo_custo_manut_km") setCustoManutInput(String(Number(row.valor)));
        if (row.chave === "veiculo_endereco_escritorio") setEnderecoEscritorioInput(row.valor || "");
        if (row.chave === "veiculo_endereco_casa") setEnderecoCasaInput(row.valor || "");
        if (row.chave === "trajetos_lista") {
          try { setTrajetos(JSON.parse(row.valor || "[]")); } catch { setTrajetos([]); }
        }
      }
    }
  }

  async function salvarTrajetos(lista: Trajeto[]) {
    setSalvandoTrajeto(true);
    await supabase.from("configuracoes").upsert(
      { chave: "trajetos_lista", valor: JSON.stringify(lista), descricao: "Trajetos pré-cadastrados (combustível + pedágios)" },
      { onConflict: "chave" }
    );
    setTrajetos(lista);
    setSalvandoTrajeto(false);
    setTrajetoSalvo(true);
    setTimeout(() => setTrajetoSalvo(false), 2000);
  }

  function adicionarPedagioTemp() {
    const nome = novoTrajPedNome.trim();
    const valor = Number(novoTrajPedValor);
    if (!nome || valor <= 0) return;
    setNovoTrajPedsTemp(prev => [...prev, { id: crypto.randomUUID(), nome, valor }]);
    setNovoTrajPedNome(""); setNovoTrajPedValor("");
  }

  function salvarNovoTrajeto() {
    const nome = novoTrajetoNome.trim();
    const comb = Number(novoTrajComb);
    if (!nome) return;
    const novo: Trajeto = { id: crypto.randomUUID(), nome, combustivel: comb, pedagogios: novoTrajPedsTemp };
    setNovoTrajetoNome(""); setNovoTrajComb(""); setNovoTrajPedsTemp([]);
    salvarTrajetos([...trajetos, novo]);
  }

  function removerTrajeto(id: string) { salvarTrajetos(trajetos.filter(t => t.id !== id)); }
  function removerPedagioDoTrajeto(trajetoId: string, pedId: string) {
    salvarTrajetos(trajetos.map(t => t.id === trajetoId ? { ...t, pedagogios: t.pedagogios.filter(p => p.id !== pedId) } : t));
  }

  async function carregarCustosFixos() {
    setCarregandoCF(true);
    const { data } = await supabase.from("financeiro_custos_fixos").select("*").order("categoria").order("nome");
    if (data) setCustosFixos(data as CustoFixo[]);
    setCarregandoCF(false);
  }

  async function carregarDividas() {
    setCarregandoDiv(true);
    const { data } = await supabase.from("financeiro_dividas").select("*").order("credor");
    if (data) setDividas(data as Divida[]);
    setCarregandoDiv(false);
  }

  // ── Salvar alíquota ──
  async function salvarAliquota() {
    const val = Number(aliquotaInput);
    if (isNaN(val) || val < 0 || val > 100) return;
    setSalvandoAliquota(true);
    if (configId) {
      await supabase.from("configuracoes").update({ valor: String(val), atualizado_em: new Date().toISOString() }).eq("id", configId);
    } else {
      const { data } = await supabase.from("configuracoes").insert({ chave: "imposto_padrao_pct", valor: String(val), descricao: "Alíquota padrão de impostos e encargos usada nos orçamentos" }).select().single();
      if (data) setConfigId(data.id);
    }
    setAliquota(val);
    setSalvandoAliquota(false);
    setAliquotaSalva(true);
    setTimeout(() => setAliquotaSalva(false), 2500);
  }

  // ── Salvar margens ──
  async function salvarMargem() {
    setSalvandoMargem(true);
    const configs = [
      { chave: "margem_minima_pct", valor: margemMinInput, descricao: "Margem de lucro mínima aceitável nos orçamentos (%)" },
      { chave: "margem_ideal_pct", valor: margemIdealInput, descricao: "Margem de lucro ideal nos orçamentos (%)" },
      { chave: "margem_meta_pct", valor: margemMetaInput, descricao: "Margem sobre o ponto de equilíbrio para definir a meta de vendas do BPO (%)" },
    ];
    for (const cfg of configs) {
      await supabase.from("configuracoes").upsert({ ...cfg, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    }
    setSalvandoMargem(false);
    setMargemSalva(true);
    setTimeout(() => setMargemSalva(false), 2500);
  }

  // ── Salvar veículo ──
  async function salvarVeiculo() {
    setSalvandoVeiculo(true);
    const configs = [
      { chave: "veiculo_preco_combustivel", valor: precoCombInput, descricao: "Preço do combustível (R$/litro)" },
      { chave: "veiculo_consumo_km_l", valor: consumoKmInput, descricao: "Consumo médio do veículo (km/litro)" },
      { chave: "veiculo_custo_manut_km", valor: custoManutInput, descricao: "Custo de manutenção por km rodado (R$/km)" },
      { chave: "veiculo_endereco_escritorio", valor: enderecoEscritorioInput, descricao: "Endereço de origem: escritório" },
      { chave: "veiculo_endereco_casa", valor: enderecoCasaInput, descricao: "Endereço de origem: casa" },
    ];
    for (const cfg of configs) {
      await supabase.from("configuracoes").upsert({ ...cfg, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    }
    setSalvandoVeiculo(false);
    setVeiculoSalvo(true);
    setTimeout(() => setVeiculoSalvo(false), 2500);
  }

  // ── CRUD Custos Fixos ──
  function abrirCF(cf?: CustoFixo) {
    if (cf) { setSelCF(cf); setFormCF({ ...cf }); }
    else { setSelCF(null); setFormCF({ nome: "", valor_mensal: 0, categoria: "Administrativo", ativo: true }); }
    setModalCF(true);
  }

  async function salvarCF() {
    if (!formCF.nome?.trim()) return;
    if (selCF) await supabase.from("financeiro_custos_fixos").update(formCF).eq("id", selCF.id);
    else await supabase.from("financeiro_custos_fixos").insert(formCF);
    setModalCF(false);
    carregarCustosFixos();
  }

  async function excluirCF(id: string) {
    if (!confirm("Excluir este custo fixo?")) return;
    await supabase.from("financeiro_custos_fixos").delete().eq("id", id);
    carregarCustosFixos();
  }

  // ── CRUD Dívidas ──
  function abrirDiv(d?: Divida) {
    if (d) { setSelDiv(d); setFormDiv({ ...d }); }
    else {
      setSelDiv(null);
      setFormDiv({
        credor: "", descricao: "", categoria: "🏦 Banco / Financeira",
        valor_total: 0, valor_pago: 0, parcela_mensal: 0,
        vencimento_dia: 10, data_inicio: new Date().toISOString().slice(0, 10), ativo: true,
        status: "em_dia", parcelas_pagas: 0, total_parcelas: null, sinal: 0, observacoes: "",
      });
    }
    setModalDiv(true);
  }

  async function salvarDiv() {
    if (!formDiv.credor?.trim()) return;
    // Garante vencimento_dia entre 1 e 28 (constraint do banco)
    const payload = {
      ...formDiv,
      vencimento_dia: Math.min(28, Math.max(1, formDiv.vencimento_dia ?? 10)),
      // Remove campos novos se migration ainda não foi aplicada — o banco ignora extras,
      // mas se coluna não existe vai dar erro de unknown column; deixamos o banco rejeitar
      // e mostrar mensagem clara
    };
    let err;
    if (selDiv) {
      const res = await supabase.from("financeiro_dividas").update(payload).eq("id", selDiv.id);
      err = res.error;
    } else {
      const res = await supabase.from("financeiro_dividas").insert(payload);
      err = res.error;
    }
    if (err) {
      alert("Erro ao salvar dívida: " + err.message);
      return;
    }
    setModalDiv(false);
    carregarDividas();
  }

  async function excluirDiv(id: string) {
    if (!confirm("Excluir esta dívida?")) return;
    await supabase.from("financeiro_dividas").delete().eq("id", id);
    carregarDividas();
  }

  // ── Lançamento ──
  async function salvar() {
    if (!form.descricao?.trim() || !form.valor) return;
    await supabase.from("financeiro_lancamentos").insert(form);
    setModal(false);
    carregar();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CÁLCULOS FINANCEIROS
  // ─────────────────────────────────────────────────────────────────────────

  // Receitas e despesas do mês dos lançamentos internos (mantido para Saúde Financeira)
  const receitas = lancamentos.filter(l => l.tipo === "receita" && l.pago).reduce((s, l) => s + l.valor, 0);
  const despesas = lancamentos.filter(l => l.tipo === "despesa" && l.pago).reduce((s, l) => s + l.valor, 0);
  const saldo = receitas - despesas;

  // ── KPIs cruzados (Conta Azul + sistema) ──────────────────────────────────
  // Saldo: soma das contas ativas no Conta Azul
  const kpiSaldo = caSaldos.filter(s => s.ativo).reduce((acc, s) => acc + s.saldo, 0);

  // Receitas pagas no mês corrente: cobranças do CA pagas neste mês
  const mesAtual = new Date().toISOString().slice(0, 7); // "2026-11"
  const kpiReceitasPagas = caCobrancas
    .filter(c => {
      if (!c.pago_em) return false;
      const pagoMes = c.pago_em.slice(0, 7);
      return pagoMes === mesAtual;
    })
    .reduce((acc, c) => acc + (c.valor_pago || c.valor), 0);

  // Despesas a pagar: custos fixos ativos cadastrados no sistema (recorrentes mensais)
  const kpiDespesasRecorrentes = custosFixos
    .filter(cf => cf.ativo)
    .reduce((acc, cf) => acc + cf.valor_mensal, 0);

  // ── Meta mensal de vendas ──────────────────────────────────────────────────
  // Boletos lançados no mês (pagos + a receber) = receita garantida
  const kpiBoletos = caCobrancas
    .filter(c => c.vencimento?.slice(0, 7) === mesAtual || c.pago_em?.slice(0, 7) === mesAtual)
    .reduce((acc, c) => acc + (c.valor_pago ?? c.valor), 0);
  // Meta = fixos + parcelas dívidas + materiais pendentes
  const kpiMeta = kpiDespesasRecorrentes + totalParcelasMensais + totalMateriaisComprar;
  // Falta vender = meta - boletos já lançados (mínimo 0)
  const kpiFaltaVender = Math.max(0, kpiMeta - kpiBoletos);
  const kpiProgressoMeta = kpiMeta > 0 ? Math.min(100, (kpiBoletos / kpiMeta) * 100) : 0;

  // Custo/km calculado
  const precoComb = Number(precoCombInput) || 0;
  const consumoKm = Number(consumoKmInput) || 1;
  const custoManut = Number(custoManutInput) || 0;
  const custoPorKm = (precoComb / consumoKm) + custoManut;

  // Total custos fixos mensais ativos
  const totalCustosFixos = custosFixos.filter(c => c.ativo).reduce((s, c) => s + c.valor_mensal, 0);

  // Total comprometimento mensal com dívidas ativas
  const totalParcelasMensais = dividas.filter(d => d.ativo && d.valor_pago < d.valor_total).reduce((s, d) => s + d.parcela_mensal, 0);
  const totalDividaRestante = dividas.filter(d => d.ativo).reduce((s, d) => s + Math.max(0, d.valor_total - d.valor_pago), 0);

  // Custo total mensal estrutural (fixos + dívidas)
  const custoEstruturalMensal = totalCustosFixos + totalParcelasMensais;

  // Margem de contribuição (receita - custos variáveis; aqui usamos o que há nos lançamentos)
  // Se tiver receita nos lançamentos, calcula; caso contrário, mostra estrutura
  const margemContribuicao = receitas > 0 ? receitas - despesas : 0;
  const margemContribuicaoPct = receitas > 0 ? (margemContribuicao / receitas) * 100 : 0;

  // Ponto de equilíbrio mensal = precisa faturar X para cobrir estrutura
  const pontoEquilibrio = margemContribuicaoPct > 0
    ? custoEstruturalMensal / (margemContribuicaoPct / 100)
    : custoEstruturalMensal;

  // Taxa de endividamento mensal = parcelas / receita
  const taxaEndividamento = receitas > 0 ? (totalParcelasMensais / receitas) * 100 : 0;

  // Resultado líquido estimado = receita - despesas variáveis - estrutura
  const resultadoLiquido = receitas - despesas - custoEstruturalMensal;

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="mt-1 text-sm text-gray-500 capitalize">{mes}</p>
        </div>
        <div className="flex items-center gap-2">
          {abaAtiva === "conta-azul" && caConectado && (
            <>
              <button
                onClick={debugContratos}
                className="flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
                title="Mostra o JSON bruto de 1 contrato da API"
              >
                🔍 Debug
              </button>
              <button
                onClick={sincronizarCA}
                disabled={sincronizando}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
                {sincronizando ? "Sincronizando…" : "Sincronizar"}
              </button>
            </>
          )}
          {abaAtiva === "interno" && (
            <button
              onClick={() => { setForm({ descricao: "", tipo: "receita", valor: 0, categoria: "", data: new Date().toISOString().slice(0, 10), pago: false }); setModal(true); }}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
            >
              <Plus className="h-4 w-4" /> Lançamento
            </button>
          )}
          {abaAtiva === "compras" && (
            <button
              onClick={abrirNovaCompra}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" /> Nova Conta a Pagar
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {([
          { key: "interno", label: "Lançamentos internos" },
          { key: "vendas", label: "📦 Vendas" },
          { key: "compras", label: "🛒 Compras" },
          { key: "conta-azul", label: "💙 Conta Azul" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setAbaAtiva(key);
              if (key === "compras") { carregarComprasPagar(); carregarAquisicoesFin(); }
            }}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              abaAtiva === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ ABA COMPRAS ══════════ */}
      {abaAtiva === "compras" && (
        <div className="space-y-5">
          {/* Sub-abas pendente / pago */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setSubAbaCompras("pendente")}
                className={cn("flex items-center gap-1.5 px-3 py-2 transition-colors",
                  subAbaCompras === "pendente" ? "bg-orange-600 text-white" : "text-gray-500 hover:bg-gray-50")}
              >
                A Pagar
                {comprasPagar.filter(c => c.status === "pendente").length > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    subAbaCompras === "pendente" ? "bg-white/30 text-white" : "bg-orange-100 text-orange-700")}>
                    {comprasPagar.filter(c => c.status === "pendente").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSubAbaCompras("pago")}
                className={cn("flex items-center gap-1.5 px-3 py-2 transition-colors border-l border-gray-200",
                  subAbaCompras === "pago" ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50")}
              >
                Pagos
                {comprasPagar.filter(c => c.status === "pago").length > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    subAbaCompras === "pago" ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-700")}>
                    {comprasPagar.filter(c => c.status === "pago").length}
                  </span>
                )}
              </button>
            </div>
            {carregandoCompras && <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-orange-500" />}
          </div>

          {/* Total a pagar (só na sub-aba pendente) */}
          {subAbaCompras === "pendente" && comprasPagar.filter(c => c.status === "pendente").length > 0 && (() => {
            const totalPendente = comprasPagar.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor, 0);
            return (
              <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-orange-800">Total a pagar a fornecedores</span>
                <span className="text-lg font-bold text-orange-700">
                  {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            );
          })()}

          {/* Lista */}
          {(() => {
            const lista = comprasPagar.filter(c => c.status === subAbaCompras);
            if (lista.length === 0 && !carregandoCompras) return (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-300">
                {subAbaCompras === "pendente" ? "Nenhuma conta a pagar" : "Nenhum pagamento registrado"}
              </div>
            );
            return (
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Descrição</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Fornecedor</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Pedido</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Vencimento</th>
                      {subAbaCompras === "pago" && (
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Pago em</th>
                      )}
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lista.map(c => {
                      const hoje = new Date().toISOString().slice(0, 10);
                      const vencido = c.vencimento && c.vencimento < hoje && c.status === "pendente";
                      return (
                        <tr key={c.id} className={cn("transition-colors hover:bg-gray-50/50", vencido && "bg-red-50/40")}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{c.descricao}</div>
                            {c._aquisicao_nome && (
                              <div className="text-[11px] text-gray-400">Item: {c._aquisicao_nome}</div>
                            )}
                            {vencido && (
                              <span className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Vencido</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.fornecedor || "—"}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {c._pedido_nome ? (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{c._pedido_nome}</span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                            {c.vencimento ? new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </td>
                          {subAbaCompras === "pago" && (
                            <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                              {c.pago_em ? new Date(c.pago_em + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                              {c.forma_pagamento && <div className="text-[10px] text-gray-400">{c.forma_pagamento}</div>}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {(c.valor_pago ?? c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {c.status === "pendente" && (
                                <button
                                  onClick={() => marcarCompraPaga(c)}
                                  title="Marcar como pago"
                                  className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => abrirEditarCompra(c)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => excluirCompra(c.id)}
                                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal nova/editar conta a pagar */}
      {modalCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalCompra(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">{compraEditando ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</h2>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={formCompra.descricao ?? ""}
                onChange={e => setFormCompra(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Tinta epóxi – Fornecedor X"
              />
            </div>

            {/* Vincular a aquisição */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vincular a item de aquisição (opcional)</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 mb-1"
                placeholder="Buscar item…"
                value={buscaAquisFin}
                onChange={e => setBuscaAquisFin(e.target.value)}
              />
              {buscaAquisFin.trim().length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-sm">
                  {aquisicoesFin
                    .filter(a => a.nome.toLowerCase().includes(buscaAquisFin.toLowerCase()) || (a._pedido_nome ?? "").toLowerCase().includes(buscaAquisFin.toLowerCase()))
                    .slice(0, 8)
                    .map(a => (
                      <button
                        key={a.id}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-orange-50 text-left"
                        onClick={() => {
                          setFormCompra(p => ({
                            ...p,
                            aquisicao_id: a.id,
                            pedido_id: a.pedido_id,
                            descricao: p.descricao || a.nome,
                            fornecedor: p.fornecedor || a.fornecedor || "",
                            valor: p.valor || (a.custo_unitario ? a.custo_unitario * a.quantidade : 0),
                          }));
                          setBuscaAquisFin(a.nome);
                        }}
                      >
                        <span className="font-medium text-gray-800">{a.nome}</span>
                        <span className="text-gray-400 ml-2">{a._pedido_nome}</span>
                      </button>
                    ))}
                </div>
              )}
              {formCompra.aquisicao_id && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600">
                  <Check className="h-3 w-3" />
                  Item vinculado
                  <button className="ml-1 text-gray-400 underline" onClick={() => setFormCompra(p => ({ ...p, aquisicao_id: undefined, pedido_id: undefined }))}>remover</button>
                </div>
              )}
            </div>

            {/* Fornecedor + Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fornecedor</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formCompra.fornecedor ?? ""}
                  onChange={e => setFormCompra(p => ({ ...p, fornecedor: e.target.value }))}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$) *</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formCompra.valor ?? ""}
                  onChange={e => setFormCompra(p => ({ ...p, valor: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={formCompra.vencimento ?? ""}
                onChange={e => setFormCompra(p => ({ ...p, vencimento: e.target.value }))}
              />
            </div>

            {/* Se editando e status=pago, mostrar campos de pagamento */}
            {compraEditando && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
                      value={formCompra.status ?? "pendente"}
                      onChange={e => setFormCompra(p => ({ ...p, status: e.target.value as "pendente" | "pago" | "cancelado" }))}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pago em</label>
                    <input type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={formCompra.pago_em ?? ""} onChange={e => setFormCompra(p => ({ ...p, pago_em: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valor pago (R$)</label>
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={formCompra.valor_pago ?? ""} onChange={e => setFormCompra(p => ({ ...p, valor_pago: parseFloat(e.target.value) || null }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Forma de pagamento</label>
                    <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={formCompra.forma_pagamento ?? ""} onChange={e => setFormCompra(p => ({ ...p, forma_pagamento: e.target.value || null }))}>
                      <option value="">—</option>
                      <option value="Pix">Pix</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Transferência">Transferência</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                rows={2}
                value={formCompra.observacoes ?? ""}
                onChange={e => setFormCompra(p => ({ ...p, observacoes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setModalCompra(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvarCompra} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
                {compraEditando ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ ABA VENDAS ══════════ */}
      {abaAtiva === "vendas" && (
        <div className="space-y-6">

          {/* ── FATURAR / FATURADO ─────────────────────────────────────── */}
          <div>
            {/* Sub-abas */}
            <div className="mb-3 flex items-center gap-3 flex-wrap">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                <span className="text-[10px] font-bold text-blue-700">$</span>
              </div>
              <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setSubAbaFaturar("pendente")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 transition-colors",
                    subAbaFaturar === "pendente"
                      ? "bg-blue-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  A Faturar
                  {!carregandoFaturar && pedidosFaturar.length > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", subAbaFaturar === "pendente" ? "bg-white/30 text-white" : "bg-blue-100 text-blue-700")}>
                      {pedidosFaturar.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSubAbaFaturar("faturado")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 transition-colors border-l border-gray-200",
                    subAbaFaturar === "faturado"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  Faturado
                  {!carregandoFaturar && pedidosFaturados.length > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", subAbaFaturar === "faturado" ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-700")}>
                      {pedidosFaturados.length}
                    </span>
                  )}
                </button>
              </div>
              {carregandoFaturar && <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />}
            </div>

            {/* Tabela compartilhada */}
            {(() => {
              const lista = subAbaFaturar === "pendente" ? pedidosFaturar : pedidosFaturados;
              const vazio = subAbaFaturar === "pendente" ? "Nenhum pedido pendente de cobrança" : "Nenhum pedido faturado ainda";
              const etapaLabel: Record<string, string> = {
                tratamento: "Tratamento", aguard_material: "Aguard. Material",
                aguard_cobranca: "Aguard. Cobrança", em_execucao: "Em Execução",
                concluido: "Concluído",
              };
              return lista.length === 0 && !carregandoFaturar ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-300">{vazio}</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Tipo</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Cobrança</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Etapa Log.</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Observação</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                        {subAbaFaturar === "pendente" && (
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                        )}
                        {subAbaFaturar === "faturado" && (
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Faturado em</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lista.map(p => {
                        const cliente = p.cliente_empresa || p.cliente_nome || "—";
                        const cobLabel = p.tipo_cobranca === "antes" ? "Antes da execução" : "Após a execução";
                        const cobColor = p.tipo_cobranca === "antes" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";
                        const isParcial = p.status_cobranca === "cobrado_parcial";
                        const obsAtual = obsEditando[p.id] ?? (p.obs_cobranca || "");
                        return (
                          <tr
                            key={p.id}
                            className={cn(
                              "transition-colors",
                              isParcial
                                ? "bg-purple-50/60 hover:bg-purple-50"
                                : "hover:bg-gray-50/60"
                            )}
                          >
                            <td className="px-4 py-3">
                              <p className={cn("font-medium", isParcial ? "text-purple-900" : "text-gray-900")}>{cliente}</p>
                              {p.cliente_telefone && <p className="text-xs text-gray-400">{p.cliente_telefone}</p>}
                              {isParcial && (
                                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                  🔶 Parcial
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                {p.tipo_servico === "manutencao" ? "Manutenção" : "Orçamento"}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cobColor)}>{cobLabel}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                              {etapaLabel[p.etapa] || p.etapa}
                            </td>
                            <td className="px-4 py-3 min-w-[160px]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={obsAtual}
                                  onChange={e => setObsEditando(o => ({ ...o, [p.id]: e.target.value }))}
                                  onBlur={() => {
                                    const val = obsEditando[p.id];
                                    if (val !== undefined && val !== (p.obs_cobranca || "")) salvarObs(p.id, val);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Adicionar observação…"
                                  className={cn(
                                    "w-full rounded border px-2 py-1 text-xs placeholder-gray-300 focus:outline-none focus:ring-1",
                                    isParcial
                                      ? "border-purple-200 bg-purple-50/50 focus:ring-purple-300"
                                      : "border-gray-100 bg-gray-50 focus:ring-gray-300"
                                  )}
                                />
                                {salvandoObs === p.id && (
                                  <div className="h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-[#1a6b2f]" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[#1a6b2f]">
                              {p.valor_venda != null ? p.valor_venda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                            </td>
                            {subAbaFaturar === "pendente" && (
                              <td className="px-4 py-3 text-right">
                                {atualizandoStatus === p.id ? (
                                  <div className="flex justify-end">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1a6b2f]" />
                                  </div>
                                ) : (
                                  <select
                                    value={p.status_cobranca ?? "aguardando"}
                                    onChange={e => atualizarStatusCobranca(p.id, e.target.value as StatusCobranca)}
                                    className={cn(
                                      "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1",
                                      p.status_cobranca === "cobrado_parcial"
                                        ? "border-purple-200 bg-purple-50 text-purple-700 focus:ring-purple-300"
                                        : "border-gray-200 bg-gray-50 text-gray-600 focus:ring-gray-300"
                                    )}
                                  >
                                    <option value="aguardando">⏳ Aguardando cobrança</option>
                                    <option value="cobrado_parcial">🔶 Cobrado parcial</option>
                                    <option value="cobrado_total">✅ Cobrado total</option>
                                  </select>
                                )}
                              </td>
                            )}
                            {subAbaFaturar === "faturado" && (
                              <td className="px-4 py-3 text-right text-xs text-gray-400">
                                {p.cobrado_em ? new Date(p.cobrado_em).toLocaleDateString("pt-BR") : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* ── REGISTRO DE VENDAS ────────────────────────────────────── */}
          {/* Header com filtro de mês */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Registro de Vendas</h2>
              <p className="text-sm text-gray-500">Receitas registradas ao fechar leads no CRM</p>
            </div>
            <input
              type="month"
              value={filtroMesVendas}
              onChange={e => setFiltroMesVendas(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]"
            />
          </div>

          {/* KPIs do mês */}
          {!carregandoVendas && vendas.length > 0 && (() => {
            const total = vendas.reduce((s, v) => s + v.valor, 0);
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total de Vendas</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{vendas.length}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Volume Total</p>
                  <p className="mt-1 text-xl font-bold text-[#1a6b2f]">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                </div>
              </div>
            );
          })()}

          {/* Lista de vendas */}
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            {carregandoVendas ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#1a6b2f]" />
                Carregando vendas…
              </div>
            ) : vendas.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-2xl mb-2">📦</p>
                <p className="text-sm font-medium text-gray-500">Nenhuma venda registrada neste mês</p>
                <p className="text-xs text-gray-400 mt-1">As vendas aparecem aqui quando um lead é fechado no CRM</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente / Serviço</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                    {isAdmin && <th className="px-4 py-3 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendas.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(v.data + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{v.descricao}</p>
                        {v.observacoes && <p className="text-xs text-gray-400 mt-0.5">{v.observacoes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {v.categoria || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1a6b2f]">
                        {v.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); setExcluindoVenda(v); }}
                            className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Excluir registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-600">Total do mês</td>
                    <td className="px-4 py-3 text-right text-base font-bold text-[#1a6b2f]">
                      {vendas.reduce((s, v) => s + v.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    {isAdmin && <td />}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Modal confirmação exclusão venda */}
          {excluindoVenda && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Excluir registro</p>
                    <p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p>
                  </div>
                </div>
                <p className="mb-5 text-sm text-gray-700">
                  Deseja excluir o registro{" "}
                  <span className="font-semibold">"{excluindoVenda.descricao}"</span>{" "}
                  de{" "}
                  <span className="font-semibold text-[#1a6b2f]">
                    {excluindoVenda.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExcluindoVenda(null)}
                    disabled={processandoExclusaoVenda}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarExclusaoVenda}
                    disabled={processandoExclusaoVenda}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {processandoExclusaoVenda ? "Excluindo…" : "Excluir"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ ABA CONTA AZUL ══════════ */}
      {abaAtiva === "conta-azul" && (
        <ContaAzulView
          conectado={caConectado}
          carregando={carregandoCA}
          vendas={caVendas}
          cobrancas={caCobrancas}
          contratos={caContratos}
          saldos={caSaldos}
          contasPagar={caContasPagar}
          crmContratos={crmContratos}
          ultimoSync={ultimoSync}
          filtroMeses={filtroMeses}
          setFiltroMeses={setFiltroMeses}
          horizonteFuturo={horizonteFuturo}
          setHorizonteFuturo={setHorizonteFuturo}
        />
      )}

      {abaAtiva === "interno" && (<>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Receitas pagas — cobranças CA pagas neste mês */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-lg p-3 bg-green-50 text-green-600"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Receitas pagas</p>
            <p className="text-xl font-bold text-gray-900">{fmt(kpiReceitasPagas)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Cobranças recebidas este mês · Conta Azul</p>
          </div>
        </div>

        {/* Despesas recorrentes — custos fixos do sistema */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-lg p-3 bg-red-50 text-red-600"><TrendingDown className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Despesas recorrentes</p>
            <p className="text-xl font-bold text-gray-900">{fmt(kpiDespesasRecorrentes)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{custosFixos.filter(cf => cf.ativo).length} custos fixos ativos · Sistema</p>
          </div>
        </div>

        {/* Saldo — conta Azul */}
        <div className={cn("rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4")}>
          <div className={cn("rounded-lg p-3", kpiSaldo >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600")}><DollarSign className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Saldo</p>
            <p className="text-xl font-bold text-gray-900">{carregandoCA && caSaldos.length === 0 ? "..." : fmt(kpiSaldo)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Contas bancárias · Conta Azul</p>
          </div>
        </div>
      </div>

      {/* ══ Meta Mensal de Vendas ══ */}
      <div className={cn(
        "rounded-xl border p-5 shadow-sm",
        kpiFaltaVender === 0
          ? "border-green-200 bg-green-50"
          : kpiProgressoMeta >= 60
            ? "border-yellow-200 bg-yellow-50"
            : "border-red-200 bg-red-50"
      )}>
        {/* Título + valor falta */}
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <p className="text-sm font-bold text-gray-800">🎯 Meta mensal de vendas</p>
            <p className="text-xs text-gray-500 mt-0.5">Quanto precisamos faturar para cobrir todas as obrigações</p>
          </div>
          <div className="text-right">
            {kpiFaltaVender === 0
              ? <p className="text-lg font-bold text-green-700">✅ Meta atingida!</p>
              : <>
                  <p className="text-xs text-gray-500">Falta vender</p>
                  <p className="text-2xl font-bold text-red-600">{fmt(kpiFaltaVender)}</p>
                </>
            }
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Boletos lançados: <strong className="text-gray-700">{fmt(kpiBoletos)}</strong></span>
            <span>Meta: <strong className="text-gray-700">{fmt(kpiMeta)}</strong></span>
          </div>
          <div className="h-3 w-full rounded-full bg-white/70 overflow-hidden border border-white/50">
            <div
              className={cn("h-3 rounded-full transition-all", kpiFaltaVender === 0 ? "bg-green-500" : kpiProgressoMeta >= 60 ? "bg-yellow-400" : "bg-red-400")}
              style={{ width: `${kpiProgressoMeta}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-gray-400 mt-1">{kpiProgressoMeta.toFixed(0)}% da meta coberta pelos boletos lançados</p>
        </div>

        {/* Composição da meta */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/70 border border-white/50 px-3 py-2.5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Custos fixos</p>
            <p className="text-sm font-bold text-gray-800">{fmt(kpiDespesasRecorrentes)}</p>
          </div>
          <div className="rounded-lg bg-white/70 border border-white/50 px-3 py-2.5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Parcelas dívidas</p>
            <p className="text-sm font-bold text-gray-800">{fmt(totalParcelasMensais)}</p>
          </div>
          <div className="rounded-lg bg-white/70 border border-white/50 px-3 py-2.5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Materiais pendentes</p>
            <p className="text-sm font-bold text-gray-800">{fmt(totalMateriaisComprar)}</p>
          </div>
        </div>
      </div>

      {/* ══════════ SAÚDE FINANCEIRA ══════════ */}
      <Secao
        icone={BarChart3} titulo="Saúde Financeira" cor="text-purple-600"
        aberta={secaoAberta === "saude"} toggle={() => setSecaoAberta(s => s === "saude" ? null : "saude")}
        badge={resultadoLiquido < 0 ? "⚠️ Resultado negativo" : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            titulo="Custos Fixos Mensais" valor={fmt(totalCustosFixos)}
            sub={`${custosFixos.filter(c => c.ativo).length} itens ativos`}
            cor="bg-orange-50 text-orange-600" icone={Building2}
          />
          <KpiCard
            titulo="Parcelas de Dívidas" valor={fmt(totalParcelasMensais)}
            sub={`Saldo devedor: ${fmt(totalDividaRestante)}`}
            cor="bg-red-50 text-red-600" icone={CreditCard}
          />
          <KpiCard
            titulo="Ponto de Equilíbrio" valor={fmt(pontoEquilibrio)}
            sub="Receita mínima para cobrir estrutura"
            cor="bg-yellow-50 text-yellow-600" icone={Target}
            tooltip="Custos fixos + dívidas ÷ margem de contribuição %"
          />
          <KpiCard
            titulo="Resultado Líquido Est." valor={fmt(resultadoLiquido)}
            sub="Receitas − despesas − estrutura"
            cor={resultadoLiquido >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} icone={Gauge}
          />
        </div>

        {receitas > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Indicador
              label="Margem de Contribuição"
              valor={pct(margemContribuicaoPct)}
              status={margemContribuicaoPct >= Number(margemIdealInput) ? "verde" : margemContribuicaoPct >= Number(margemMinInput) ? "amarelo" : "vermelho"}
              desc="(Receitas − despesas variáveis) ÷ Receitas"
            />
            <Indicador
              label="Taxa de Endividamento"
              valor={pct(taxaEndividamento)}
              status={taxaEndividamento <= 20 ? "verde" : taxaEndividamento <= 35 ? "amarelo" : "vermelho"}
              desc="Parcelas mensais ÷ Receitas — saudável abaixo de 20%"
            />
            <Indicador
              label="Custo Estrutural / Receita"
              valor={pct(receitas > 0 ? (custoEstruturalMensal / receitas) * 100 : 0)}
              status={(custoEstruturalMensal / receitas) * 100 <= 40 ? "verde" : (custoEstruturalMensal / receitas) * 100 <= 60 ? "amarelo" : "vermelho"}
              desc="(Fixos + dívidas) ÷ Receitas"
            />
          </div>
        )}

        {receitas === 0 && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-600 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Lance receitas pagas para calcular margem, ponto de equilíbrio e taxa de endividamento em relação à produção.</span>
          </div>
        )}
      </Secao>

      {/* ══════════ CUSTOS FIXOS ══════════ */}
      <Secao
        icone={Building2} titulo="Custos Fixos Mensais" cor="text-orange-600"
        aberta={secaoAberta === "custos"} toggle={() => setSecaoAberta(s => s === "custos" ? null : "custos")}
        badge={totalCustosFixos > 0 ? fmt(totalCustosFixos) + "/mês" : undefined}
        acao={<button onClick={() => abrirCF()} className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155824]"><Plus className="h-3.5 w-3.5" /> Novo custo</button>}
      >
        {carregandoCF ? (
          <div className="py-8 text-center text-sm text-gray-400">Carregando…</div>
        ) : custosFixos.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-400">
            <Building2 className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum custo fixo cadastrado</p>
            <p className="text-xs mt-1 text-gray-300">Adicione aluguel, contador, internet, pró-labore, etc.</p>
          </div>
        ) : (
          <>
            {/* Agrupa por categoria */}
            {Array.from(new Set(custosFixos.map(c => c.categoria))).map(cat => {
              const itens = custosFixos.filter(c => c.categoria === cat);
              const subtotal = itens.filter(c => c.ativo).reduce((s, c) => s + c.valor_mensal, 0);
              return (
                <div key={cat} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{cat}</span>
                    <span className="text-xs font-semibold text-gray-500">{fmt(subtotal)}/mês</span>
                  </div>
                  <div className="space-y-1.5">
                    {itens.map(cf => (
                      <div key={cf.id} className={cn("flex items-center justify-between rounded-lg border px-4 py-3", cf.ativo ? "border-gray-100 bg-white" : "border-gray-50 bg-gray-50 opacity-60")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("h-2 w-2 rounded-full", cf.ativo ? "bg-green-400" : "bg-gray-300")} />
                          <span className="text-sm text-gray-800">{cf.nome}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-gray-700">{fmt(cf.valor_mensal)}<span className="text-xs font-normal text-gray-400">/mês</span></span>
                          <div className="flex gap-1">
                            <button onClick={() => abrirCF(cf)} className="rounded p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => excluirCF(cf.id)} className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="mt-3 flex justify-end border-t pt-3">
              <span className="text-sm font-bold text-gray-700">Total mensal: <span className="text-[#1a6b2f]">{fmt(totalCustosFixos)}</span></span>
            </div>
          </>
        )}
      </Secao>

      {/* ══════════ DÍVIDAS ══════════ */}
      <Secao
        icone={CreditCard} titulo="Dívidas e Financiamentos" cor="text-red-600"
        aberta={secaoAberta === "dividas"} toggle={() => setSecaoAberta(s => s === "dividas" ? null : "dividas")}
        badge={totalDividaRestante > 0 ? `Saldo devedor: ${fmt(totalDividaRestante)}` : undefined}
        acao={<button onClick={() => abrirDiv()} className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155824]"><Plus className="h-3.5 w-3.5" /> Nova dívida</button>}
      >
        {carregandoDiv ? (
          <div className="py-8 text-center text-sm text-gray-400">Carregando…</div>
        ) : dividas.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-400">
            <CreditCard className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma dívida cadastrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dividas.map(d => {
              const statusD = STATUS_DIVIDA[d.status ?? "em_dia"] ?? STATUS_DIVIDA.em_dia;
              // Calcula parcelas restantes e previsão de quitação
              const parcelasTotal = d.total_parcelas ?? (d.parcela_mensal > 0 && d.valor_total > 0
                ? Math.ceil((d.valor_total - (d.sinal ?? 0)) / d.parcela_mensal)
                : null);
              const parcelasRestantes = parcelasTotal != null
                ? Math.max(0, parcelasTotal - (d.parcelas_pagas ?? 0))
                : null;
              // Previsão de quitação
              let previsaoQuitacao: string | null = null;
              if (parcelasRestantes != null && parcelasRestantes > 0 && d.vencimento_dia) {
                const hoje = new Date();
                const mes = hoje.getMonth() + parcelasRestantes;
                const previsao = new Date(hoje.getFullYear(), mes, d.vencimento_dia);
                previsaoQuitacao = previsao.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
              }
              // Valor pago computado (sinal + parcelas pagas × parcela)
              const valorPagoCalc = (d.sinal ?? 0) + (d.parcelas_pagas ?? 0) * d.parcela_mensal;
              const valorRestante = Math.max(0, d.valor_total - valorPagoCalc);
              const progresso = d.valor_total > 0 ? Math.min(100, (valorPagoCalc / d.valor_total) * 100) : 0;
              const quitada = d.status === "quitada" || valorRestante === 0;

              return (
                <div key={d.id} className={cn("rounded-xl border p-4 transition-all", statusD.bg, !d.ativo && "opacity-60")}>
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">{d.credor}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold border", statusD.bg, statusD.cor)}>
                          {statusD.label}
                        </span>
                        <span className="rounded-full bg-white/70 border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">{d.categoria}</span>
                      </div>
                      {d.descricao && <p className="text-xs text-gray-500 leading-snug">{d.descricao}</p>}
                      {d.observacoes && <p className="text-xs text-gray-400 mt-0.5 italic">{d.observacoes}</p>}
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button onClick={() => abrirDiv(d)} className="rounded p-1.5 text-gray-300 hover:text-gray-600 hover:bg-white/60 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => excluirDiv(d.id)} className="rounded p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Pago: <strong>{fmt(valorPagoCalc)}</strong>{(d.sinal ?? 0) > 0 && <span className="text-gray-400"> (sinal {fmt(d.sinal)})</span>}</span>
                      <span>Total: <strong>{fmt(d.valor_total)}</strong></span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/60 overflow-hidden border border-white/40">
                      <div
                        className={cn("h-2.5 rounded-full transition-all", quitada ? "bg-green-500" : d.status === "em_atraso" ? "bg-red-400" : "bg-[#1a6b2f]")}
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                    <p className="text-right text-[10px] text-gray-400 mt-0.5">{progresso.toFixed(0)}% quitado</p>
                  </div>

                  {/* Info rodapé em grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5 border border-white/50">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Parcela</p>
                      <p className="font-bold text-red-600">{fmt(d.parcela_mensal)}<span className="font-normal text-gray-400">/mês</span></p>
                    </div>
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5 border border-white/50">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Vencimento</p>
                      <p className="font-semibold text-gray-700">Dia {d.vencimento_dia}</p>
                    </div>
                    {parcelasTotal != null && (
                      <div className="rounded-lg bg-white/60 px-2.5 py-1.5 border border-white/50">
                        <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Parcelas</p>
                        <p className="font-semibold text-gray-700">
                          {d.parcelas_pagas ?? 0}/{parcelasTotal}
                          {parcelasRestantes != null && <span className="text-gray-400 font-normal"> ({parcelasRestantes} rest.)</span>}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg bg-white/60 px-2.5 py-1.5 border border-white/50">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">
                        {quitada ? "Quitada" : "Restante"}
                      </p>
                      {quitada
                        ? <p className="font-bold text-green-600">✓ Paga</p>
                        : <p className="font-bold text-gray-800">{fmt(valorRestante)}</p>
                      }
                    </div>
                    {previsaoQuitacao && !quitada && (
                      <div className="col-span-2 sm:col-span-4 rounded-lg bg-white/60 px-2.5 py-1.5 border border-white/50 flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px] uppercase tracking-wide">Previsão de quitação:</span>
                        <span className="font-semibold text-gray-700 text-xs">{previsaoQuitacao}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {totalParcelasMensais > 0 && (
              <div className="flex justify-end border-t pt-3">
                <span className="text-sm font-bold text-gray-700">Comprometimento mensal: <span className="text-red-600">{fmt(totalParcelasMensais)}</span></span>
              </div>
            )}
          </div>
        )}
      </Secao>

      {/* ══════════ CONFIGURAÇÕES ══════════ */}
      <Secao
        icone={Settings2} titulo="Configurações de Orçamento e Veículo" cor="text-gray-500"
        aberta={secaoAberta === "config"} toggle={() => setSecaoAberta(s => s === "config" ? null : "config")}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Alíquota */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Fiscal</p>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alíquota de Impostos (%)</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} step={0.5} value={aliquotaInput} onChange={e => setAliquotaInput(e.target.value)} onKeyDown={e => e.key === "Enter" && salvarAliquota()}
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              <SalvarBtn loading={salvandoAliquota} salvo={aliquotaSalva} onClick={salvarAliquota} />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">Atual: <strong>{aliquota}%</strong></p>
          </div>

          {/* Margem */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Margens nos Orçamentos</p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mínima (%) <span className="text-red-500">● alerta</span></label>
                <input type="number" min={0} max={100} step={0.5} value={margemMinInput} onChange={e => setMargemMinInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ideal (%) <span className="text-green-600">● verde</span></label>
                <input type="number" min={0} max={100} step={0.5} value={margemIdealInput} onChange={e => setMargemIdealInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="border-t border-gray-200 pt-2.5 mt-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Meta BPO (%) <span className="text-blue-500">● CRM</span>
                </label>
                <p className="text-[10px] text-gray-400 mb-1.5">Margem sobre o ponto de equilíbrio para definir a meta de vendas</p>
                <input type="number" min={0} max={200} step={1} value={margemMetaInput} onChange={e => setMargemMetaInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-center outline-none focus:border-[#1a6b2f]" />
              </div>
            </div>
            <SalvarBtn loading={salvandoMargem} salvo={margemSalva} onClick={salvarMargem} className="mt-3" />
          </div>

          {/* Veículo / km */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Car className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Veículo / Km Rodado</p>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Endereço do escritório <span className="text-gray-400">(origem padrão)</span></label>
                <input type="text" value={enderecoEscritorioInput} onChange={e => setEnderecoEscritorioInput(e.target.value)}
                  placeholder="Ex: Rua das Flores, 100, Rio de Janeiro, RJ"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Endereço de casa <span className="text-gray-400">(origem alternativa)</span></label>
                <input type="text" value={enderecoCasaInput} onChange={e => setEnderecoCasaInput(e.target.value)}
                  placeholder="Ex: Av. Principal, 200, Rio de Janeiro, RJ"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="border-t border-gray-100 pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Custo por km</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preço do combustível (R$/litro)</label>
                <input type="number" min={0} step={0.05} value={precoCombInput} onChange={e => setPrecoCombInput(e.target.value)}
                  className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Consumo médio (km/litro)</label>
                <input type="number" min={1} step={0.5} value={consumoKmInput} onChange={e => setConsumoKmInput(e.target.value)}
                  className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Custo de manutenção (R$/km)</label>
                <input type="number" min={0} step={0.01} value={custoManutInput} onChange={e => setCustoManutInput(e.target.value)}
                  className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#1a6b2f]" />
              </div>
            </div>
            {custoPorKm > 0 && (
              <div className="mt-3 rounded-lg bg-[#1a6b2f]/10 px-3 py-2">
                <p className="text-xs text-[#1a6b2f]">Custo total por km: <strong>{custoPorKm.toFixed(2).replace(".", ",")} R$/km</strong></p>
              </div>
            )}
            <SalvarBtn loading={salvandoVeiculo} salvo={veiculoSalvo} onClick={salvarVeiculo} className="mt-3" />
          </div>

          {/* Trajetos pré-cadastrados */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4 sm:col-span-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">🗺</span>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Trajetos</p>
            </div>
            <p className="text-xs text-gray-400 mb-4">Cada trajeto agrupa o custo de combustível + pedágios. No orçamento, basta selecionar o trajeto e tudo é adicionado de uma vez.</p>

            {/* Lista de trajetos existentes */}
            <div className="space-y-2 mb-4">
              {trajetos.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-2">Nenhum trajeto cadastrado</p>
              )}
              {trajetos.map(t => {
                const totalTrajeto = t.combustivel + t.pedagogios.reduce((acc, p) => acc + p.valor, 0);
                const expandido = trajetoExpandido === t.id;
                return (
                  <div key={t.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                      onClick={() => setTrajetoExpandido(expandido ? null : t.id)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{t.nome}</span>
                        <span className="text-xs text-gray-400">
                          ⛽ {t.combustivel.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          {t.pedagogios.length > 0 && ` · ${t.pedagogios.length} pedágio${t.pedagogios.length > 1 ? "s" : ""}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-orange-600">
                          {totalTrajeto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <button onClick={e => { e.stopPropagation(); removerTrajeto(t.id); }}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {expandido && t.pedagogios.length > 0 && (
                      <div className="border-t border-gray-100 px-3 py-2 space-y-1">
                        {t.pedagogios.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs text-gray-500">
                            <span>🛣 {p.nome}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-orange-500">{p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                              <button onClick={() => removerPedagioDoTrajeto(t.id, p.id)} className="text-gray-300 hover:text-red-400">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Formulário novo trajeto */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Novo trajeto</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome do trajeto</label>
                  <input type="text" value={novoTrajetoNome} onChange={e => setNovoTrajetoNome(e.target.value)}
                    placeholder="Ex: Rio → obra SP"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">⛽ Combustível (R$)</label>
                  <input type="number" min={0} step={1} value={novoTrajComb} onChange={e => setNovoTrajComb(e.target.value)}
                    placeholder="180,00"
                    className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>

              {/* Pedágios do novo trajeto */}
              <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-2">
                <p className="text-xs text-gray-400">🛣 Pedágios do trajeto (opcional)</p>
                {novoTrajPedsTemp.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{p.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-orange-500">{p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      <button onClick={() => setNovoTrajPedsTemp(prev => prev.filter(x => x.id !== p.id))} className="text-gray-300 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-1.5 items-end">
                  <input type="text" value={novoTrajPedNome} onChange={e => setNovoTrajPedNome(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && adicionarPedagioTemp()}
                    placeholder="Nome do pedágio"
                    className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1a6b2f]" />
                  <input type="number" min={0} step={0.5} value={novoTrajPedValor} onChange={e => setNovoTrajPedValor(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && adicionarPedagioTemp()}
                    placeholder="R$"
                    className="w-20 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#1a6b2f]" />
                  <button onClick={adicionarPedagioTemp} disabled={!novoTrajPedNome.trim() || Number(novoTrajPedValor) <= 0}
                    className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <button onClick={salvarNovoTrajeto}
                disabled={salvandoTrajeto || !novoTrajetoNome.trim()}
                className="flex items-center gap-1 rounded-lg bg-[#1a6b2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-40 transition-colors">
                {salvandoTrajeto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {trajetoSalvo ? "Salvo!" : "Salvar Trajeto"}
              </button>
            </div>
          </div>

        </div>
      </Secao>

      {/* Tabela de Lançamentos */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Lançamentos do mês</h2>
          <span className="text-xs text-gray-400">{lancamentos.length} registros</span>
        </div>
        {carregando ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : lancamentos.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <DollarSign className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum lançamento ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lancamentos.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/60">
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{l.descricao}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{l.categoria || "—"}</td>
                  <td className={cn("px-6 py-4 text-right text-sm font-semibold", l.tipo === "receita" ? "text-green-600" : "text-red-600")}>
                    {l.tipo === "despesa" ? "−" : "+"}{fmt(l.valor)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", l.pago ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                      {l.pago ? "Pago" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </>)}

      {/* ══ Modal Lançamento ══ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Novo Lançamento</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["receita", "despesa"] as Tipo[]).map(t => (
                    <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                      className={cn("rounded-lg border py-2.5 text-sm font-medium capitalize transition",
                        form.tipo === t ? t === "receita" ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Descrição *</label>
                <input type="text" value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor (R$) *</label>
                  <input type="number" min={0} step={0.01} value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Data</label>
                  <input type="date" value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                <input type="text" placeholder="Ex: Manutenção, Material, Salário…" value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="pago" checked={form.pago || false} onChange={(e) => setForm({ ...form, pago: e.target.checked })} className="h-4 w-4 rounded border-gray-300 accent-[#1a6b2f]" />
                <label htmlFor="pago" className="text-sm text-gray-700">Já foi pago/recebido</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvar} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Custo Fixo ══ */}
      {modalCF && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalCF(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selCF ? "Editar Custo Fixo" : "Novo Custo Fixo"}</h2>
              <button onClick={() => setModalCF(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formCF.nome || ""} onChange={e => setFormCF({ ...formCF, nome: e.target.value })}
                  placeholder="Ex: Aluguel, Contador, Internet…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor mensal (R$)</label>
                <input type="number" min={0} step={10} value={formCF.valor_mensal ?? 0} onChange={e => setFormCF({ ...formCF, valor_mensal: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                <select value={formCF.categoria || "Administrativo"} onChange={e => setFormCF({ ...formCF, categoria: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                  {CATS_CUSTO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="ativo-cf" checked={formCF.ativo ?? true} onChange={e => setFormCF({ ...formCF, ativo: e.target.checked })} className="rounded border-gray-300 text-[#1a6b2f]" />
                <label htmlFor="ativo-cf" className="text-sm text-gray-700">Ativo (entra nos cálculos)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalCF(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarCF} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Dívida ══ */}
      {modalDiv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalDiv(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            {/* Header fixo */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{selDiv ? "Editar Dívida" : "Nova Dívida"}</h2>
              <button onClick={() => setModalDiv(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            {/* Corpo scrollável */}
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">

              {/* Credor + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Credor *</label>
                  <input type="text" value={formDiv.credor || ""} onChange={e => setFormDiv({ ...formDiv, credor: e.target.value })}
                    placeholder="Ex: Banco Itaú, Fornecedor X…"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                  <select value={formDiv.status || "em_dia"} onChange={e => setFormDiv({ ...formDiv, status: e.target.value as Divida["status"] })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {Object.entries(STATUS_DIVIDA).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Descrição</label>
                <input type="text" value={formDiv.descricao || ""} onChange={e => setFormDiv({ ...formDiv, descricao: e.target.value })}
                  placeholder="Ex: Financiamento caminhonete, Empréstimo capital…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              {/* Categoria */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                <select value={formDiv.categoria || "🏦 Banco / Financeira"} onChange={e => setFormDiv({ ...formDiv, categoria: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                  {CATS_DIVIDA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor total (R$)</label>
                  <input type="number" min={0} step={100} value={formDiv.valor_total ?? 0} onChange={e => setFormDiv({ ...formDiv, valor_total: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Sinal / Entrada (R$)</label>
                  <input type="number" min={0} step={100} value={formDiv.sinal ?? 0} onChange={e => setFormDiv({ ...formDiv, sinal: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>

              {/* Parcelas */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parcelas</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Valor/mês (R$)</label>
                    <input type="number" min={0} step={10} value={formDiv.parcela_mensal ?? 0} onChange={e => setFormDiv({ ...formDiv, parcela_mensal: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Pagas</label>
                    <input type="number" min={0} step={1} value={formDiv.parcelas_pagas ?? 0} onChange={e => setFormDiv({ ...formDiv, parcelas_pagas: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Total (opcional)</label>
                    <input type="number" min={0} step={1}
                      value={formDiv.total_parcelas ?? ""}
                      onChange={e => setFormDiv({ ...formDiv, total_parcelas: e.target.value ? Number(e.target.value) : null })}
                      placeholder="—"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b2f]" />
                  </div>
                </div>
                {/* Preview previsão */}
                {(formDiv.total_parcelas ?? 0) > 0 && (formDiv.parcelas_pagas ?? 0) >= 0 && (formDiv.vencimento_dia ?? 0) > 0 && (() => {
                  const restantes = (formDiv.total_parcelas ?? 0) - (formDiv.parcelas_pagas ?? 0);
                  if (restantes > 0) {
                    const hoje = new Date();
                    const previsao = new Date(hoje.getFullYear(), hoje.getMonth() + restantes, formDiv.vencimento_dia ?? 10);
                    return <p className="text-xs text-gray-500">📅 Previsão de quitação: <strong>{previsao.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong></p>;
                  }
                  return null;
                })()}
              </div>

              {/* Vencimento + Data início */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Vence dia do mês</label>
                  <input type="number" min={1} max={28} value={formDiv.vencimento_dia ?? 10}
                    onChange={e => { const v = parseInt(e.target.value); setFormDiv({ ...formDiv, vencimento_dia: isNaN(v) || v < 1 ? 1 : v > 28 ? 28 : v }); }}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Data de início</label>
                  <input type="date" value={formDiv.data_inicio || ""} onChange={e => setFormDiv({ ...formDiv, data_inicio: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Observações</label>
                <textarea value={formDiv.observacoes || ""} onChange={e => setFormDiv({ ...formDiv, observacoes: e.target.value })}
                  placeholder="Notas sobre negociação, histórico, contato…"
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] resize-none" />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="ativo-div" checked={formDiv.ativo ?? true} onChange={e => setFormDiv({ ...formDiv, ativo: e.target.checked })} className="rounded border-gray-300 text-[#1a6b2f]" />
                <label htmlFor="ativo-div" className="text-sm text-gray-700">Ativa (entra nos cálculos)</label>
              </div>
            </div>

            {/* Footer fixo */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setModalDiv(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarDiv} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Secao({ icone: Icone, titulo, cor, aberta, toggle, badge, acao, children }: {
  icone: React.ElementType; titulo: string; cor: string;
  aberta: boolean; toggle: () => void;
  badge?: string; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icone className={cn("h-4 w-4", cor)} />
          <span className="text-sm font-semibold text-gray-800">{titulo}</span>
          {badge && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{badge}</span>}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {acao}
          {aberta ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {aberta && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
    </div>
  );
}

function KpiCard({ titulo, valor, sub, cor, icone: Icone, tooltip }: {
  titulo: string; valor: string; sub: string;
  cor: string; icone: React.ElementType; tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("rounded-lg p-2", cor)}><Icone className="h-4 w-4" /></div>
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
          {titulo}
          {tooltip && <span title={tooltip}><Info className="h-3 w-3 text-gray-300" /></span>}
        </span>
      </div>
      <p className="text-xl font-bold text-gray-900">{valor}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function Indicador({ label, valor, status, desc }: { label: string; valor: string; status: "verde" | "amarelo" | "vermelho"; desc: string }) {
  const cor = status === "verde" ? "bg-green-50 border-green-200 text-green-700" : status === "amarelo" ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-red-50 border-red-200 text-red-700";
  const emoji = status === "verde" ? "🟢" : status === "amarelo" ? "🟡" : "🔴";
  return (
    <div className={cn("rounded-xl border p-4", cor)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{emoji} {label}</span>
        <span className="text-lg font-bold">{valor}</span>
      </div>
      <p className="text-[11px] opacity-70">{desc}</p>
    </div>
  );
}

// ─── ContaAzulView ────────────────────────────────────────────────────────────
function ContaAzulView({
  conectado, carregando, vendas, cobrancas, contratos, saldos, contasPagar, crmContratos,
  ultimoSync, filtroMeses, setFiltroMeses, horizonteFuturo, setHorizonteFuturo,
}: {
  conectado: boolean;
  carregando: boolean;
  vendas: CaVenda[];
  cobrancas: CaCobranca[];
  contratos: CaContrato[];
  saldos: CaSaldo[];
  contasPagar: CaContaPagar[];
  crmContratos: CrmContrato[];
  ultimoSync: string | null;
  filtroMeses: 1 | 2 | 3;
  setFiltroMeses: (v: 1 | 2 | 3) => void;
  horizonteFuturo: 30 | 60 | 90;
  setHorizonteFuturo: (v: 30 | 60 | 90) => void;
}) {
  const [filtroCobrancas, setFiltroCobrancas] = useState<"todos" | "a_receber" | "vencidos" | "recebidos">("a_receber");
  const [filtroContasPagar, setFiltroContasPagar] = useState<"todos" | "a_pagar" | "vencidos" | "pagos">("a_pagar");

  // Período: padrão = início do mês atual até fim do próximo mês
  const hoje2 = new Date();
  const defaultInicio = new Date(hoje2.getFullYear(), hoje2.getMonth(), 1).toISOString().slice(0, 10);
  const defaultFim = new Date(hoje2.getFullYear(), hoje2.getMonth() + 2, 0).toISOString().slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState(defaultInicio);
  const [periodoFim, setPeriodoFim] = useState(defaultFim);

  // Aplica filtro de período nas cobranças e contas a pagar
  const cobrancasFiltradas = cobrancas.filter(c => {
    if (!c.vencimento) return true;
    return c.vencimento >= periodoInicio && c.vencimento <= periodoFim;
  });
  const contasPagarFiltradas = contasPagar.filter(c => {
    if (!c.vencimento) return true;
    return c.vencimento >= periodoInicio && c.vencimento <= periodoFim;
  });

  if (!conectado) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
          <span className="text-4xl">💙</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Conta Azul não conectado</h2>
          <p className="mt-1 text-sm text-gray-500">Conecte sua conta para sincronizar vendas, cobranças e contratos.</p>
        </div>
        <Link
          to="/painel/auth/conta-azul"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Conectar Conta Azul
        </Link>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-sm">Carregando dados do Conta Azul…</span>
      </div>
    );
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const horizonte = new Date(hoje.getTime() + horizonteFuturo * 24 * 60 * 60 * 1000);

  // Status que significam "pago/recebido" na API Conta Azul
  const STATUS_PAGO = ["RECEIVED", "PAID", "ACQUITTED", "RECEBIDO", "PAGO"];
  const isPago = (status: string | null | undefined) => !!status && STATUS_PAGO.includes(status.toUpperCase());
  // Status que significam "cancelado"
  const STATUS_CANCELADO = ["CANCELED", "CANCELLED", "CANCELADO"];
  const isCancelado = (status: string | null | undefined) => !!status && STATUS_CANCELADO.includes(status.toUpperCase());

  const totalFaturado = vendas.reduce((s, v) => s + v.valor_total, 0);
  const totalRecebido = cobrancasFiltradas.filter(c => isPago(c.status)).reduce((s, c) => s + c.valor_pago, 0);
  const aReceber = cobrancasFiltradas.filter(c => {
    if (isPago(c.status) || isCancelado(c.status)) return false;
    if (!c.vencimento) return false;
    const venc = new Date(c.vencimento);
    venc.setHours(0, 0, 0, 0);
    return venc >= hoje && venc <= horizonte;
  }).reduce((s, c) => s + (c.valor - c.valor_pago), 0);
  const emAtraso = cobrancasFiltradas.filter(c => {
    if (isPago(c.status) || isCancelado(c.status)) return false;
    if (!c.vencimento) return false;
    const venc = new Date(c.vencimento);
    venc.setHours(0, 0, 0, 0);
    return venc < hoje;
  }).reduce((s, c) => s + (c.valor - c.valor_pago), 0);
  const totalAReceber = cobrancasFiltradas
    .filter(c => !isPago(c.status) && !isCancelado(c.status))
    .reduce((s, c) => s + (c.valor - c.valor_pago), 0);

  // ── Saldos e contas a pagar ──
  const saldoTotal = saldos.filter(s => s.ativo).reduce((acc, s) => acc + s.saldo, 0);
  const aPagarVencidos = contasPagarFiltradas.filter(c => {
    if (isPago(c.status) || isCancelado(c.status)) return false;
    if (!c.vencimento) return false;
    const venc = new Date(c.vencimento);
    venc.setHours(0, 0, 0, 0);
    return venc < hoje;
  }).reduce((s, c) => s + (c.valor - c.valor_pago), 0);
  const aPagarProximo = contasPagarFiltradas.filter(c => {
    if (isPago(c.status) || isCancelado(c.status)) return false;
    if (!c.vencimento) return false;
    const venc = new Date(c.vencimento);
    venc.setHours(0, 0, 0, 0);
    return venc >= hoje && venc <= horizonte;
  }).reduce((s, c) => s + (c.valor - c.valor_pago), 0);

  // ── Conciliação: contratos CRM sem contrato ativo no CA ───────────────────
  const nomesCA = contratos
    .filter(c => c.status === "ACTIVE" || c.status === "active")
    .map(c => c.cliente_nome.toLowerCase().trim());

  const contratosSemCA = crmContratos.filter(crm => {
    const nomeCrm = (crm.lead?.empresa ?? crm.lead?.nome ?? "").toLowerCase().trim();
    return nomeCrm && !nomesCA.some(n => n.includes(nomeCrm) || nomeCrm.includes(n));
  });

  const statusBadge = (status: string | null | undefined) => {
    if (!status) return "bg-gray-100 text-gray-500";
    const s = status.toUpperCase();
    if (["RECEIVED", "PAID", "ACQUITTED", "RECEBIDO", "PAGO", "ACTIVE", "ATIVO"].includes(s)) return "bg-green-100 text-green-700";
    if (["OVERDUE", "LATE", "VENCIDO"].includes(s)) return "bg-red-100 text-red-700";
    if (["PENDING", "AWAITING", "PENDENTE", "AGUARDANDO"].includes(s)) return "bg-yellow-100 text-yellow-700";
    if (["CANCELED", "CANCELLED", "CANCELADO"].includes(s)) return "bg-gray-100 text-gray-500";
    return "bg-blue-100 text-blue-700";
  };

  const statusLabel = (status: string | null | undefined) => {
    if (!status) return "—";
    const s = status.toUpperCase();
    if (["RECEIVED", "PAID", "ACQUITTED"].includes(s)) return "Recebido";
    if (["OVERDUE", "LATE"].includes(s)) return "Vencido";
    if (["PENDING", "AWAITING"].includes(s)) return "Pendente";
    if (["CANCELED", "CANCELLED"].includes(s)) return "Cancelado";
    if (s === "ACTIVE" || s === "ATIVO") return "Ativo";
    return status;
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="space-y-6">

      {/* ── KPIs linha 1: Saldos bancários ── */}
      {saldos.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">💙 Saldo das contas</span>
            <span className="ml-auto text-lg font-bold text-blue-700">{fmt(saldoTotal)}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {saldos.filter(s => s.ativo).map(s => (
              <div key={s.id} className="rounded-lg bg-white border border-blue-100 px-3 py-2 flex items-center gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-800">{s.nome}</p>
                  {s.banco && <p className="text-[10px] text-gray-400">{s.banco}{s.agencia ? ` · Ag ${s.agencia}` : ""}</p>}
                </div>
                <p className="text-sm font-bold text-gray-900 ml-2">{fmt(s.saldo)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Seletor de período ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-gray-500">Período:</span>
        {[
          { label: "Este mês", inicio: new Date(hoje2.getFullYear(), hoje2.getMonth(), 1).toISOString().slice(0,10), fim: new Date(hoje2.getFullYear(), hoje2.getMonth()+1, 0).toISOString().slice(0,10) },
          { label: "Próx. 30d", inicio: hoje2.toISOString().slice(0,10), fim: new Date(hoje2.getTime()+30*86400000).toISOString().slice(0,10) },
          { label: "Próx. 60d", inicio: hoje2.toISOString().slice(0,10), fim: new Date(hoje2.getTime()+60*86400000).toISOString().slice(0,10) },
          { label: "Próx. 90d", inicio: hoje2.toISOString().slice(0,10), fim: new Date(hoje2.getTime()+90*86400000).toISOString().slice(0,10) },
          { label: "Tudo", inicio: "2000-01-01", fim: "2099-12-31" },
        ].map(p => (
          <button key={p.label} onClick={() => { setPeriodoInicio(p.inicio); setPeriodoFim(p.fim); }}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition",
              periodoInicio === p.inicio && periodoFim === p.fim ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}>{p.label}</button>
        ))}
        <span className="text-xs text-gray-400 ml-1">|</span>
        <div className="flex items-center gap-1.5">
          <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-xs text-gray-400">até</span>
          <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
      </div>

      {/* ── KPIs linha 2: Recebíveis e pagamentos ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total a receber", valor: fmt(totalAReceber), icon: FileText, cor: "bg-blue-50 text-blue-600" },
          { label: "Recebido", valor: fmt(totalRecebido), icon: CheckCircle2, cor: "bg-green-50 text-green-600" },
          { label: `A receber vencidos`, valor: fmt(emAtraso), icon: AlertCircle, cor: emAtraso > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400" },
          { label: `A pagar vencidos`, valor: fmt(aPagarVencidos), icon: TrendingDown, cor: aPagarVencidos > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-lg", kpi.cor)}>
              <kpi.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="mt-0.5 text-xl font-bold text-gray-900">{kpi.valor}</p>
          </div>
        ))}
      </div>

      {/* ── Boletos / Recebíveis ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">Boletos &amp; Recebíveis</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "a_receber", label: "A receber" },
              { key: "vencidos", label: "Vencidos" },
              { key: "recebidos", label: "Recebidos" },
              { key: "todos", label: "Todos" },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFiltroCobrancas(f.key)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filtroCobrancas === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>{f.label}</button>
            ))}
            <span className="text-xs text-gray-400 ml-1">|</span>
            <span className="text-xs text-gray-500">Horizonte:</span>
            {([30, 60, 90] as const).map(d => (
              <button key={d} onClick={() => setHorizonteFuturo(d)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition",
                  horizonteFuturo === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-5 py-3">Descrição</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Pago</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const filtradas = cobrancasFiltradas.filter(c => {
                  if (filtroCobrancas === "recebidos") return isPago(c.status);
                  if (filtroCobrancas === "vencidos") {
                    if (isPago(c.status) || isCancelado(c.status)) return false;
                    const venc = new Date(c.vencimento ?? "");
                    venc.setHours(0,0,0,0);
                    return c.vencimento && venc < hoje;
                  }
                  if (filtroCobrancas === "a_receber") {
                    if (isPago(c.status) || isCancelado(c.status)) return false;
                    const venc = new Date(c.vencimento ?? "");
                    venc.setHours(0,0,0,0);
                    return c.vencimento && venc >= hoje && venc <= horizonte;
                  }
                  return true; // todos
                });
                if (filtradas.length === 0) return (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">Nenhuma cobrança encontrada</td></tr>
                );
                return filtradas.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[180px] truncate">{c.descricao}</td>
                    <td className="px-4 py-3.5 text-gray-600 max-w-[160px] truncate">{c.cliente_nome ?? "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600">{fmtDate(c.vencimento)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-900">{fmt(c.valor)}</td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{c.valor_pago > 0 ? fmt(c.valor_pago) : "—"}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusBadge(c.status))}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Contas a pagar ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-gray-800">Contas a Pagar</span>
            {aPagarVencidos > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                ⚠ {fmt(aPagarVencidos)} vencidos
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "a_pagar", label: "A pagar" },
              { key: "vencidos", label: "Vencidos" },
              { key: "pagos", label: "Pagos" },
              { key: "todos", label: "Todos" },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFiltroContasPagar(f.key)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filtroContasPagar === f.key ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-5 py-3">Descrição</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const filtradas = contasPagarFiltradas.filter(c => {
                  if (filtroContasPagar === "pagos") return isPago(c.status);
                  if (filtroContasPagar === "vencidos") {
                    if (isPago(c.status) || isCancelado(c.status)) return false;
                    const venc = new Date(c.vencimento ?? "");
                    venc.setHours(0,0,0,0);
                    return c.vencimento && venc < hoje;
                  }
                  if (filtroContasPagar === "a_pagar") {
                    if (isPago(c.status) || isCancelado(c.status)) return false;
                    const venc = new Date(c.vencimento ?? "");
                    venc.setHours(0,0,0,0);
                    return c.vencimento && venc >= hoje && venc <= horizonte;
                  }
                  return true; // todos
                });
                if (filtradas.length === 0) return (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-gray-400">Nenhuma conta a pagar encontrada</td></tr>
                );
                return filtradas.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[180px] truncate">{c.descricao}</td>
                    <td className="px-4 py-3.5 text-gray-600 max-w-[160px] truncate">{c.fornecedor_nome ?? "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600">{fmtDate(c.vencimento)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-900">{fmt(c.valor)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusBadge(c.status))}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Vendas / Faturamento ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">Vendas Emitidas</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{vendas.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Período:</span>
            {([1, 2, 3] as const).map(m => (
              <button
                key={m}
                onClick={() => setFiltroMeses(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filtroMeses === m ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >{m}m</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-5 py-3">Nº</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendas.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">Nenhuma venda encontrada</td></tr>
              ) : vendas.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">{v.numero ?? v.id.slice(0, 8)}</td>
                  <td className="px-4 py-3.5 font-medium text-gray-900 max-w-[200px] truncate">{v.cliente_nome}</td>
                  <td className="px-4 py-3.5 text-gray-600">{fmtDate(v.data_emissao)}</td>
                  <td className="px-4 py-3.5 text-gray-600">{fmtDate(v.data_vencimento)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{fmt(v.valor_total)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusBadge(v.status))}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Conciliação de Contratos ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <Repeat className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">Conciliação de Contratos</span>
          {contratosSemCA.length > 0 && (
            <span className="ml-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
              ⚠ {contratosSemCA.length} sem faturamento
            </span>
          )}
        </div>

        {/* Contratos CA */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Contratos ativos no Conta Azul ({contratos.filter(c => c.status === "ACTIVE" || c.status === "active").length})</p>
          {contratos.filter(c => c.status === "ACTIVE" || c.status === "active").length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum contrato ativo encontrado no Conta Azul.</p>
          ) : (
            <div className="space-y-2">
              {contratos.filter(c => c.status === "ACTIVE" || c.status === "active").map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.cliente_nome}</p>
                    <p className="text-xs text-gray-500">{c.nome} · {c.periodicidade ?? "mensal"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmt(c.valor)}</p>
                    <p className="text-xs text-gray-500">{fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas: contratos CRM sem CA */}
        {contratosSemCA.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-500">Contratos fechados no CRM sem faturamento no Conta Azul</p>
            <div className="space-y-2">
              {contratosSemCA.map(crm => (
                <div key={crm.id} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{crm.lead?.empresa ?? crm.lead?.nome ?? crm.nome_arquivo}</p>
                    <p className="text-xs text-gray-500">Proposta fechada · sem contrato ativo no Conta Azul</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contratosSemCA.length === 0 && contratos.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3">
            <p className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Todos os contratos CRM estão conciliados com o Conta Azul.
            </p>
          </div>
        )}
      </div>

      {ultimoSync && (
        <p className="text-center text-xs text-gray-400">
          Última sincronização: {new Date(ultimoSync).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function SalvarBtn({ loading, salvo, onClick, className }: { loading: boolean; salvo: boolean; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
        salvo ? "bg-green-500" : "bg-[#1a6b2f] hover:bg-[#155824]",
        loading && "opacity-60 cursor-not-allowed", className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <Check className="h-4 w-4" /> : null}
      {salvo ? "Salvo!" : "Salvar"}
    </button>
  );
}
