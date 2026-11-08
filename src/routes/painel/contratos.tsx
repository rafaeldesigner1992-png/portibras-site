import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  Plus,
  X,
  Search,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Building2,
  Pencil,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

// ─── Tipo Conta Azul ──────────────────────────────────────────────────────────
interface CaContrato {
  id: string;
  nome: string;
  cliente_nome: string;
  valor: number;
  periodicidade: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  proximo_vencimento: string | null;
  sincronizado_em: string;
}

export const Route = createFileRoute("/painel/contratos")({
  component: ContratosPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusContrato =
  | "ativo"
  | "aguardando_assinatura"
  | "encerrado"
  | "suspenso";

interface Contrato {
  id: string;
  numero: string;
  cliente_id: string | null;
  cliente_nome: string | null; // joined
  status: StatusContrato;
  valor: number | null;
  data_inicio: string | null;
  data_termino: string | null;
  proximo_vencimento: string | null;
  observacoes: string | null;
  criado_em: string;
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    // Usa UTC para evitar shift de fuso (datas vindas como 2026-03-01T00:00:00+00:00)
    const dia = String(d.getUTCDate()).padStart(2, "0");
    const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
    const ano = d.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch {
    return "—";
  }
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

const STATUS_LABEL: Record<StatusContrato, string> = {
  ativo: "Ativo",
  aguardando_assinatura: "Aguardando Assinatura",
  encerrado: "Encerrado",
  suspenso: "Suspenso",
};

const STATUS_STYLE: Record<StatusContrato, string> = {
  ativo: "bg-green-100 text-green-700",
  aguardando_assinatura: "bg-orange-100 text-orange-700",
  encerrado: "bg-gray-100 text-gray-600",
  suspenso: "bg-red-100 text-red-700",
};

// ─── Modal Novo/Editar Contrato ───────────────────────────────────────────────

interface ModalContratoProps {
  contrato: Contrato | null; // null = novo
  clientes: ClienteOpcao[];
  onClose: () => void;
  onSalvo: () => void;
}

function ModalContrato({ contrato, clientes, onClose, onSalvo }: ModalContratoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({
    numero: contrato?.numero ?? "",
    cliente_id: contrato?.cliente_id ?? "",
    status: (contrato?.status ?? "aguardando_assinatura") as StatusContrato,
    valor: contrato?.valor != null ? String(contrato.valor) : "",
    data_inicio: contrato?.data_inicio ?? "",
    data_termino: contrato?.data_termino ?? "",
    proximo_vencimento: contrato?.proximo_vencimento ?? "",
    observacoes: contrato?.observacoes ?? "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.numero.trim()) { setErro("Informe o número do contrato."); return; }
    setSalvando(true);
    setErro(null);

    const payload = {
      numero: form.numero.trim(),
      cliente_id: form.cliente_id || null,
      status: form.status,
      valor: form.valor ? parseFloat(form.valor.replace(",", ".")) : null,
      data_inicio: form.data_inicio || null,
      data_termino: form.data_termino || null,
      proximo_vencimento: form.proximo_vencimento || null,
      observacoes: form.observacoes || null,
    };

    let err;
    if (contrato) {
      ({ error: err } = await supabase.from("contratos").update(payload).eq("id", contrato.id));
    } else {
      ({ error: err } = await supabase.from("contratos").insert(payload));
    }

    setSalvando(false);
    if (err) {
      console.error(err);
      setErro("Erro ao salvar: " + err.message);
      return;
    }
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#1a6b2f]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {contrato ? "Editar Contrato" : "Novo Contrato"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-5 p-6">
          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          {/* Número e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Número *</label>
              <input
                value={form.numero}
                onChange={(e) => set("numero", e.target.value)}
                placeholder="CTR-2024-001"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3.5 py-2.5 pr-8 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
                >
                  {(Object.keys(STATUS_LABEL) as StatusContrato[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Cliente</label>
            <div className="relative">
              <select
                value={form.cliente_id}
                onChange={(e) => set("cliente_id", e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 px-3.5 py-2.5 pr-8 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              >
                <option value="">— Selecionar cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor mensal (R$)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Início</label>
              <input
                type="date"
                value={form.data_inicio}
                onChange={(e) => set("data_inicio", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Término</label>
              <input
                type="date"
                value={form.data_termino}
                onChange={(e) => set("data_termino", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Próx. vencimento</label>
              <input
                type="date"
                value={form.proximo_vencimento}
                onChange={(e) => set("proximo_vencimento", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre o contrato..."
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20 resize-none"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#155824] disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {contrato ? "Salvar alterações" : "Criar contrato"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tabelaMissing, setTabelaMissing] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusContrato | "">("");
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEdicao, setContratoEdicao] = useState<Contrato | null>(null);

  // Conta Azul
  const [caContratos, setCaContratos] = useState<CaContrato[]>([]);
  const [caCarregando, setCaCarregando] = useState(true);

  const carregarContaAzul = useCallback(async () => {
    setCaCarregando(true);
    const { data } = await supabase
      .from("ca_contratos")
      .select("*")
      .order("cliente_nome");
    setCaContratos((data ?? []) as CaContrato[]);
    setCaCarregando(false);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    // Busca contratos com join em clientes
    const { data, error } = await supabase
      .from("contratos")
      .select(`
        id, numero, cliente_id, status, valor,
        data_inicio, data_termino, proximo_vencimento,
        observacoes, criado_em,
        clientes ( nome )
      `)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setTabelaMissing(true);
      }
      setCarregando(false);
      return;
    }

    // Normaliza o join aninhado
    const lista: Contrato[] = (data ?? []).map((row: any) => ({
      ...row,
      cliente_nome: row.clientes?.nome ?? null,
    }));
    setContratos(lista);
    setCarregando(false);
  }, []);

  // Busca clientes para o select do modal
  useEffect(() => {
    supabase
      .from("clientes")
      .select("id, nome")
      .eq("status", "ativo")
      .order("nome")
      .then(({ data }) => setClientes((data ?? []) as ClienteOpcao[]));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarContaAzul(); }, [carregarContaAzul]);

  // ─ Stats ─
  const ativos = contratos.filter((c) => c.status === "ativo").length;
  const aguardando = contratos.filter((c) => c.status === "aguardando_assinatura").length;
  const vencendo30 = contratos.filter((c) => {
    const d = diasAte(c.proximo_vencimento);
    return d !== null && d >= 0 && d <= 30 && c.status === "ativo";
  }).length;

  // ─ Filtros ─
  const filtrados = contratos.filter((c) => {
    const matchBusca =
      !busca ||
      c.numero.toLowerCase().includes(busca.toLowerCase()) ||
      (c.cliente_nome ?? "").toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  function abrirNovo() {
    setContratoEdicao(null);
    setModalAberto(true);
  }

  function abrirEdicao(c: Contrato) {
    setContratoEdicao(c);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setContratoEdicao(null);
  }

  function aoSalvar() {
    fecharModal();
    carregar();
  }

  // ─ Render ─
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="mt-1 text-sm text-gray-500">Emissão e gestão de contratos de manutenção</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      {/* Tabela faltando — aviso DDL */}
      {tabelaMissing && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800">Tabela "contratos" não encontrada no banco de dados</p>
              <p className="mt-1 text-sm text-amber-700">
                Execute o SQL abaixo no <strong>Supabase SQL Editor</strong> para criar a tabela e habilitar este módulo:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-100 p-4 text-xs text-amber-900">
{`CREATE TABLE contratos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             text NOT NULL,
  cliente_id         uuid REFERENCES clientes(id),
  status             text NOT NULL DEFAULT 'aguardando_assinatura'
                       CHECK (status IN ('ativo','aguardando_assinatura','encerrado','suspenso')),
  valor              numeric(12,2),
  data_inicio        date,
  data_termino       date,
  proximo_vencimento date,
  observacoes        text,
  criado_em          timestamptz NOT NULL DEFAULT now()
);

-- Também execute se ainda não tiver a coluna cliente_id no CRM:
-- ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Contratos Conta Azul ──────────────────────────────────────── */}
      {(() => {
        const ativos = caContratos.filter(c =>
          ["ACTIVE", "active", "ATIVO", "ativo", "Ativo", "Active"].includes(c.status)
        );
        const totalMensal = ativos.reduce((s, c) => s + (c.valor ?? 0), 0);
        const vencendo = ativos.filter(c => {
          if (!c.data_fim) return false;
          const dias = Math.round((new Date(c.data_fim).getTime() - Date.now()) / 86400000);
          return dias >= 0 && dias <= 60;
        });

        return (
          <div className="mb-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white overflow-hidden shadow-sm">
            {/* Header Conta Azul */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm">CA</div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Contratos Ativos — Conta Azul</p>
                  <p className="text-xs text-gray-500">Sincronizado automaticamente</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Recorrência mensal</p>
                  <p className="text-lg font-black text-blue-700">
                    {totalMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <button
                  onClick={carregarContaAzul}
                  disabled={caCarregando}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${caCarregando ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Resumo stats */}
            <div className="grid grid-cols-3 divide-x divide-blue-100 border-b border-blue-100">
              <div className="px-6 py-3 text-center">
                <p className="text-2xl font-black text-blue-700">{ativos.length}</p>
                <p className="text-xs text-gray-500">contratos ativos</p>
              </div>
              <div className="px-6 py-3 text-center">
                <p className="text-2xl font-black text-orange-500">{vencendo.length}</p>
                <p className="text-xs text-gray-500">vencem em 60 dias</p>
              </div>
              <div className="px-6 py-3 text-center">
                <p className="text-2xl font-black text-green-600">
                  {ativos.length > 0 ? (totalMensal / ativos.length).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                </p>
                <p className="text-xs text-gray-500">ticket médio</p>
              </div>
            </div>

            {/* Tabela de contratos */}
            {caCarregando ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Carregando do Conta Azul...</span>
              </div>
            ) : ativos.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {caContratos.length === 0
                  ? "Nenhum contrato encontrado. Clique em Sincronizar em Financeiro para importar os contratos do Conta Azul."
                  : `${caContratos.length} contrato(s) encontrado(s), mas nenhum com status ativo. Status encontrados: ${[...new Set(caContratos.map(c => c.status))].join(", ")}`
                }
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50/60 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-left font-semibold">Início</th>
                      <th className="px-4 py-3 text-left font-semibold">Término</th>
                      <th className="px-4 py-3 text-left font-semibold">Próx. Venc.</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor/mês</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ativos.map(c => {
                      const diasFim = c.data_fim
                        ? Math.round((new Date(c.data_fim).getTime() - Date.now()) / 86400000)
                        : null;
                      const alertaFim = diasFim !== null && diasFim >= 0 && diasFim <= 60;
                      const diasProxVenc = c.proximo_vencimento
                        ? Math.round((new Date(c.proximo_vencimento).getTime() - Date.now()) / 86400000)
                        : null;
                      const alertaProxVenc = diasProxVenc !== null && diasProxVenc >= 0 && diasProxVenc <= 10;
                      return (
                        <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-3.5">
                            <p className="font-medium text-gray-900 truncate max-w-[220px]">{c.cliente_nome}</p>
                            {c.nome && c.nome !== c.cliente_nome && (
                              <p className="text-xs text-gray-400 truncate max-w-[220px]">{c.nome}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtData(c.data_inicio)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={alertaFim ? "text-orange-600 font-semibold" : "text-gray-600"}>
                              {fmtData(c.data_fim)}
                            </span>
                            {alertaFim && diasFim !== null && (
                              <p className="text-xs text-orange-500">Restam {diasFim}d</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {c.proximo_vencimento ? (
                              <span className={alertaProxVenc ? "text-red-600 font-semibold" : "text-gray-600"}>
                                {fmtData(c.proximo_vencimento)}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className="font-bold text-gray-900">
                              {(c.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              Ativo
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50/60 border-t border-blue-100">
                      <td colSpan={4} className="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">
                        Total recorrente mensal
                      </td>
                      <td className="px-4 py-3 text-right font-black text-blue-700">
                        {totalMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Contratos Ativos"
          valor={carregando ? "…" : String(ativos)}
          cor="text-green-600"
          bg="bg-green-50"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Aguardando Assinatura"
          valor={carregando ? "…" : String(aguardando)}
          cor="text-orange-600"
          bg="bg-orange-50"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Vencendo em 30 dias"
          valor={carregando ? "…" : String(vencendo30)}
          cor="text-red-600"
          bg="bg-red-50"
        />
      </div>

      {/* Filtros */}
      {!tabelaMissing && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número ou cliente..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
            />
          </div>
          <div className="relative">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusContrato | "")}
              className="appearance-none rounded-lg border border-gray-200 py-2.5 pl-3.5 pr-8 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
            >
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as StatusContrato[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-gray-400" />
          </div>
        </div>
      )}

      {/* Lista de contratos */}
      {!tabelaMissing && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {carregando ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando contratos...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">
                {contratos.length === 0 ? "Nenhum contrato cadastrado ainda" : "Nenhum contrato encontrado"}
              </p>
              {contratos.length === 0 && (
                <button
                  onClick={abrirNovo}
                  className="mt-3 text-sm text-[#1a6b2f] hover:underline"
                >
                  Criar primeiro contrato →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 text-left">Número</th>
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3 text-center">Início</th>
                  <th className="px-5 py-3 text-center">Próx. venc.</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((c) => {
                  const dias = diasAte(c.proximo_vencimento);
                  const vencendoAlerta = dias !== null && dias >= 0 && dias <= 30 && c.status === "ativo";
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-300" />
                          <span className="font-medium text-gray-900">{c.numero}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          {c.cliente_nome ?? <span className="italic text-gray-400">Sem cliente</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 text-gray-700">
                          <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                          {fmtMoeda(c.valor)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-gray-600">
                        {fmtData(c.data_inicio)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {c.proximo_vencimento ? (
                          <span className={`text-xs font-medium ${vencendoAlerta ? "text-red-600" : "text-gray-600"}`}>
                            {fmtData(c.proximo_vencimento)}
                            {vencendoAlerta && dias !== null && (
                              <span className="ml-1 text-red-500">({dias}d)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <button
                          onClick={() => abrirEdicao(c)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          title="Editar contrato"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <ModalContrato
          contrato={contratoEdicao}
          clientes={clientes}
          onClose={fecharModal}
          onSalvo={aoSalvar}
        />
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  valor,
  cor,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  cor: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <span className={`rounded-lg ${bg} ${cor} p-2`}>{icon}</span>
      </div>
      <p className={`mt-3 text-3xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
