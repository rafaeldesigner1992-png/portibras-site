import { motion } from "framer-motion";
import { MessageCircle, ShieldCheck, MapPin } from "lucide-react";
import heroImg from "@/assets/hero-firedoor.jpg";
import { WHATSAPP_URL } from "./WhatsAppFloat";

export function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-charcoal-deep">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Porta corta-fogo industrial vermelha em corredor"
          className="h-full w-full object-cover opacity-60"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-deep via-charcoal-deep/85 to-charcoal-deep/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full bg-brand-red animate-pulse" />
          <MapPin className="h-3.5 w-3.5" />
          Atuação especializada no Rio de Janeiro
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Sua porta corta-fogo{" "}
          <span className="relative">
            <span className="text-brand-red">funciona</span>
          </span>{" "}
          quando você mais precisa?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg"
        >
          Segurança real e conformidade técnica para seu condomínio. Manutenção especializada com foco em proteção de
          vidas e patrimônio.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 rounded-md bg-gradient-red px-7 py-4 text-base font-semibold text-white shadow-red transition-all hover:translate-y-[-2px] hover:brightness-110"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
            Falar com um Especialista Agora
          </a>
          <a
            href="#diferenciais"
            className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
          >
            Conhecer diferenciais
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-14 grid grid-cols-3 gap-6 max-w-3xl border-t border-white/10 pt-8"
        >
          {[
            { v: "12x", l: "Parcelamento em manutenções" },
            { v: "100%", l: "Peças originais" },
            { v: "24h", l: "Resposta RJ" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-bold text-white sm:text-3xl">{s.v}</div>
              <div className="text-xs text-white/60 mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-red/40 to-transparent" />
    </section>
  );
}
