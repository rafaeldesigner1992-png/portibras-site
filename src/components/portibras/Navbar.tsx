import { Link } from "@tanstack/react-router";
import logo from "@/assets/portibras-logo.png";

export function Navbar() {
  return (
    <header className="absolute top-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Portibras" className="h-10 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
          <Link to="/" hash="diferenciais" className="hover:text-white transition">
            Diferenciais
          </Link>
          <Link to="/" hash="processo" className="hover:text-white transition">
            Processo
          </Link>
          <Link to="/diagnostico" className="hover:text-white transition">
            Diagnóstico
          </Link>
          <Link to="/" hash="contato" className="hover:text-white transition">
            Contato
          </Link>
        </nav>
      </div>
    </header>
  );
}
