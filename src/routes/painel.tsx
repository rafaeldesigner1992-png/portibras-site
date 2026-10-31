import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PainelSidebar } from "@/components/painel/PainelSidebar";
import { MobileNav } from "@/components/painel/MobileNav";

export const Route = createFileRoute("/painel")({
  component: PainelLayout,
});

function PainelLayout() {
  const { usuario, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !usuario) {
      navigate({ to: "/acesso" });
    }
  }, [usuario, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#1a6b2f] border-t-transparent" />
          <p className="text-sm text-gray-500">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!usuario) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — oculta no mobile */}
      <div className="hidden md:flex">
        <PainelSidebar />
      </div>
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      {/* Bottom nav — apenas no mobile */}
      <MobileNav />
    </div>
  );
}
