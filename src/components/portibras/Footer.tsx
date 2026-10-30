import { MapPin, Phone, Mail, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/portibras-logo.png";

export function Footer() {
  return (
    <footer className="bg-charcoal-deep border-t border-white/10 text-white/70">
      <div className="mx-auto max-w-7xl px-6 py-14 grid md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Portibras" className="h-10 w-auto" />
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Especialistas em manutenção e instalação de portas corta-fogo no Rio
            de Janeiro. Segurança, conformidade e tecnologia.
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold text-sm uppercase tracking-wider">Contato</h4>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-red" /> Rio de Janeiro — RJ</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-red" /> (21) 96807-2058</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-red" /> vendas@portibras.com.br</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold text-sm uppercase tracking-wider">Serviços</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>Manutenção de portas corta-fogo</li>
            <li>Instalação técnica</li>
            <li>Relatórios e certificados</li>
            <li>Peças e reposição</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-5 text-xs text-white/50 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} PORTIBRAS. Todos os direitos reservados.</span>
          <span>Segurança que se vê. Conformidade que se comprova.</span>
          <Link
            to="/acesso"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <Lock className="h-3 w-3" />
            Área de Membros
          </Link>
        </div>
      </div>
    </footer>
  );
}
