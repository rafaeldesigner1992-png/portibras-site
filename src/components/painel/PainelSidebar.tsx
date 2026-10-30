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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PERFIS } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MENU = [
  { modulo: "dashboard",  label: "Dashboard",       href: "/painel",           icon: LayoutDashboard },
  { modulo: "crm",        label: "CRM Comercial",   href: "/painel/crm",       icon: Users },
  { modulo: "contratos",  label: "Contratos",        href: "/painel/contratos", icon: FileText },
  { modulo: "orcamentos", label: "Orçamentos",       href: "/painel/orcamentos",icon: Calculator },
  { modulo: "logistica",  label: "Logística",        href: "/painel/logistica", icon: Package },
  { modulo: "financeiro", label: "Financeiro",       href: "/painel/financeiro",icon: DollarSign },
  { modulo: "pessoas",    label: "Gestão de Pessoas",href: "/painel/pessoas",   icon: UserCog },
];

export function PainelSidebar() {
  const { usuario, logout, temAcesso } = useAuth();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const itensVisiveis = MENU.filter((item) => temAcesso(item.modulo));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]">
          <span className="text-sm font-bold text-white">P</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">PORTIBRAS</p>
          <p className="text-xs text-gray-500">Painel Interno</p>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {itensVisiveis.map((item) => {
            const Icon = item.icon;
            const ativo = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href));
            return (
              <li key={item.modulo}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    ativo
                      ? "bg-[#1a6b2f] text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {ativo && <ChevronRight className="h-3 w-3 opacity-70" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuário logado */}
      {usuario && (
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]">
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{usuario.nome}</p>
              <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", PERFIS[usuario.perfil]?.cor)}>
                {PERFIS[usuario.perfil]?.label}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </aside>
  );
}
