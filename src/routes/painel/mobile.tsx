import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarDays, Users, DollarSign, TrendingUp, TrendingDown,
  RefreshCw, Plus, Trash2, Loader2, CheckCircle2, XCircle,
  Clock, Building2, BarChart3, AlertCircle, ChevronDown, ChevronUp,
  Wrench, Package, Target, Wallet, PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/mobile")({
  component: MobilePage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
};

const hoje = () => new Date().toISOString().split("T")[0];

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface AgendaItem {
  id: string;
  data_agendada: string | null;
  hora_inicio: string | null;
  cliente_nome: string | null;
  cliente_empresa: string | null;
  tipo_servico: string | null;
  status: string;
  endereco: string | null;
}

interface CustoCampo {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  atendimento_ref: string | null;
  data: string;
  criado_em: string;
}

interface CaSaldo {
  id: string;
  nome: string;
  saldo: number;
  ativo: boolean;
  banco: string | null;
}

interface Indicadores {
  clientesAtivos: number;
  atendimentosHoje: number;
  atendimentosSemana: number;
  receber: number;
  faturamento30d: number;
  metaContratos: number;
  caContratos: number;
}

// ─── Seção colapsável ─────────────────────────────────────────────────────────
function Secao({ titulo, icon: Icon, cor, children, defaultOpen = true }: {
  titulo: string;
  icon: React.ElementType;
  cor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [aberta, setAberta] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setAberta(a => !a)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", cor)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="flex-1 text-sm font-bold text-gray-800">{titulo}</span>
        {aberta
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />
        }
      </button>
      {aberta && <div className="border-t border-gray-50">{children}</div>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ titulo, valor, sub, icon: Icon, cor, destaque }: {
  titulo: string; valor: string | number; sub?: string;
  icon: React.ElementType; cor: string; destaque?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-white p-3 shadow-sm flex items-center gap-3",
      destaque ? "border-blue-200 bg-blue-50/50" : "border-gray-100"
    )}>
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", cor)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{titulo}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{valor}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function MobilePage() {
  const { usuario } = useAuth();

  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [saldos, setSaldos] = useState<CaSaldo[]>([]);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [custos, setCustos] = useState<CustoCampo[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [atualizandoSaldo, setAtualizandoSaldo] = useState(false);
  const [erroSync, setErroSync] = useState<string | null>(null);

  // Form novo custo
  const [formAberto, setFormAberto] = useState(false);
  const [salvandoCusto, setSalvandoCusto] = useState(false);
  const [novoCusto, setNovoCusto] = useState({
    descricao: "",
    valor: "",
    categoria: "Material",
    atendimento_ref: "",
  });

  // ── Carregar dados ──────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroSync(null);
    try {
      const dataHoje = hoje();
      const data7d = new Date();
      data7d.setDate(data7d.getDate() + 7);
      const data7dStr = data7d.toISOString().split("T")[0];

      const data30d = new Date();
      data30d.setDate(data30d.getDate() - 30);
      const data30dStr = data30d.toISOString().split("T")[0];

      const [
        agendaRes, saldosRes, clientesRes,
        atendimentosRes, cobrancasRes, contratosRes, metasRes, custosRes,
      ] = await Promise.all([
        // Agenda: próximos 7 dias
        supabase
          .from("atendimentos")
          .select("id, data_agendada, hora_inicio, cliente_nome, cliente_empresa, tipo_servico, status, endereco")
          .gte("data_agendada", dataHoje)
          .lte("data_agendada", data7dStr)
          .order("data_agendada", { ascending: true })
          .order("hora_inicio", { ascending: true })
          .limit(30),
        // Saldos Conta Azul
        supabase.from("ca_saldos").select("id, nome, saldo, ativo, banco").eq("ativo", true).order("nome"),
        // Clientes ativos
        supabase.from("clientes").select("id, status").eq("status", "Ativo"),
        // Atendimentos hoje
        supabase.from("atendimentos").select("id, data_agendada, status")
          .eq("data_agendada", dataHoje),
        // A receber (CA)
        supabase.from("ca_cobrancas").select("valor, status").in("status", ["pendente", "em_aberto", "vencida"]),
        // Contratos CA ativos
        supabase.from("ca_contratos").select("id, status").eq("status", "ativo"),
        // Meta de contratos
        supabase.from("metas_kpis").select("meta_valor").eq("indicador", "contratos_ativos").limit(1),
        // Custos de campo (tabela mobile_custos_campo)
        supabase
          .from("mobile_custos_campo")
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(50),
      ]);

      setAgenda(agendaRes.data ?? []);
      setSaldos(saldosRes.data ?? []);

      // Faturamento últimos 30 dias via CA vendas
      const { data: vendasData } = await supabase
        .from("ca_vendas")
        .select("valor_total, status, data_emissao")
        .gte("data_emissao", data30dStr)
        .in("status", ["aprovado", "faturado", "pago"]);

      const faturamento30d = (vendasData ?? []).reduce((s, v) => s + (v.valor_total ?? 0), 0);
      const receber = (cobrancasRes.data ?? []).reduce((s, c) => s + (c.valor ?? 0), 0);
      const metaContratos = metasRes.data?.[0]?.meta_valor ?? 0;

      setIndicadores({
        clientesAtivos: clientesRes.data?.length ?? 0,
        atendimentosHoje: (atendimentosRes.data ?? []).filter(a => a.data_agendada === dataHoje).length,
        atendimentosSemana: agendaRes.data?.length ?? 0,
        receber,
        faturamento30d,
        metaContratos,
        caContratos: contratosRes.data?.length ?? 0,
      });

      setCustos(custosRes.data ?? []);
    } catch (err) {
      setErroSync("Erro ao carregar dados. Tente novamente.");
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Atualizar saldo ContaAzul ───────────────────────────────────────────────
  async function atualizarSaldo() {
    setAtualizandoSaldo(true);
    setErroSync(null);
    try {
      const { error } = await supabase.functions.invoke("conta-azul-sync", {
        body: { tipo: "saldos" },
      });
      if (error) throw error;
      // Recarrega só os saldos
      const { data } = await supabase.from("ca_saldos").select("id, nome, saldo, ativo, banco").eq("ativo", true).order("nome");
      setSaldos(data ?? []);
    } catch {
      setErroSync("Não foi possível sincronizar o saldo. Tente novamente.");
    } finally {
      setAtualizandoSaldo(false);
    }
  }

  // ── Salvar custo ────────────────────────────────────────────────────────────
  async function salvarCusto() {
    if (!novoCusto.descricao.trim() || !novoCusto.valor) return;
    setSalvandoCusto(true);
    try {
      const { data, error } = await supabase.from("mobile_custos_campo").insert({
        descricao: novoCusto.descricao.trim(),
        valor: parseFloat(novoCusto.valor.replace(",", ".")),
        categoria: novoCusto.categoria,
        atendimento_ref: novoCusto.atendimento_ref.trim() || null,
        data: hoje(),
      }).select().single();

      if (error) throw error;
      setCustos(prev => [data, ...prev]);
      setNovoCusto({ descricao: "", valor: "", categoria: "Material", atendimento_ref: "" });
      setFormAberto(false);
    } catch (err) {
      console.error(err);
      setErroSync("Erro ao salvar custo.");
    } finally {
      setSalvandoCusto(false);
    }
  }

  async function excluirCusto(id: string) {
    if (!confirm("Excluir este custo?")) return;
    await supabase.from("mobile_custos_campo").delete().eq("id", id);
    setCustos(prev => prev.filter(c => c.id !== id));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const saldoTotal = saldos.reduce((s, c) => s + c.saldo, 0);
  const agendaHoje = agenda.filter(a => a.data_agendada === hoje());
  const agendaProximos = agenda.filter(a => a.data_agendada !== hoje());

  const totalCustosMes = custos
    .filter(c => c.data >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
    .reduce((s, c) => s + c.valor, 0);

  const statusCor: Record<string, string> = {
    "Em andamento": "bg-blue-100 text-blue-700",
    "Programado": "bg-yellow-100 text-yellow-700",
    "Concluído": "bg-green-100 text-green-700",
    "Cancelado": "bg-red-100 text-red-600",
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1a6b2f] px-4 pt-5 pb-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-200 font-medium">PORTIBRAS</p>
            <h1 className="text-lg font-bold text-white leading-tight">
              Olá, {usuario?.nome?.split(" ")[0] ?? "Rafael"} 👋
            </h1>
            <p className="text-xs text-green-200">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
          </div>
          <button
            onClick={carregar}
            disabled={carregando}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            title="Atualizar tudo"
          >
            <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
          </button>
        </div>

        {/* Saldo destaque */}
        <div className="mt-3 rounded-xl bg-white/15 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-100 font-medium uppercase tracking-wide">Saldo ContaAzul</p>
            {carregando
              ? <div className="h-7 w-32 rounded bg-white/20 animate-pulse mt-1" />
              : <p className="text-2xl font-bold text-white">{fmt$(saldoTotal)}</p>
            }
            {saldos.length > 1 && (
              <p className="text-xs text-green-200">{saldos.length} contas</p>
            )}
          </div>
          <button
            onClick={atualizarSaldo}
            disabled={atualizandoSaldo}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", atualizandoSaldo && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Erro */}
        {erroSync && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {erroSync}
          </div>
        )}

        {/* ── Indicadores ─────────────────────────────────────────────────── */}
        <Secao titulo="Indicadores" icon={BarChart3} cor="bg-purple-500">
          {carregando
            ? <div className="p-4 grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            : (
              <div className="p-3 grid grid-cols-2 gap-2.5">
                <KPICard
                  titulo="Clientes Ativos"
                  valor={indicadores?.clientesAtivos ?? "—"}
                  icon={Users}
                  cor="bg-blue-500"
                  sub="base ativa"
                />
                <KPICard
                  titulo="Hoje"
                  valor={indicadores?.atendimentosHoje ?? 0}
                  icon={Wrench}
                  cor="bg-orange-500"
                  sub="atendimentos"
                />
                <KPICard
                  titulo="Semana"
                  valor={indicadores?.atendimentosSemana ?? 0}
                  icon={CalendarDays}
                  cor="bg-teal-500"
                  sub="agendamentos"
                />
                <KPICard
                  titulo="A Receber"
                  valor={fmt$(indicadores?.receber ?? 0)}
                  icon={TrendingUp}
                  cor="bg-green-600"
                  destaque
                />
                <KPICard
                  titulo="Faturamento 30d"
                  valor={fmt$(indicadores?.faturamento30d ?? 0)}
                  icon={DollarSign}
                  cor="bg-indigo-500"
                />
                <KPICard
                  titulo="Contratos"
                  valor={`${indicadores?.caContratos ?? 0}/${indicadores?.metaContratos ?? "?"}`}
                  icon={Target}
                  cor="bg-pink-500"
                  sub="ativos / meta"
                />
              </div>
            )
          }
        </Secao>

        {/* ── Saldo por conta ──────────────────────────────────────────────── */}
        {saldos.length > 1 && (
          <Secao titulo="Contas" icon={Wallet} cor="bg-blue-600" defaultOpen={false}>
            <div className="divide-y divide-gray-50">
              {saldos.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.nome}</p>
                    {s.banco && <p className="text-xs text-gray-400">{s.banco}</p>}
                  </div>
                  <p className={cn("text-sm font-bold", s.saldo >= 0 ? "text-green-700" : "text-red-600")}>
                    {fmt$(s.saldo)}
                  </p>
                </div>
              ))}
            </div>
          </Secao>
        )}

        {/* ── Agenda ───────────────────────────────────────────────────────── */}
        <Secao titulo="Agenda" icon={CalendarDays} cor="bg-orange-500">
          {carregando
            ? <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            : agenda.length === 0
              ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <CalendarDays className="h-8 w-8 mb-2" />
                  <p className="text-sm">Nenhum agendamento nos próximos 7 dias</p>
                </div>
              )
              : (
                <div className="divide-y divide-gray-50">
                  {/* Hoje */}
                  {agendaHoje.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-orange-50">
                        <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Hoje</span>
                      </div>
                      {agendaHoje.map(a => (
                        <AgendaCard key={a.id} item={a} statusCor={statusCor} />
                      ))}
                    </>
                  )}
                  {/* Próximos */}
                  {agendaProximos.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Próximos dias</span>
                      </div>
                      {agendaProximos.map(a => (
                        <AgendaCard key={a.id} item={a} statusCor={statusCor} />
                      ))}
                    </>
                  )}
                </div>
              )
          }
        </Secao>

        {/* ── Custos de campo ──────────────────────────────────────────────── */}
        <Secao titulo="Custos dos Serviços" icon={Package} cor="bg-red-500">
          {/* Resumo do mês */}
          <div className="px-4 py-3 flex items-center justify-between bg-red-50/60 border-b border-red-100">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-red-500" />
              <span className="text-xs font-semibold text-red-700">Total este mês</span>
            </div>
            <span className="text-sm font-bold text-red-700">{fmt$(totalCustosMes)}</span>
          </div>

          {/* Botão adicionar */}
          <div className="px-4 py-3">
            <button
              onClick={() => setFormAberto(f => !f)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 transition-colors active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Registrar custo
            </button>
          </div>

          {/* Form novo custo */}
          {formAberto && (
            <div className="mx-4 mb-4 rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Novo custo</p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição *</label>
                <input
                  type="text"
                  placeholder="Ex: Parafusos, transporte, almoço equipe..."
                  value={novoCusto.descricao}
                  onChange={e => setNovoCusto(n => ({ ...n, descricao: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={novoCusto.valor}
                    onChange={e => setNovoCusto(n => ({ ...n, valor: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria</label>
                  <select
                    value={novoCusto.categoria}
                    onChange={e => setNovoCusto(n => ({ ...n, categoria: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  >
                    <option>Material</option>
                    <option>Transporte</option>
                    <option>Alimentação</option>
                    <option>Ferramenta</option>
                    <option>Terceiro</option>
                    <option>Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ref. atendimento (opcional)</label>
                <input
                  type="text"
                  placeholder="Nome do cliente ou ID"
                  value={novoCusto.atendimento_ref}
                  onChange={e => setNovoCusto(n => ({ ...n, atendimento_ref: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setFormAberto(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarCusto}
                  disabled={!novoCusto.descricao.trim() || !novoCusto.valor || salvandoCusto}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {salvandoCusto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </button>
              </div>
            </div>
          )}

          {/* Lista de custos */}
          {custos.length === 0
            ? (
              <div className="flex flex-col items-center py-6 text-gray-400">
                <Package className="h-7 w-7 mb-2" />
                <p className="text-sm">Nenhum custo registrado</p>
              </div>
            )
            : (
              <div className="divide-y divide-gray-50 pb-2">
                {custos.map(c => (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          {c.categoria}
                        </span>
                        {c.atendimento_ref && (
                          <span className="text-xs text-blue-500 truncate max-w-[100px]">{c.atendimento_ref}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">{fmt$(c.valor)}</span>
                      <button
                        onClick={() => excluirCusto(c.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Secao>
      </div>
    </div>
  );
}

// ─── Card de item da agenda ───────────────────────────────────────────────────
function AgendaCard({
  item, statusCor,
}: {
  item: AgendaItem;
  statusCor: Record<string, string>;
}) {
  const cliente = item.cliente_empresa || item.cliente_nome || "Cliente";
  const tipoLabel = item.tipo_servico === "manutencao"
    ? "Manutenção"
    : item.tipo_servico === "vistoria"
    ? "Vistoria"
    : item.tipo_servico ?? "Serviço";

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-shrink-0 text-center min-w-[42px]">
        {item.data_agendada && (
          <p className="text-[10px] font-bold text-gray-400 uppercase">
            {new Date(item.data_agendada + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
          </p>
        )}
        {item.hora_inicio
          ? <p className="text-sm font-bold text-gray-700">{item.hora_inicio.slice(0, 5)}</p>
          : <Clock className="h-4 w-4 text-gray-300 mx-auto mt-1" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{cliente}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500">{tipoLabel}</span>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            statusCor[item.status] ?? "bg-gray-100 text-gray-600"
          )}>
            {item.status}
          </span>
        </div>
        {item.endereco && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.endereco}</p>
        )}
      </div>
    </div>
  );
}
