import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const WHATSAPP_URL =
  "https://wa.me/5521968072058?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20especialista%20em%20portas%20corta-fogo.";

export function WhatsAppFloat() {
  return (
    <motion.a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-whatsapp px-5 py-4 text-white shadow-elegant hover:brightness-110 transition-all"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={2.5} />
      <span className="hidden sm:inline font-semibold text-sm">Solicite seu orçamento</span>
      <span className="absolute inset-0 rounded-full animate-ping bg-whatsapp opacity-30 -z-10" />
    </motion.a>
  );
}

export { WHATSAPP_URL };
