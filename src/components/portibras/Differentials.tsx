import { motion } from "framer-motion";
import { Factory, CreditCard, FileBarChart, Zap } from "lucide-react";

const items = [
  {
    icon: Factory,
    title: "Peças Direto da Fábrica",
    desc: "Materiais faturados diretamente pelo fabricante para garantir o melhor preço e procedência original.",
    span: "lg:col-span-2 lg:row-span-2",
    accent: true,
  },
  {
    icon: CreditCard,
    title: "Manutenção em até 12x",
    desc: "Proteja seu condomínio sem pesar no caixa. Parcelamento facilitado da mão de obra.",
    span: "",
  },
  {
    icon: FileBarChart,
    title: "Relatório Digital Próprio",
    desc: "Sistema exclusivo de emissão de relatórios técnicos detalhados após cada serviço.",
    span: "",
  },
  {
    icon: Zap,
    title: "Atendimento Ágil no RJ",
    desc: "Equipe técnica pronta para intervir com rapidez e precisão em todo o Rio de Janeiro.",
    span: "lg:col-span-2",
  },
];

export function Differentials() {
  return (
    <section id="diferenciais" className="relative bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
            Diferenciais
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-charcoal-deep text-balance">
            Engenharia, transparência e tecnologia em cada porta.
          </h2>
          <p className="mt-4 text-base text-slate-brand">
            Não somos apenas instaladores. Somos especialistas técnicos com sistema
            próprio de gestão e parceria direta com fabricantes.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`group relative overflow-hidden rounded-xl border border-border p-7 transition-all hover:border-brand-red/50 hover:shadow-elegant ${
                  item.accent
                    ? "bg-charcoal-deep text-white"
                    : "bg-card"
                } ${item.span}`}
              >
                {item.accent && (
                  <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-red/20 blur-3xl" />
                )}
                <div className="relative flex h-full flex-col">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                      item.accent ? "bg-brand-red" : "bg-charcoal-deep"
                    } text-white transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <h3
                    className={`mt-6 text-xl font-bold tracking-tight ${
                      item.accent ? "text-white" : "text-charcoal-deep"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={`mt-3 text-sm leading-relaxed ${
                      item.accent ? "text-white/70" : "text-slate-brand"
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
