import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PainelSidebar } from "@/components/painel/PainelSidebar";

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
      <PainelSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
