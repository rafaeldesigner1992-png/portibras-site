import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Settings,
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/painel/configuracoes")({
  component: ConfiguracoesPage,
});

// Seções disponíveis
const SECOES = [
  { id: "logistica", label: "Logística", icon: Package },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "crm", label: "CRM", icon: Users },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function useConfiguracao(chave: string, padrao: string[]) {
  const [valores, setValores] = useState<string[]>(padrao);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<"ok" | "erro" | null>(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();
      if (data?.valor) {
        try { setValores(JSON.parse(data.valor)); } catch { /* mantém padrão */ }
      }
      setCarregando(false);
    })();
  }, [chave]);

  async function salvar(novos: string[]) {
    setSalvando(true);
    setFeedback(null);
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave, valor: JSON.stringify(novos) }, { onConflict: "chave" });
    setSalvando(false);
    setFeedback(error ? "erro" : "ok");
    if (!error) setValores(novos);
    setTimeout(() => setFeedback(null), 3000);
  }

  return { valores, setValores, carregando, salvando, feedback, salvar };
}

// ─── Painel de lista editável genérica ───────────────────────────────────────

function ListaEditavel({
  titulo,
  descricao,
  chave,
  padrao,
  placeholder,
}: {
  titulo: string;
  descricao: string;
  chave: string;
  padrao: string[];
  placeholder: string;
}) {
  const { valores, setValores, carregando, salvando, feedback, salvar } =
    useConfiguracao(chave, padrao);
  const [novo, setNovo] = useState("");

  function adicionar() {
    const v = novo.trim();
    if (!v || valores.includes(v)) return;
    setValores((prev) => [...prev, v]);
    setNovo("");
  }

  function remover(item: string) {
    setValores((prev) => prev.filter((x) => x !== item));
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1a6b2f]" />
        Carregando…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{descricao}</p>
      </div>

      {/* Lista atual */}
      <ul className="mb-4 space-y-2">
        {valores.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            <span className="flex-1 text-gray-800">{item}</span>
            <button
              onClick={() => remover(item)}
              className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {valores.length === 0 && (
          <li className="py-3 text-center text-xs text-gray-400">
            Nenhum item cadastrado
          </li>
        )}
      </ul>

      {/* Adicionar novo */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]/30 focus:border-[#1a6b2f]"
        />
        <button
          onClick={adicionar}
          disabled={!novo.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f]/10 px-3 py-2 text-xs font-semibold text-[#1a6b2f] hover:bg-[#1a6b2f]/20 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {/* Botão salvar + feedback */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => salvar(valores)}
          disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155825] disabled:opacity-60 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
        {feedback === "ok" && (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo com sucesso
          </span>
        )}
        {feedback === "erro" && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> Erro ao salvar
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Conteúdo por seção ──────────────────────────────────────────────────────

function SecaoLogistica() {
  return (
    <div className="space-y-6">
      <ListaEditavel
        titulo="Fornecedores de Compras"
        descricao="Lista de fornecedores disponíveis ao registrar uma compra na aba Logística → Compras."
        chave="logistica_fornecedores"
        padrao={["G Sardou", "Disafe", "GUBLER", "DW15", "Original Portas"]}
        placeholder="Nome do fornecedor…"
      />
    </div>
  );
}

function SecaoDashboard() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <LayoutDashboard className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">
        Configurações de Dashboard
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: KPIs exibidos, metas e períodos padrão.
      </p>
    </div>
  );
}

function SecaoCRM() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Configurações de CRM</p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: etapas do funil, status de renovação e tipos de cliente.
      </p>
    </div>
  );
}

function SecaoFinanceiro() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <DollarSign className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">
        Configurações Financeiro
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Em breve: categorias de receita/despesa e contas bancárias.
      </p>
    </div>
  );
}

const CONTEUDO: Record<SecaoId, React.FC> = {
  logistica: SecaoLogistica,
  dashboard: SecaoDashboard,
  crm: SecaoCRM,
  financeiro: SecaoFinanceiro,
};

// ─── Página principal ─────────────────────────────────────────────────────────

function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoId>("logistica");

  // Só administrador pode acessar
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [usuario, navigate]);

  if (!usuario || usuario.perfil !== "admin") return null;

  const SecaoConteudo = CONTEUDO[secaoAtiva];
  const secaoInfo = SECOES.find((s) => s.id === secaoAtiva)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
            <Settings className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Configurações</h1>
            <p className="text-xs text-gray-500">
              Gerencie as opções do sistema — somente Administrador
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-0 md:gap-6 p-0 md:p-6">
        {/* Sidebar de seções */}
        <nav className="hidden md:block w-52 flex-shrink-0">
          <ul className="space-y-1">
            {SECOES.map((s) => {
              const Icon = s.icon;
              const ativo = secaoAtiva === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSecaoAtiva(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      ativo
                        ? "bg-[#1a6b2f] text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{s.label}</span>
                    {ativo && <ChevronRight className="h-3 w-3 opacity-70" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile: tabs no topo */}
        <div className="md:hidden w-full overflow-x-auto">
          <div className="flex border-b border-gray-200 bg-white px-4 gap-1">
            {SECOES.map((s) => {
              const Icon = s.icon;
              const ativo = secaoAtiva === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSecaoAtiva(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                    ativo
                      ? "border-[#1a6b2f] text-[#1a6b2f]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da seção */}
        <div className="flex-1 min-w-0 p-4 md:p-0">
          <div className="mb-4 hidden md:flex items-center gap-2">
            <secaoInfo.icon className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">
              {secaoInfo.label}
            </h2>
          </div>
          <SecaoConteudo />
        </div>
      </div>
    </div>
  );
}
