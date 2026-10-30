import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/portibras/Navbar";
import { Hero } from "@/components/portibras/Hero";
import { Differentials } from "@/components/portibras/Differentials";
import { Trust } from "@/components/portibras/Trust";
import { Process } from "@/components/portibras/Process";
import { FinalCTA } from "@/components/portibras/FinalCTA";
import { Footer } from "@/components/portibras/Footer";
import { WhatsAppFloat } from "@/components/portibras/WhatsAppFloat";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title:
          "PORTIBRAS — Manutenção de Portas Corta-Fogo no Rio de Janeiro",
      },
      {
        name: "description",
        content:
          "Manutenção e instalação especializada de portas corta-fogo no RJ. Peças direto da fábrica, parcelamento em até 12x e relatório técnico digital próprio.",
      },
      { property: "og:title", content: "PORTIBRAS — Portas Corta-Fogo RJ" },
      {
        property: "og:description",
        content:
          "Segurança real e conformidade técnica para seu condomínio. Especialistas em portas corta-fogo no Rio de Janeiro.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Differentials />
      <Trust />
      <Process />
      
      <FinalCTA />
      <Footer />
      <WhatsAppFloat />
    </main>
  );
}
