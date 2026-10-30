import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  ClipboardCheck,
  MessageCircle,
  FileDown,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { z } from "zod";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const WHATSAPP_NUMBER = "5521968072058";

// Cada pergunta mapeia diretamente para um componente do Relatório Técnico NBR 11.742
const QUESTIONS = [
  {
    id: "q1",
    component: "Folha da porta / fechamento automático",
    text: "As portas corta-fogo fecham sozinhas?",
    nonConformLabel: "Não conforme — fechamento automático falho",
  },
  {
    id: "q2",
    component: "Dobradiças",
    text: "Todas as portas apresentam, no mínimo, 03 dobradiças do mesmo tipo?",
    nonConformLabel: "Não conforme — dobradiças insuficientes ou divergentes",
  },
  {
    id: "q3",
    component: "Barra antipânico / Fechadura",
    text: "Todas as portas apresentam ou 01 fechadura ou 01 barra antipânico?",
    nonConformLabel: "Não conforme — sem fechadura/barra antipânico",
  },
  {
    id: "q4",
    component: "Identificação NBR (placa fotoluminescente)",
    text: "Todas as portas apresentam a placa fotoluminescente (Porta corta-fogo, mantenha fechada)?",
    nonConformLabel: "Não conforme — sinalização ausente",
  },
  {
    id: "q5",
    component: "Selo intumescente / Vedação",
    text: "As portas estão livres de calços, cunhas ou objetos que impeçam o fechamento?",
    nonConformLabel: "Não conforme — obstrução do fechamento",
  },
  {
    id: "q6",
    component: "Manutenção preventiva",
    text: "A última manutenção feita tem menos de 6 meses?",
    nonConformLabel: "Pendente — manutenção vencida",
  },
] as const;

type AnswerMap = Record<string, "sim" | "nao">;

const clientSchema = z.object({
  condominio: z.string().trim().min(2, "Informe o nome do condomínio").max(120),
  endereco: z.string().trim().min(5, "Informe o endereço completo").max(200),
  email: z.string().trim().email("E-mail inválido").max(120),
  telefone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20)
    .regex(/^[0-9()+\-\s]+$/, "Use apenas números e ( ) + -"),
});

type ClientData = z.infer<typeof clientSchema>;

function getRiskLevel(answers: AnswerMap) {
  const irregularCount = QUESTIONS.filter((q) => answers[q.id] === "nao").length;
  if (irregularCount === 0)
    return {
      label: "BAIXO",
      tone: "low" as const,
      Icon: ShieldCheck,
      headline: "Risco Baixo",
      desc: "Suas portas aparentam estar em conformidade. Recomendamos manutenção preventiva anual.",
    };
  if (irregularCount <= 2)
    return {
      label: "MÉDIO",
      tone: "mid" as const,
      Icon: AlertTriangle,
      headline: "Risco Médio",
      desc: "Foram detectadas não-conformidades que comprometem o desempenho do sistema corta-fogo.",
    };
  return {
    label: "ALTO",
    tone: "high" as const,
    Icon: ShieldAlert,
    headline: "Risco Alto",
    desc: "Sinais críticos de falha. Em caso de incêndio, a porta pode não cumprir sua função.",
  };
}

function buildWhatsAppMessage(answers: AnswerMap, client: ClientData) {
  const risk = getRiskLevel(answers);
  const irregulars = QUESTIONS.filter((q) => answers[q.id] === "nao").map((q) => `• ${q.component}`);
  const irregularBlock = irregulars.length ? irregulars.join("\n") : "Nenhum item irregular detectado.";

  return `Olá, Portibras! Acabei de realizar o Diagnóstico Digital no site e o meu nível de risco deu: ${risk.label}.

Dados do condomínio:
• Condomínio: ${client.condominio}
• Endereço: ${client.endereco}
• E-mail: ${client.email}
• Telefone: ${client.telefone}

Itens irregulares detectados:
${irregularBlock}

Gostaria de validar esses pontos com um técnico e entender o modelo de faturamento direto da fábrica.`;
}

function generateReportPDF(answers: AnswerMap, client: ClientData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const risk = getRiskLevel(answers);
  const today = new Date().toLocaleDateString("pt-BR");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PORTIBRAS — Relatório Técnico", 40, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Inspeção de Portas Corta-Fogo conforme ABNT NBR 11.742", 40, 54);

  // Dados do imóvel
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Dados do imóvel", 40, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dados = [
    `Condomínio: ${client.condominio}`,
    `Endereço: ${client.endereco}`,
    `E-mail: ${client.email}`,
    `Telefone: ${client.telefone}`,
    `Data da vistoria: ${today}`,
    `Origem: Diagnóstico Digital (autoavaliação do síndico)`,
  ];
  dados.forEach((line, i) => doc.text(line, 40, 120 + i * 16));

  // Itens inspecionados
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("2. Itens inspecionados", 40, 230);

  autoTable(doc, {
    startY: 240,
    head: [["Item", "Componente", "Status"]],
    body: QUESTIONS.map((q, i) => {
      const ans = answers[q.id];
      const status = ans === "sim" ? "Conforme" : q.nonConformLabel;
      return [String(i + 1), q.component, status];
    }),
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    bodyStyles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const value = String(data.cell.raw);
        if (value !== "Conforme") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Pega Y após a tabela
  // @ts-expect-error jspdf-autotable adiciona lastAutoTable
  const finalY = doc.lastAutoTable.finalY || 350;

  // Resultado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. Nível de risco apurado", 40, finalY + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const riskColor: [number, number, number] =
    risk.tone === "low" ? [16, 185, 129] : risk.tone === "mid" ? [245, 158, 11] : [220, 38, 38];
  doc.setTextColor(...riskColor);
  doc.text(`RISCO ${risk.label}`, 40, finalY + 50);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(risk.desc, pageWidth - 80);
  doc.text(descLines, 40, finalY + 68);

  // Recomendações
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("4. Recomendações técnicas", 40, finalY + 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const recs =
    "Substituição imediata dos componentes não-conformes, ajustes mecânicos quando aplicável e aplicação de identificação conforme NBR 11.742. Recomenda-se manutenção preventiva semestral por equipe técnica especializada.";
  doc.text(doc.splitTextToSize(recs, pageWidth - 80), 40, finalY + 128);

  // Conclusão
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("5. Conclusão", 40, finalY + 180);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const conclusao =
    risk.tone === "low"
      ? "Sistema corta-fogo aparentemente em conformidade. Mantenha o plano de manutenção preventiva ativo."
      : "Sistema corta-fogo apresenta não-conformidades que comprometem o desempenho em situação de incêndio. Após execução das ações corretivas pela Portibras, será emitido certificado técnico para apresentação ao Corpo de Bombeiros.";
  doc.text(doc.splitTextToSize(conclusao, pageWidth - 80), 40, finalY + 198);

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Documento gerado a partir do Diagnóstico Digital Portibras. Validação técnica presencial recomendada.",
    40,
    doc.internal.pageSize.getHeight() - 30,
  );

  const safeName = client.condominio.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`relatorio-portibras-${safeName}.pdf`);
}

export function Diagnostico() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [client, setClient] = useState<ClientData>({
    condominio: "",
    endereco: "",
    email: "",
    telefone: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ClientData, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedClient, setSubmittedClient] = useState<ClientData | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<AnswerMap | null>(null);

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);
  const risk = useMemo(() => getRiskLevel(answers), [answers]);
  const irregularCount = QUESTIONS.filter((q) => answers[q.id] === "nao").length;

  function setAnswer(id: string, value: "sim" | "nao") {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function updateClient(field: keyof ClientData, value: string) {
    setClient((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit() {
    if (!allAnswered) return;
    const parsed = clientSchema.safeParse(client);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ClientData, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof ClientData;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    const text = encodeURIComponent(buildWhatsAppMessage(answers, parsed.data));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener");
    setSubmittedClient(parsed.data);
    setSubmittedAnswers(answers);
    setSubmitted(true);
  }

  function handleReset() {
    setAnswers({});
    setClient({ condominio: "", endereco: "", email: "", telefone: "" });
    setErrors({});
    setSubmittedClient(null);
    setSubmittedAnswers(null);
    setSubmitted(false);
  }

  function handleDownloadReport() {
    if (submittedAnswers && submittedClient) {
      generateReportPDF(submittedAnswers, submittedClient);
    }
  }

  const toneStyles =
    risk.tone === "low"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : risk.tone === "mid"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-brand-red/15 text-brand-red border-brand-red/40";

  const inputBase =
    "w-full rounded-lg border bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-red/40 transition";

  return (
    <section id="diagnostico" className="bg-charcoal py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
            <ClipboardCheck className="h-4 w-4" />
            Diagnóstico Digital
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance">
            Avalie em 60 segundos o risco do seu condomínio.
          </h2>
          <p className="mt-4 text-white/70">
            Responda 6 perguntas técnicas baseadas na NBR 11.742 e gere o relatório oficial em PDF.
          </p>
        </motion.div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-charcoal-deep p-6 sm:p-10 shadow-elegant">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5">
                  {QUESTIONS.map((q, i) => (
                    <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-red/15 text-brand-red text-xs font-bold">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-white/90 text-sm sm:text-base leading-relaxed">{q.text}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
                            Componente: {q.component}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:ml-9">
                        {(["sim", "nao"] as const).map((val) => {
                          const active = answers[q.id] === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setAnswer(q.id, val)}
                              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition ${
                                active
                                  ? val === "sim"
                                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                                    : "border-brand-red/50 bg-brand-red/15 text-brand-red"
                                  : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06]"
                              }`}
                            >
                              {val === "sim" ? "Sim" : "Não"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {allAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${toneStyles}`}
                  >
                    <risk.Icon className="h-6 w-6 shrink-0" />
                    <div className="text-sm">
                      <strong className="block">{risk.headline}</strong>
                      <span className="opacity-80">{irregularCount} item(ns) irregular(es) detectado(s).</span>
                    </div>
                  </motion.div>
                )}

                {/* Captura de dados */}
                <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">
                    Dados para emissão do relatório
                  </h3>
                  <p className="mt-1 text-xs text-white/50">
                    Necessários para gerar o PDF técnico em nome do condomínio.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">Nome do condomínio *</label>
                      <input
                        type="text"
                        value={client.condominio}
                        onChange={(e) => updateClient("condominio", e.target.value)}
                        placeholder="Ex: Edifício Atlântico"
                        maxLength={120}
                        className={`${inputBase} ${errors.condominio ? "border-brand-red/60" : "border-white/10"}`}
                      />
                      {errors.condominio && (
                        <p className="mt-1 text-xs text-brand-red">{errors.condominio}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">Endereço completo *</label>
                      <input
                        type="text"
                        value={client.endereco}
                        onChange={(e) => updateClient("endereco", e.target.value)}
                        placeholder="Rua, nº, bairro — cidade/UF"
                        maxLength={200}
                        className={`${inputBase} ${errors.endereco ? "border-brand-red/60" : "border-white/10"}`}
                      />
                      {errors.endereco && <p className="mt-1 text-xs text-brand-red">{errors.endereco}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">E-mail *</label>
                      <input
                        type="email"
                        value={client.email}
                        onChange={(e) => updateClient("email", e.target.value)}
                        placeholder="sindico@condominio.com.br"
                        maxLength={120}
                        className={`${inputBase} ${errors.email ? "border-brand-red/60" : "border-white/10"}`}
                      />
                      {errors.email && <p className="mt-1 text-xs text-brand-red">{errors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">Telefone *</label>
                      <input
                        type="tel"
                        value={client.telefone}
                        onChange={(e) => updateClient("telefone", e.target.value)}
                        placeholder="(21) 99999-9999"
                        maxLength={20}
                        className={`${inputBase} ${errors.telefone ? "border-brand-red/60" : "border-white/10"}`}
                      />
                      {errors.telefone && <p className="mt-1 text-xs text-brand-red">{errors.telefone}</p>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-md bg-gradient-red px-6 py-4 text-base font-semibold text-white shadow-red transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
                  Gerar Relatório e Falar com Especialista
                </button>
                <p className="mt-3 text-center text-xs text-white/50">
                  Você será direcionado ao WhatsApp e poderá baixar o PDF técnico em seguida.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-6"
              >
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-9 w-9" strokeWidth={2.2} />
                </div>
                <h3 className="mt-6 text-2xl sm:text-3xl font-bold text-white">Diagnóstico enviado com sucesso!</h3>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">
                  Em instantes, um de nossos especialistas técnicos analisará seus dados. Lembre-se:{" "}
                  <strong className="text-white">90% das falhas são resolvidas com manutenção preventiva</strong>.
                  Proteja seu condomínio e sua responsabilidade civil.
                </p>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="mt-8 inline-flex items-center gap-2 rounded-md border border-brand-red/40 bg-brand-red/10 px-5 py-3 text-sm font-semibold text-brand-red hover:bg-brand-red/20 transition"
                >
                  <FileDown className="h-4 w-4" />
                  Baixar Relatório Técnico NBR 11.742 (PDF)
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-6 mx-auto flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition"
                >
                  <RotateCcw className="h-3 w-3" />
                  Refazer diagnóstico
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
