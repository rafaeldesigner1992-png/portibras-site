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
  BookOpen,
  Building2,
  GitBranch,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PERFIS } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Itens que aparecem na bottom bar (os 4 mais usados + menu)
const BOTTOM_ITEMS = [
  { modulo: "dashboard", label: "Início",    href: "/painel",        icon: LayoutDashboard },
  { modulo: "crm",       label: "CRM",       href: "/painel/crm",    icon: Users },
  { modulo: "contratos", label: "Contratos", href: "/painel/contratos", icon: FileText },
  { modulo: "logistica", label: "Logística", href: "/painel/logistica", icon: Package },
];

// Todos os itens do menu (para o drawer)
const ALL_ITEMS = [
  { modulo: "dashboard",  label: "Dashboard",        href: "/painel",               icon: LayoutDashboard },
  { modulo: "crm",        label: "CRM Comercial",    href: "/painel/crm",           icon: Users },
  { modulo: "crm",        label: "Clientes",          href: "/painel/clientes",      icon: Building2 },
  { modulo: "contratos",  label: "Contratos",         href: "/painel/contratos",     icon: FileText },
  { modulo: "orcamentos", label: "Orçamentos",        href: "/painel/orcamentos",    icon: Calculator },
  { modulo: "logistica",  label: "Logística",         href: "/painel/logistica",     icon: Package },
  { modulo: "financeiro", label: "Financeiro",        href: "/painel/financeiro",    icon: DollarSign },
  { modulo: "pessoas",    label: "Gestão de Pessoas", href: "/painel/pessoas",       icon: UserCog },
  { modulo: "pessoas",    label: "Organograma / RH",  href: "/painel/organograma",   icon: GitBranch },
  { modulo: "crm",        label: "Script de Vendas",  href: "/painel/script-vendas", icon: BookOpen },
];

export function MobileNav() {
  const { usuario, logout, temAcesso } = useAuth();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const [drawerAberto, setDrawerAberto] = useState(false);

  // Fechar drawer ao navegar
  useEffect(() => { setDrawerAberto(false); }, [pathname]);

  // Travar scroll do body quando drawer aberto
  useEffect(() => {
    if (drawerAberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerAberto]);

  const itensVisiveis = BOTTOM_ITEMS.filter(i => temAcesso(i.modulo));
  const todosVisiveis = ALL_ITEMS.filter(i => temAcesso(i.modulo));

  function isAtivo(href: string) {
    return href === "/painel" ? pathname === "/painel" : pathname.startsWith(href);
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-stretch">
          {itensVisiveis.map(item => {
            const Icon = item.icon;
            const ativo = isAtivo(item.href);
            return (
              <Link key={item.href} to={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  ativo ? "text-[#1a6b2f]" : "text-gray-400"
                )}>
                <Icon className={cn("h-5 w-5 transition-transform", ativo && "scale-110")} />
                <span>{item.label}</span>
                {ativo && <span className="absolute bottom-0 h-0.5 w-10 rounded-t-full bg-[#1a6b2f]" />}
              </Link>
            );
          })}
          {/* Botão menu (abre drawer) */}
          <button onClick={() => setDrawerAberto(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              drawerAberto ? "text-[#1a6b2f]" : "text-gray-400"
            )}>
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Drawer lateral (slide from left) */}
      {drawerAberto && (
        <>
          {/* Overlay escuro */}
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerAberto(false)} />

          {/* Painel do drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

            {/* Cabeçalho do drawer */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"
              style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]">
                  <span className="text-sm font-bold text-white">P</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">PORTIBRAS</p>
                  <p className="text-xs text-gray-400">Painel Interno</p>
                </div>
              </div>
              <button onClick={() => setDrawerAberto(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Usuário */}
            {usuario && (
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]">
                  {usuario.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{usuario.nome}</p>
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", PERFIS[usuario.perfil]?.cor)}>
                    {PERFIS[usuario.perfil]?.label}
                  </span>
                </div>
              </div>
            )}

            {/* Menu completo */}
            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <ul className="space-y-1">
                {todosVisiveis.map((item, idx) => {
                  const Icon = item.icon;
                  const ativo = isAtivo(item.href);
                  return (
                    <li key={`${item.href}-${idx}`}>
                      <Link to={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                          ativo
                            ? "bg-[#1a6b2f] text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        )}>
                        <Icon className="h-4.5 w-4.5 flex-shrink-0 h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        {ativo && <ChevronRight className="h-4 w-4 opacity-60" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Sair */}
            <div className="border-t border-gray-100 px-3 py-3">
              <button onClick={() => { setDrawerAberto(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                <LogOut className="h-5 w-5" />
                Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
