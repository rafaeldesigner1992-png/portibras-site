import { motion } from "framer-motion";
import { MessageCircle, CreditCard, Factory, Flame } from "lucide-react";
import { WHATSAPP_URL } from "./WhatsAppFloat";

export function FinalCTA() {
  return (
    <section id="contato" className="relative bg-charcoal-deep py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-brand-red/20 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-red shadow-red"
        >
          <Flame className="h-7 w-7 text-white" strokeWidth={2.5} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance"
        >
          Solicite agora um <span className="text-brand-red">diagnóstico gratuito</span>.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-white/70 text-lg max-w-2xl mx-auto"
        >
          Manutenção parcelada em até <strong className="text-white">12x</strong> e
          peças <strong className="text-white">direto da fábrica</strong>. Garanta a
          segurança do seu condomínio hoje mesmo.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 rounded-md bg-gradient-red px-8 py-5 text-base font-semibold text-white shadow-red transition hover:translate-y-[-2px] hover:brightness-110"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
            Solicitar Diagnóstico Gratuito
          </a>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
            <CreditCard className="h-5 w-5 text-brand-red shrink-0" />
            <div className="text-sm text-white/80">
              <strong className="text-white">12x</strong> sem complicação
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
            <Factory className="h-5 w-5 text-brand-red shrink-0" />
            <div className="text-sm text-white/80">
              Peças <strong className="text-white">direto da fábrica</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
