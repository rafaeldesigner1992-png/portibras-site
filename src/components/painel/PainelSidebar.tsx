import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calculator,
  Package,
  DollarSign,
  UserCog,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Building2,
  GitBranch,
  Target,
  Megaphone,
  Ticket,
  X,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PERFIS, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MENU = [
  { modulo: "dashboard",   label: "Dashboard",        href: "/painel",               icon: LayoutDashboard },
  { modulo: "crm",         label: "CRM Comercial",    href: "/painel/crm",           icon: Users },
  { modulo: "hunter",      label: "Hunter",            href: "/painel/hunter",        icon: Target },
  { modulo: "crm",         label: "Clientes",          href: "/painel/clientes",      icon: Building2 },
  { modulo: "contratos",   label: "Contratos",         href: "/painel/contratos",     icon: FileText },
  { modulo: "orcamentos",  label: "Orçamentos",        href: "/painel/orcamentos",    icon: Calculator },
  { modulo: "logistica",   label: "Logística",         href: "/painel/logistica",     icon: Package },
  { modulo: "financeiro",  label: "Financeiro",        href: "/painel/financeiro",    icon: DollarSign },
  { modulo: "organograma", label: "Gestão de Pessoas", href: "/painel/pessoas",       icon: UserCog },
  { modulo: "organograma", label: "Organograma / RH",  href: "/painel/organograma",   icon: GitBranch },
  { modulo: "crm",         label: "Script de Vendas",  href: "/painel/script-vendas", icon: BookOpen },
  { modulo: "marketing",   label: "Marketing / Ads",   href: "/painel/marketing",     icon: Megaphone },
];

const STORAGE_KEY = "portibras_sidebar_collapsed";

type TicketForm = {
  busca: string;
  pedidoId: string;
  clienteNome: string;
  motivo: string;
  prioridade: "alta" | "media" | "baixa";
  contatoNome: string;
  contatoTel: string;
};

type PedidoOpt = { id: string; label: string; endereco: string | null; email: string | null };

export function PainelSidebar() {
  const { usuario, logout, temAcesso } = useAuth();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const [recolhido, setRecolhido] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; }
    catch { return false; }
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pedidosOpts, setPedidosOpts] = useState<PedidoOpt[]>([]);
  const [form, setForm] = useState<TicketForm>({
    busca: "", pedidoId: "", clienteNome: "",
    motivo: "", prioridade: "alta", contatoNome: "", contatoTel: "",
  });
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(recolhido)); }
    catch { /* ignore */ }
  }, [recolhido]);

  async function abrirModal() {
    setModalAberto(true);
    setForm({ busca: "", pedidoId: "", clienteNome: "", motivo: "", prioridade: "alta", contatoNome: "", contatoTel: "" });
    // Load recent pedidos
    const { data } = await supabase
      .from("logistica_pedidos")
      .select("id, cliente_nome, cliente_empresa, cliente_endereco, cliente_email")
      .not("etapa", "in", "(cancelado)")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (data) setPedidosOpts(data.map(p => ({
      id: p.id,
      label: p.cliente_empresa || p.cliente_nome || "Cliente",
      endereco: p.cliente_endereco,
      email: p.cliente_email,
    })));
    setTimeout(() => buscaRef.current?.focus(), 100);
  }

  const pedidosFiltrados = pedidosOpts.filter(p =>
    p.label.toLowerCase().includes(form.busca.toLowerCase())
  );

  async function salvarTicket() {
    if (!form.motivo.trim()) return;
    setSalvando(true);
    const slaAt = new Date();
    slaAt.setDate(slaAt.getDate() + 4);

    const payload: Record<string, unknown> = {
      is_ticket: true,
      ticket_motivo: form.motivo.trim(),
      ticket_prioridade: form.prioridade,
      ticket_contato_nome: form.contatoNome.trim() || null,
      ticket_contato_tel: form.contatoTel.trim() || null,
      ticket_sla_at: slaAt.toISOString(),
      etapa: "tratamento",
      tipo_cobranca: "antes",
    };

    let clienteEmail: string | null = null;

    if (form.pedidoId) {
      // Link to existing pedido: clone key fields
      const orig = pedidosOpts.find(p => p.id === form.pedidoId);
      if (orig) {
        payload.cliente_nome = orig.label;
        payload.cliente_empresa = orig.label;
        payload.cliente_endereco = orig.endereco;
        clienteEmail = orig.email;
      }
      payload.observacoes = `Ticket vinculado ao pedido: ${form.pedidoId}`;
    } else {
      payload.cliente_nome = form.clienteNome.trim() || "Ticket sem vínculo";
    }

    await supabase.from("logistica_pedidos").insert(payload);

    // Enviar e-mail de confirmação ao cliente (se houver e-mail)
    if (clienteEmail) {
      try {
        await supabase.functions.invoke("send-ticket-email", {
          body: {
            cliente_email: clienteEmail,
            cliente_nome: payload.cliente_nome as string,
            cliente_empresa: payload.cliente_empresa as string | undefined,
            ticket_motivo: payload.ticket_motivo as string,
            ticket_prioridade: payload.ticket_prioridade as string,
            ticket_sla_at: slaAt.toISOString(),
            ticket_contato_nome: payload.ticket_contato_nome as string | undefined,
            ticket_contato_tel: payload.ticket_contato_tel as string | undefined,
          },
        });
      } catch (err) {
        console.warn("[Ticket] E-mail não enviado:", err);
        // Não bloqueia o fluxo — ticket já foi criado
      }
    }

    setSalvando(false);
    setModalAberto(false);
    // Dispatch event so logistica page can refresh
    window.dispatchEvent(new CustomEvent("portibras:ticket-criado"));
  }

  const itensVisiveis = MENU.filter((item) => temAcesso(item.modulo));

  return (
    <>
      <aside
        className={cn(
          "relative flex h-screen flex-col border-r border-gray-200 bg-white transition-[width] duration-300 ease-in-out flex-shrink-0",
          recolhido ? "w-[68px]" : "w-64"
        )}
      >
        {/* Logo + botão toggle */}
        <div className={cn(
          "flex items-center border-b border-gray-100 transition-all duration-300",
          recolhido ? "justify-center px-0 py-5" : "gap-3 px-6 py-5"
        )}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a6b2f]">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          {!recolhido && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">PORTIBRAS</p>
              <p className="text-xs text-gray-500">Painel Interno</p>
            </div>
          )}
        </div>

        {/* Botão de recolher — flutuante sobre a borda direita */}
        <button
          onClick={() => setRecolhido(r => !r)}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[26px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {recolhido
            ? <PanelLeftOpen className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />
          }
        </button>

        {/* Botão Abrir Ticket */}
        {temAcesso("logistica") && (
          <div className={cn("px-2 pt-3 pb-1", recolhido && "flex justify-center")}>
            <button
              onClick={abrirModal}
              title={recolhido ? "Abrir Ticket" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-red-600 text-white text-xs font-semibold transition-colors hover:bg-red-700 active:scale-95",
                recolhido ? "justify-center p-2.5" : "w-full px-3 py-2.5"
              )}
            >
              <Ticket className="h-4 w-4 flex-shrink-0" />
              {!recolhido && "Abrir Ticket"}
            </button>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <ul className="space-y-1">
            {itensVisiveis.map((item) => {
              const Icon = item.icon;
              const ativo = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href));
              return (
                <li key={item.modulo + item.href}>
                  <Link
                    to={item.href}
                    title={recolhido ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      recolhido && "justify-center px-0",
                      ativo
                        ? "bg-[#1a6b2f] text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!recolhido && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {ativo && <ChevronRight className="h-3 w-3 opacity-70" />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Usuário logado */}
        {usuario && (
          <div className={cn("border-t border-gray-100 p-3", recolhido && "flex flex-col items-center")}>
            {!recolhido && (
              <div className="mb-2 flex items-center gap-3 px-1">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]">
                  {usuario.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{usuario.nome}</p>
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", PERFIS[usuario.perfil]?.cor)}>
                    {PERFIS[usuario.perfil]?.label}
                  </span>
                </div>
              </div>
            )}

            {recolhido ? (
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]"
                title={usuario.nome}>
                {usuario.nome.charAt(0).toUpperCase()}
              </div>
            ) : null}

            <button
              onClick={logout}
              title={recolhido ? "Sair" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600",
                recolhido ? "w-auto justify-center px-2" : "w-full"
              )}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!recolhido && "Sair"}
            </button>
          </div>
        )}
      </aside>

      {/* Modal Abrir Ticket */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                  <Ticket className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Abrir Ticket de Retorno</p>
                  <p className="text-xs text-gray-400">SLA emergencial: 4 dias</p>
                </div>
              </div>
              <button onClick={() => setModalAberto(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">
              {/* Busca de cliente */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cliente / Pedido vinculado</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    ref={buscaRef}
                    type="text"
                    placeholder="Buscar cliente..."
                    value={form.busca}
                    onChange={e => setForm(f => ({ ...f, busca: e.target.value, pedidoId: "", clienteNome: "" }))}
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                {form.busca && !form.pedidoId && (
                  <div className="mt-1 rounded-lg border border-gray-100 bg-white shadow-lg max-h-40 overflow-y-auto">
                    {pedidosFiltrados.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400">Nenhum cliente encontrado</p>
                    )}
                    {pedidosFiltrados.map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm border-b border-gray-50 last:border-0"
                        onClick={() => setForm(f => ({ ...f, busca: p.label, pedidoId: p.id, clienteNome: p.label }))}
                      >
                        <span className="font-medium text-gray-900">{p.label}</span>
                        {p.endereco && <span className="block text-xs text-gray-400 truncate">{p.endereco}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {form.pedidoId && (
                  <p className="mt-1 text-xs text-green-700 font-medium">✓ Vinculado a: {form.clienteNome}</p>
                )}
                {!form.pedidoId && form.busca && (
                  <div className="mt-1.5">
                    <label className="block text-xs text-gray-500 mb-1">Ou informe o nome manualmente:</label>
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      value={form.clienteNome}
                      onChange={e => setForm(f => ({ ...f, clienteNome: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                  </div>
                )}
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo do contato <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  placeholder="Ex: Porta não fecha corretamente, fechadura travada..."
                  value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Urgência / Prioridade</label>
                <div className="flex gap-2">
                  {([["alta","Alta","bg-red-100 text-red-700 border-red-300"],["media","Média","bg-yellow-100 text-yellow-700 border-yellow-300"],["baixa","Baixa","bg-gray-100 text-gray-700 border-gray-300"]] as const).map(([v, l, cls]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, prioridade: v }))}
                      className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all", 
                        form.prioridade === v ? cls + " ring-2 ring-offset-1 " + (v === "alta" ? "ring-red-400" : v === "media" ? "ring-yellow-400" : "ring-gray-400") : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}
                    >{l}</button>
                  ))}
                </div>
              </div>

              {/* Contato responsável */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contato responsável</label>
                  <input
                    type="text"
                    placeholder="Nome"
                    value={form.contatoNome}
                    onChange={e => setForm(f => ({ ...f, contatoNome: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">&nbsp;</label>
                  <input
                    type="text"
                    placeholder="Telefone"
                    value={form.contatoTel}
                    onChange={e => setForm(f => ({ ...f, contatoTel: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-4 flex gap-3">
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarTicket}
                disabled={!form.motivo.trim() || salvando}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {salvando ? "Criando..." : "Criar Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
