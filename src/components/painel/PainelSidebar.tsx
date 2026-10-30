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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PERFIS } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MENU = [
  { modulo: "dashboard",  label: "Dashboard",        href: "/painel",            icon: LayoutDashboard },
  { modulo: "crm",        label: "CRM Comercial",    href: "/painel/crm",        icon: Users },
  { modulo: "contratos",  label: "Contratos",         href: "/painel/contratos",  icon: FileText },
  { modulo: "orcamentos", label: "Orçamentos",        href: "/painel/orcamentos", icon: Calculator },
  { modulo: "logistica",  label: "Logística",         href: "/painel/logistica",  icon: Package },
  { modulo: "financeiro", label: "Financeiro",        href: "/painel/financeiro", icon: DollarSign },
  { modulo: "pessoas",    label: "Gestão de Pessoas", href: "/painel/pessoas",    icon: UserCog },
  { modulo: "crm",       label: "Script de Vendas",  href: "/painel/script-vendas", icon: BookOpen },
];

const STORAGE_KEY = "portibras_sidebar_collapsed";

export function PainelSidebar() {
  const { usuario, logout, temAcesso } = useAuth();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const [recolhido, setRecolhido] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(recolhido)); }
    catch { /* ignore */ }
  }, [recolhido]);

  const itensVisiveis = MENU.filter((item) => temAcesso(item.modulo));

  return (
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

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
        <ul className="space-y-1">
          {itensVisiveis.map((item) => {
            const Icon = item.icon;
            const ativo = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href));
            return (
              <li key={item.modulo}>
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
            /* Avatar compacto quando recolhido */
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
  );
}
