import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/portibras/Navbar";
import { Diagnostico } from "@/components/portibras/Diagnostico";
import { Footer } from "@/components/portibras/Footer";
import { WhatsAppFloat } from "@/components/portibras/WhatsAppFloat";

export const Route = createFileRoute("/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({
    meta: [
      {
        title: "Diagnóstico Digital de Portas Corta-Fogo — PORTIBRAS",
      },
      {
        name: "description",
        content:
          "Avalie em 60 segundos o nível de risco das portas corta-fogo do seu condomínio segundo a NBR 11.742 e baixe o relatório técnico em PDF.",
      },
      {
        property: "og:title",
        content: "Diagnóstico Digital de Portas Corta-Fogo — PORTIBRAS",
      },
      {
        property: "og:description",
        content:
          "Quiz técnico baseado na NBR 11.742. Receba seu nível de risco e relatório oficial em PDF na hora.",
      },
    ],
  }),
});

function DiagnosticoPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="bg-charcoal-deep">
        <Navbar />
        <div className="h-20" />
      </div>
      <Diagnostico />
      <Footer />
      <WhatsAppFloat />
    </main>
  );
}
