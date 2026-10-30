import { motion } from "framer-motion";
import { ClipboardCheck, Wrench, FileCheck2 } from "lucide-react";

const steps = [
  {
    icon: ClipboardCheck,
    n: "01",
    title: "Diagnóstico Técnico",
    desc: "Vistoria completa de cada porta, identificação de não-conformidades e orçamento detalhado.",
  },
  {
    icon: Wrench,
    n: "02",
    title: "Execução Especializada",
    desc: "Equipe técnica realiza a manutenção ou instalação com peças originais direto da fábrica.",
  },
  {
    icon: FileCheck2,
    n: "03",
    title: "Relatório e Certificado",
    desc: "Emissão de relatório digital próprio e certificado técnico para apresentação ao corpo de bombeiros.",
  },
];

export function Process() {
  return (
    <section id="processo" className="bg-steel py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
            Como Trabalhamos
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-charcoal-deep text-balance">
            Um processo claro, do diagnóstico ao certificado.
          </h2>
        </motion.div>

        <div className="mt-16 relative grid md:grid-cols-3 gap-6">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-brand-red/0 via-brand-red/40 to-brand-red/0" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative bg-card rounded-xl border border-border p-7 hover:shadow-elegant transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-charcoal-deep text-white">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <span className="text-4xl font-bold text-brand-red/20">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-charcoal-deep">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-slate-brand leading-relaxed">
                  {s.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
