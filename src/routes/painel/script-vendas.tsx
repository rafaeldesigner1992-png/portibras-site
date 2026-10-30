import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/painel/script-vendas")({
  component: ScriptVendas,
});

function ScriptVendas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Garante que o iframe ocupe o espaço disponível sem barra de rolagem externa
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      // Remove overflow do body do iframe para evitar double-scroll
      try {
        if (iframe.contentDocument?.body) {
          iframe.contentDocument.body.style.overflow = "hidden";
        }
      } catch {
        // cross-origin: ignora
      }
    };
    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <iframe
        ref={iframeRef}
        src="/script-portibras.html"
        title="Script de Vendas PORTIBRAS"
        className="flex-1 border-0 w-full h-full"
        style={{ minHeight: 0 }}
        allowFullScreen
      />
    </div>
  );
}
