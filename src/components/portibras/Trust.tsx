import { motion } from "framer-motion";
import { ShieldCheck, FileCheck, Scale } from "lucide-react";
import technicianImg from "@/assets/technician.jpg";

const points = [
  {
    icon: ShieldCheck,
    title: "Proteção de vidas em primeiro lugar",
    desc: "Cada intervenção é executada com foco no funcionamento real da porta em situação de emergência.",
  },
  {
    icon: Scale,
    title: "Conformidade como consequência",
    desc: "Compliance e laudos legais são o resultado natural de um serviço técnico bem executado.",
  },
  {
    icon: FileCheck,
    title: "Documentação técnica completa",
    desc: "Relatórios digitais, fotos do antes/depois e certificados de execução em cada serviço.",
  },
];

export function Trust() {
  return (
    <section className="relative bg-charcoal-deep py-24 sm:py-32 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-red opacity-20 blur-2xl rounded-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10">
            <img
              src={technicianImg}
              alt="Técnico especializado fazendo manutenção em porta corta-fogo"
              className="h-full w-full object-cover"
              loading="lazy"
              width={1024}
              height={1024}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-charcoal-deep to-transparent p-6">
              <div className="flex items-center gap-3 text-white">
                <ShieldCheck className="h-5 w-5 text-brand-red" />
                <span className="text-sm font-semibold">Equipe técnica preparada</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Segurança em 1º Lugar</div>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance">
              O laudo é a consequência. A segurança é o objetivo.
            </h2>
            <p className="mt-5 text-white/70 text-base leading-relaxed">
              Muitas empresas vendem apenas o papel. Na PORTIBRAS, executamos o serviço técnico de verdade — e o laudo
              de conformidade é o resultado natural desse trabalho.
            </p>
          </motion.div>

          <div className="mt-10 space-y-6">
            {points.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 border border-brand-red/30 text-brand-red">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{p.title}</h3>
                    <p className="mt-1 text-sm text-white/60 leading-relaxed">{p.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
