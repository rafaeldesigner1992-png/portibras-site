import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Building2, Plus, Search, Phone, Mail, MapPin, Users,
  ChevronRight, X, Check, Pencil, Trash2, AlertCircle,
  FileText, Wrench, ChevronDown, ChevronUp, History, Loader2,
  ExternalLink, Upload, Download, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/clientes")({
  component: ClientesPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  sindico: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  email_financeiro: string | null;
  telefone_financeiro: string | null;
  tipo_edificio: string | null;
  qtd_andares: number | null;
  qtd_portas_cf: number | null;
  perfil_tecnico: string | null;
  status: "ativo" | "inativo" | "prospect";
  data_ultima_vistoria: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface PropostaResumida {
  id: string;
  titulo: string;
  status: string;
  tipo_orcamento: string | null;
  valor_total: number | null;
  criado_em: string;
  enviado_logistica: boolean;
}

interface AtendimentoResumido {
  id: string;
  titulo: string;
  classificacao: string;
  status: string;
  data_agendada: string | null;
  responsaveis: string[];
}

const STATUS_CLIENTE: Record<string, { label: string; cor: string }> = {
  ativo:    { label: "Ativo",    cor: "bg-green-50 text-green-700 border-green-200" },
  prospect: { label: "Prospect", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  inativo:  { label: "Inativo",  cor: "bg-gray-100 text-gray-500 border-gray-200" },
};

const STATUS_PROPOSTA: Record<string, string> = {
  criado:        "bg-gray-100 text-gray-500",
  enviado:       "bg-blue-50 text-blue-700",
  fechado:       "bg-green-50 text-green-700",
  descontinuado: "bg-red-50 text-red-600",
};

const STATUS_ATEND: Record<string, string> = {
  "Programado":    "bg-blue-50 text-blue-700",
  "Em andamento":  "bg-yellow-50 text-yellow-700",
  "Concluído":     "bg-green-50 text-green-700",
  "Cancelado":     "bg-red-50 text-red-600",
};

const TIPO_EDIFICIO = [
  "Residencial","Comercial","Hotel","Shopping","Hospital","Industrial","Escola","Condomínio Misto","Outro"
];

// ── Formulário de cliente ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: "", cnpj: "", endereco: "", bairro: "", cidade: "Rio de Janeiro", uf: "RJ",
  cep: "", sindico: "", telefone: "", whatsapp: "", email: "",
  email_financeiro: "", telefone_financeiro: "", tipo_edificio: "",
  qtd_andares: "", qtd_portas_cf: "", perfil_tecnico: "", status: "ativo" as const, data_ultima_vistoria: "", observacoes: "",
};

type FormData = typeof EMPTY_FORM;

// ── Busca CNPJ ────────────────────────────────────────────────────────────────

function formatarCnpj(valor: string) {
  const n = valor.replace(/\D/g, "").slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function FormCliente({
  inicial, onSalvar, onCancelar, salvando,
}: {
  inicial?: Partial<FormData>;
  onSalvar: (d: FormData) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, ...inicial });
  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);

  async function buscarCnpj(cnpjRaw: string) {
    const digits = cnpjRaw.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setBuscandoCnpj(true);
    setErroCnpj(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { setErroCnpj("CNPJ não encontrado na Receita Federal"); return; }
      const d = await res.json();

      // Monta endereço
      const logradouro = [d.logradouro, d.numero].filter(Boolean).join(", ");
      const complemento = d.complemento ? ` ${d.complemento}` : "";

      setForm(f => ({
        ...f,
        nome: f.nome || (d.razao_social ?? ""),
        cnpj: formatarCnpj(digits),
        endereco: logradouro + complemento || f.endereco,
        bairro: d.bairro || f.bairro,
        cep: d.cep ? d.cep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") : f.cep,
        cidade: d.municipio || f.cidade,
        uf: d.uf || f.uf,
        email: f.email || (d.email ?? ""),
      }));
    } catch {
      setErroCnpj("Erro ao consultar Receita Federal");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatado = formatarCnpj(e.target.value);
    set("cnpj", formatado);
    if (formatado.replace(/\D/g, "").length === 14) buscarCnpj(formatado);
  }

  return (
    <div className="space-y-5">
      {/* Dados principais */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Dados do Condomínio / Cliente</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label-field">Nome / Razão Social *</label>
            <input className="input-field" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Condomínio Edifício Alpha" />
          </div>
          <div>
            <label className="label-field flex items-center gap-1.5">
              CNPJ
              {buscandoCnpj && <Loader2 className="h-3 w-3 animate-spin text-[#1a6b2f]" />}
              {!buscandoCnpj && erroCnpj && <span className="text-xs font-normal text-red-500">{erroCnpj}</span>}
              {!buscandoCnpj && !erroCnpj && form.cnpj.replace(/\D/g, "").length === 14 && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-0.5"><Check className="h-3 w-3" />preenchido</span>
              )}
            </label>
            <input
              ref={cnpjRef}
              className="input-field"
              value={form.cnpj}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0001-00"
              maxLength={18}
            />
          </div>
          <div>
            <label className="label-field">Tipo de Edificação</label>
            <select className="input-field" value={form.tipo_edificio} onChange={e => set("tipo_edificio", e.target.value)}>
              <option value="">Selecione...</option>
              {TIPO_EDIFICIO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Andares</label>
            <input className="input-field" type="number" value={form.qtd_andares} onChange={e => set("qtd_andares", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label-field">Portas Corta-Fogo</label>
            <input className="input-field" type="number" value={form.qtd_portas_cf} onChange={e => set("qtd_portas_cf", e.target.value)} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Endereço</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label-field">Logradouro</label>
            <input className="input-field" value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua, Av., número" />
          </div>
          <div>
            <label className="label-field">Bairro</label>
            <input className="input-field" value={form.bairro} onChange={e => set("bairro", e.target.value)} placeholder="Bairro" />
          </div>
          <div>
            <label className="label-field">CEP</label>
            <input className="input-field" value={form.cep} onChange={e => set("cep", e.target.value)} placeholder="00000-000" />
          </div>
          <div>
            <label className="label-field">Cidade</label>
            <input className="input-field" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
          </div>
          <div>
            <label className="label-field">UF</label>
            <input className="input-field" value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} />
          </div>
        </div>
      </div>

      {/* Contatos */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Contato Principal</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label-field">Síndico / Responsável</label>
            <input className="input-field" value={form.sindico} onChange={e => set("sindico", e.target.value)} placeholder="Nome do síndico" />
          </div>
          <div>
            <label className="label-field">Telefone</label>
            <input className="input-field" value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(21) 9 9999-9999" />
          </div>
          <div>
            <label className="label-field">WhatsApp</label>
            <input className="input-field" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="(21) 9 9999-9999" />
          </div>
          <div className="col-span-2">
            <label className="label-field">E-mail</label>
            <input className="input-field" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@condominio.com.br" />
          </div>
        </div>
      </div>

      {/* Contato financeiro */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Contato Financeiro</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field">Telefone Financeiro</label>
            <input className="input-field" value={form.telefone_financeiro} onChange={e => set("telefone_financeiro", e.target.value)} placeholder="(21) 9 9999-9999" />
          </div>
          <div>
            <label className="label-field">E-mail Financeiro</label>
            <input className="input-field" type="email" value={form.email_financeiro} onChange={e => set("email_financeiro", e.target.value)} placeholder="financeiro@..." />
          </div>
        </div>
      </div>

      {/* Perfil técnico */}
      <div>
        <label className="label-field">Perfil Técnico</label>
        <input className="input-field" value={form.perfil_tecnico} onChange={e => set("perfil_tecnico", e.target.value)} placeholder="Ex: Alta pressão, hidrante, sprinkler..." />
      </div>

      {/* Status e última vistoria */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-field">Status</label>
          <select className="input-field" value={form.status} onChange={e => set("status", e.target.value as "ativo"|"inativo"|"prospect")}>
            <option value="ativo">Ativo</option>
            <option value="prospect">Prospect</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div>
          <label className="label-field">Última Vistoria</label>
          <input className="input-field" type="date" value={form.data_ultima_vistoria} onChange={e => set("data_ultima_vistoria", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label-field">Observações</label>
        <textarea className="input-field min-h-[72px] resize-none" value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Notas internas sobre o cliente..." />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSalvar(form)}
          disabled={salvando || !form.nome.trim()}
          className="flex-1 rounded-lg bg-[#1a6b2f] py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#155a27] transition-colors"
        >
          {salvando ? "Salvando..." : "Salvar Cliente"}
        </button>
        <button onClick={onCancelar} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Card de Cliente (linha na lista) ──────────────────────────────────────────

function ClienteRow({ cliente, onEdit, onDelete, onClick }: {
  cliente: Cliente;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const st = STATUS_CLIENTE[cliente.status];
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm hover:border-[#1a6b2f]/30 hover:shadow-md transition-all"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a6b2f]/10 text-[#1a6b2f]">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-gray-900">{cliente.nome}</p>
        <p className="truncate text-xs text-gray-500">
          {[cliente.bairro, cliente.cidade].filter(Boolean).join(" · ")}
          {cliente.tipo_edificio && ` · ${cliente.tipo_edificio}`}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {cliente.sindico && (
          <span className="hidden text-xs text-gray-400 sm:block"><Users className="inline h-3 w-3 mr-1" />{cliente.sindico}</span>
        )}
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", st.cor)}>{st.label}</span>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </div>
  );
}

// ── Painel lateral (detalhe do cliente) ───────────────────────────────────────

function PainelDetalhe({ cliente, onClose, onEdit }: {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [propostas, setPropostas] = useState<PropostaResumida[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoResumido[]>([]);
  const [aba, setAba] = useState<"dados"|"crm"|"atendimentos">("dados");
  const [criandoLead, setCriandoLead] = useState(false);
  const navigate = useNavigate();
  const st = STATUS_CLIENTE[cliente.status];

  async function criarCardCRM() {
    setCriandoLead(true);
    try {
      const endereco = [cliente.endereco, cliente.bairro, cliente.cidade && cliente.uf ? `${cliente.cidade} - ${cliente.uf}` : cliente.cidade, cliente.cep].filter(Boolean).join(", ");

      // Primeiro insert sem cliente_id (caso a coluna ainda não exista no banco)
      const { data: novoLead, error } = await supabase.from("crm_leads").insert({
        nome: cliente.sindico || cliente.nome,
        empresa: cliente.nome,
        cnpj: cliente.cnpj?.replace(/\D/g, "") || "",
        telefone: cliente.telefone || cliente.whatsapp || "",
        email: cliente.email || "",
        etapa: "prospecto",
        endereco_fiscal: endereco,
        endereco_atendimento: endereco,
        observacoes: "",
      }).select("id").single();

      if (error) {
        alert(`Erro ao criar card: ${error.message}`);
        return;
      }

      // Tenta vincular cliente_id se a coluna existir
      if (novoLead?.id) {
        await supabase.from("crm_leads").update({ cliente_id: cliente.id }).eq("id", novoLead.id);
      }

      navigate({ to: "/painel/crm" });
    } catch (e) {
      console.error("Erro ao criar lead:", e);
      alert("Erro inesperado ao criar card.");
    } finally {
      setCriandoLead(false);
    }
  }

  useEffect(() => {
    supabase.from("crm_propostas").select("id,titulo,status,tipo_orcamento,valor_total,criado_em,enviado_logistica")
      .eq("cliente_id", cliente.id).order("criado_em", { ascending: false })
      .then(({ data }) => setPropostas(data || []));

    supabase.from("atendimentos").select("id,titulo,classificacao,status,data_agendada,responsaveis")
      .eq("cliente_id", cliente.id).order("data_agendada", { ascending: false })
      .then(({ data }) => setAtendimentos(data || []));
  }, [cliente.id]);

  const enderecoCompleto = [cliente.endereco, cliente.bairro, `${cliente.cidade}/${cliente.uf}`].filter(Boolean).join(", ");

  return (
    <div className="flex h-full flex-col bg-white border-l border-gray-100 shadow-xl" style={{ width: 400, minWidth: 400 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", st.cor)}>{st.label}</span>
            {cliente.tipo_edificio && <span className="text-xs text-gray-400">{cliente.tipo_edificio}</span>}
          </div>
          <h2 className="text-base font-bold text-gray-900 leading-tight">{cliente.nome}</h2>
          {enderecoCompleto && <p className="mt-1 text-xs text-gray-500"><MapPin className="inline h-3 w-3 mr-1" />{enderecoCompleto}</p>}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"><Pencil className="h-4 w-4" /></button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-100">
        {([["dados","Dados",FileText],["crm","CRM",ChevronRight],["atendimentos","Atendimentos",Wrench]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setAba(id)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              aba === id ? "border-b-2 border-[#1a6b2f] text-[#1a6b2f]" : "text-gray-500 hover:text-gray-700"
            )}>
            <Icon className="h-3.5 w-3.5" />
            {label}
            {id === "crm" && propostas.length > 0 && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{propostas.length}</span>}
            {id === "atendimentos" && atendimentos.length > 0 && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{atendimentos.length}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {aba === "dados" && (
          <div className="space-y-4">
            {/* Contato */}
            {(cliente.sindico || cliente.telefone || cliente.whatsapp || cliente.email) && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contato Principal</p>
                <div className="space-y-1.5">
                  {cliente.sindico && <Row icon={<Users className="h-3.5 w-3.5" />} label="Síndico" value={cliente.sindico} />}
                  {cliente.telefone && <Row icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={cliente.telefone} />}
                  {cliente.whatsapp && <Row icon={<Phone className="h-3.5 w-3.5" />} label="WhatsApp" value={cliente.whatsapp} />}
                  {cliente.email && <Row icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={cliente.email} />}
                </div>
              </section>
            )}
            {(cliente.email_financeiro || cliente.telefone_financeiro) && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Financeiro</p>
                <div className="space-y-1.5">
                  {cliente.telefone_financeiro && <Row icon={<Phone className="h-3.5 w-3.5" />} label="Tel. Financeiro" value={cliente.telefone_financeiro} />}
                  {cliente.email_financeiro && <Row icon={<Mail className="h-3.5 w-3.5" />} label="E-mail Financeiro" value={cliente.email_financeiro} />}
                </div>
              </section>
            )}
            {/* Técnico */}
            {(cliente.qtd_andares || cliente.qtd_portas_cf || cliente.data_ultima_vistoria || cliente.perfil_tecnico) && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Dados Técnicos</p>
                <div className="space-y-1.5">
                  {cliente.perfil_tecnico && <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Perfil Técnico" value={cliente.perfil_tecnico} />}
                  {cliente.qtd_andares && <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Andares" value={String(cliente.qtd_andares)} />}
                  {cliente.qtd_portas_cf && <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Portas CF" value={String(cliente.qtd_portas_cf)} />}
                  {cliente.data_ultima_vistoria && <Row icon={<History className="h-3.5 w-3.5" />} label="Última Vistoria" value={new Date(cliente.data_ultima_vistoria).toLocaleDateString("pt-BR")} />}
                </div>
              </section>
            )}
            {cliente.cnpj && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Fiscal</p>
                <Row icon={<FileText className="h-3.5 w-3.5" />} label="CNPJ" value={cliente.cnpj} />
              </section>
            )}
            {cliente.observacoes && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Observações</p>
                <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">{cliente.observacoes}</p>
              </section>
            )}
          </div>
        )}

        {aba === "crm" && (
          <div className="space-y-2">
            <button onClick={criarCardCRM} disabled={criandoLead}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a6b2f] px-4 py-2.5 text-sm font-medium text-[#1a6b2f] hover:bg-[#1a6b2f]/5 disabled:opacity-50 transition-colors">
              {criandoLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Criar card no CRM
            </button>
            {propostas.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Nenhuma proposta vinculada</p>}
            {propostas.map(p => (
              <div key={p.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-medium text-gray-800">{p.titulo}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_PROPOSTA[p.status] || "bg-gray-100 text-gray-500")}>{p.status}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  {p.tipo_orcamento && <span>{p.tipo_orcamento}</span>}
                  {p.valor_total && <span className="font-medium text-gray-700">R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                  {p.enviado_logistica && <span className="text-[#1a6b2f] font-medium">✓ Na logística</span>}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>
              </div>
            ))}
          </div>
        )}

        {aba === "atendimentos" && (
          <div className="space-y-2">
            {atendimentos.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Nenhum atendimento registrado</p>}
            {atendimentos.map(a => (
              <div key={a.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-medium text-gray-800">{a.titulo}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_ATEND[a.status] || "bg-gray-100 text-gray-500")}>{a.status}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5">{a.classificacao}</span>
                  {a.data_agendada && <span>{new Date(a.data_agendada + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                  {a.responsaveis?.length > 0 && <span>{a.responsaveis.join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="min-w-0 truncate text-gray-700">{value}</span>
    </div>
  );
}

// ── Importação CSV ─────────────────────────────────────────────────────────────

interface ImportRow {
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  uf: string;
  cidade: string;
  endereco: string | null;
  bairro: string | null;
  sindico: string | null;
  status: "ativo" | "inativo" | "prospect";
}

function parseCSVContaAzul(text: string): { rows: ImportRow[]; erros: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], erros: ["Arquivo vazio ou sem dados."] };

  // Parse CSV respeitando aspas e ponto-e-vírgula como separador
  function parseLine(line: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ";" && !inQuotes) {
        cols.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  const header = parseLine(lines[0]).map(h => h.toLowerCase().trim());
  const idx = (name: string) => header.findIndex(h => h.includes(name.toLowerCase()));

  // Mapeamento de colunas do Conta Azul
  const iNome        = idx("nome");
  const iRazao       = idx("razão social");
  const iCnpj        = idx("cnpj");
  const iEmail       = idx("email principal");
  const iTel         = idx("telefone principal");
  const iCep         = idx("cep");
  const iEstado      = idx("estado");
  const iCidade      = idx("cidade");
  const iEnd         = idx("endereço");
  const iNum         = idx("número");
  const iBairro      = idx("bairro");
  const iContato     = idx("nome contato");
  const iStatus      = idx("status");

  const rows: ImportRow[] = [];
  const erros: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.every(c => !c)) continue; // linha vazia

    const nome = (cols[iNome] || cols[iRazao] || "").replace(/^"|"$/g, "").trim();
    if (!nome) { erros.push(`Linha ${i + 1}: nome vazio, ignorada.`); continue; }

    const cnpjRaw = iCnpj >= 0 ? (cols[iCnpj] || "").trim() : "";
    // Normaliza CNPJ: mantém só dígitos e reformata
    const cnpjDigits = cnpjRaw.replace(/\D/g, "");
    const cnpj = cnpjDigits.length === 14
      ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : (cnpjRaw || null);

    const enderecoParts = [
      iEnd >= 0 ? (cols[iEnd] || "").trim() : "",
      iNum >= 0 ? (cols[iNum] || "").trim() : "",
    ].filter(Boolean);

    const statusRaw = (iStatus >= 0 ? cols[iStatus] || "" : "").toLowerCase();
    const status: "ativo" | "inativo" | "prospect" =
      statusRaw === "inativado" || statusRaw === "inativo" ? "inativo" :
      statusRaw === "prospect" ? "prospect" : "ativo";

    rows.push({
      nome,
      cnpj,
      email: iEmail >= 0 ? (cols[iEmail] || null) : null,
      telefone: iTel >= 0 ? (cols[iTel] || null) : null,
      cep: iCep >= 0 ? (cols[iCep] || null) : null,
      uf: iEstado >= 0 ? (cols[iEstado] || "RJ") : "RJ",
      cidade: iCidade >= 0 ? (cols[iCidade] || "Rio de Janeiro") : "Rio de Janeiro",
      endereco: enderecoParts.join(", ") || null,
      bairro: iBairro >= 0 ? (cols[iBairro] || null) : null,
      sindico: iContato >= 0 ? (cols[iContato] || null) : null,
      status,
    });
  }

  return { rows, erros };
}

function ModalImportacao({ onFechar, onImportado }: { onFechar: () => void; onImportado: () => void }) {
  const [etapa, setEtapa] = useState<"upload" | "preview" | "importando" | "concluido">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errosCSV, setErrosCSV] = useState<string[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [importados, setImportados] = useState(0);
  const [falhas, setFalhas] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleArquivo(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { rows: r, erros } = parseCSVContaAzul(text);
      setRows(r);
      setErrosCSV(erros);
      setEtapa("preview");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function importar() {
    setEtapa("importando");
    setProgresso(0);
    setFalhas([]);
    let ok = 0;
    const errs: string[] = [];
    const BATCH = 50;

    for (let i = 0; i < rows.length; i += BATCH) {
      const lote = rows.slice(i, i + BATCH).map(r => ({
        nome: r.nome,
        cnpj: r.cnpj,
        email: r.email,
        telefone: r.telefone,
        cep: r.cep,
        uf: r.uf,
        cidade: r.cidade,
        endereco: r.endereco,
        bairro: r.bairro,
        sindico: r.sindico,
        status: r.status,
        whatsapp: null,
        email_financeiro: null,
        telefone_financeiro: null,
        tipo_edificio: null,
        qtd_andares: null,
        qtd_portas_cf: null,
        data_ultima_vistoria: null,
        observacoes: null,
      }));

      const { error } = await supabase.from("clientes").insert(lote);
      if (error) {
        // Tenta inserir um a um para identificar o problemático
        for (const row of lote) {
          const { error: e2 } = await supabase.from("clientes").insert(row);
          if (e2) errs.push(`"${row.nome}": ${e2.message}`);
          else ok++;
        }
      } else {
        ok += lote.length;
      }
      setProgresso(Math.min(i + BATCH, rows.length));
      setImportados(ok);
    }

    setFalhas(errs);
    setEtapa("concluido");
    onImportado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-[#1a6b2f]" />
            <h2 className="text-base font-semibold text-gray-900">Importar Clientes (CSV)</h2>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ETAPA: Upload */}
          {etapa === "upload" && (
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center w-full"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleArquivo(f); }}>
                <Upload className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">Arraste o arquivo CSV ou clique para selecionar</p>
                <p className="text-xs text-gray-400 mt-1">Formato exportado do Conta Azul (separador ponto-e-vírgula)</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-medium text-white hover:bg-[#155a27]">
                  Selecionar arquivo
                </button>
                <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleArquivo(f); }} />
              </div>

              <div className="w-full rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2">Colunas esperadas do Conta Azul:</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Nome, Razão Social, CNPJ, Email principal, Telefone principal, CEP, Estado, Cidade, Endereço, Número, Bairro, Nome Contato, Status
                </p>
              </div>
            </div>
          )}

          {/* ETAPA: Preview */}
          {etapa === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">{rows.length} cliente{rows.length !== 1 ? "s" : ""} identificado{rows.length !== 1 ? "s" : ""}</p>
                  {errosCSV.length > 0 && <p className="text-xs text-green-700 mt-0.5">{errosCSV.length} linha{errosCSV.length !== 1 ? "s" : ""} ignorada{errosCSV.length !== 1 ? "s" : ""}</p>}
                </div>
              </div>

              {errosCSV.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Linhas ignoradas:</p>
                  {errosCSV.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
                  {errosCSV.length > 5 && <p className="text-xs text-amber-600">… e mais {errosCSV.length - 5}</p>}
                </div>
              )}

              {/* Tabela preview */}
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Nome", "CNPJ", "Cidade/UF", "Email", "Status"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{r.nome}</td>
                        <td className="px-3 py-2 text-gray-500">{r.cnpj || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{[r.cidade, r.uf].filter(Boolean).join(" - ")}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{r.email || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs",
                            r.status === "ativo" ? "bg-green-50 text-green-700" :
                            r.status === "inativo" ? "bg-gray-100 text-gray-500" :
                            "bg-blue-50 text-blue-700")}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <div className="px-3 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
                    … e mais {rows.length - 20} cliente{rows.length - 20 !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETAPA: Importando */}
          {etapa === "importando" && (
            <div className="flex flex-col items-center gap-6 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-[#1a6b2f]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Importando clientes...</p>
                <p className="text-xs text-gray-500 mt-1">{progresso} de {rows.length} processados</p>
              </div>
              <div className="w-full max-w-sm rounded-full bg-gray-100 h-2">
                <div className="h-2 rounded-full bg-[#1a6b2f] transition-all"
                  style={{ width: `${rows.length ? (progresso / rows.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* ETAPA: Concluído */}
          {etapa === "concluido" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">Importação concluída!</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="text-green-700 font-medium">{importados}</span> cliente{importados !== 1 ? "s" : ""} importado{importados !== 1 ? "s" : ""}
                  {falhas.length > 0 && <span className="text-red-600"> · {falhas.length} com erro</span>}
                </p>
              </div>
              {falhas.length > 0 && (
                <div className="w-full rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Erros:
                  </p>
                  {falhas.slice(0, 8).map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
                  {falhas.length > 8 && <p className="text-xs text-red-500">… e mais {falhas.length - 8}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {etapa === "upload" && (
            <button onClick={onFechar} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
          )}
          {etapa === "preview" && (
            <>
              <button onClick={() => setEtapa("upload")} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button
                onClick={importar}
                disabled={rows.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155a27] disabled:opacity-50">
                <Upload className="h-4 w-4" />
                Importar {rows.length} cliente{rows.length !== 1 ? "s" : ""}
              </button>
            </>
          )}
          {etapa === "concluido" && (
            <button onClick={onFechar} className="rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155a27]">
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modalImportacao, setModalImportacao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nome");
    if (error) setErro(error.message);
    else setClientes(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (form: FormData) => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    setErro(null);
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cidade: form.cidade || "Rio de Janeiro",
      uf: form.uf || "RJ",
      cep: form.cep || null,
      sindico: form.sindico || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      email_financeiro: form.email_financeiro || null,
      telefone_financeiro: form.telefone_financeiro || null,
      tipo_edificio: form.tipo_edificio || null,
      qtd_andares: form.qtd_andares ? parseInt(form.qtd_andares) : null,
      qtd_portas_cf: form.qtd_portas_cf ? parseInt(form.qtd_portas_cf) : null,
      perfil_tecnico: form.perfil_tecnico || null,
      status: form.status,
      data_ultima_vistoria: form.data_ultima_vistoria || null,
      observacoes: form.observacoes || null,
    };

    let error;
    if (editando) {
      ({ error } = await supabase.from("clientes").update(payload).eq("id", editando.id));
    } else {
      ({ error } = await supabase.from("clientes").insert(payload));
    }

    if (error) {
      setErro(error.message);
    } else {
      setModalAberto(false);
      setEditando(null);
      await carregar();
    }
    setSalvando(false);
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este cliente? Propostas e atendimentos vinculados não serão excluídos.")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) setErro(error.message);
    else {
      if (clienteSelecionado?.id === id) setClienteSelecionado(null);
      await carregar();
    }
  };

  const filtrados = clientes.filter(c => {
    const ok = filtroStatus === "todos" || c.status === filtroStatus;
    const buscarEm = [c.nome, c.bairro, c.cidade, c.sindico, c.cnpj].join(" ").toLowerCase();
    return ok && buscarEm.includes(busca.toLowerCase());
  });

  const abrirNovo = () => { setEditando(null); setModalAberto(true); };
  const abrirEditar = (c: Cliente) => { setEditando(c); setModalAberto(true); };
  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Lista */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Banco de Clientes</h1>
            <p className="text-xs text-gray-500">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} cadastrado{clientes.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalImportacao(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="h-4 w-4 text-gray-500" />
              Importar CSV
            </button>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155a27] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-[#1a6b2f] focus:bg-white focus:outline-none"
              placeholder="Buscar cliente, bairro, síndico..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {(["todos","ativo","prospect","inativo"] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                filtroStatus === s ? "bg-[#1a6b2f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}>
              {s === "todos" ? "Todos" : STATUS_CLIENTE[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Erro */}
        {erro && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
            <button onClick={() => setErro(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {carregando ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Building2 className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum cliente encontrado</p>
              <p className="text-xs mt-1">Clique em "Novo Cliente" para cadastrar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(c => (
                <ClienteRow
                  key={c.id}
                  cliente={c}
                  onEdit={() => abrirEditar(c)}
                  onDelete={() => excluir(c.id)}
                  onClick={() => setClienteSelecionado(clienteSelecionado?.id === c.id ? null : c)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Painel detalhe */}
      {clienteSelecionado && (
        <PainelDetalhe
          cliente={clienteSelecionado}
          onClose={() => setClienteSelecionado(null)}
          onEdit={() => abrirEditar(clienteSelecionado)}
        />
      )}

      {/* Modal novo/editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-bold text-gray-900">{editando ? "Editar Cliente" : "Novo Cliente"}</h2>
              <button onClick={fecharModal} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5">
              <FormCliente
                inicial={editando ? {
                  nome: editando.nome,
                  cnpj: editando.cnpj || "",
                  endereco: editando.endereco || "",
                  bairro: editando.bairro || "",
                  cidade: editando.cidade,
                  uf: editando.uf,
                  cep: editando.cep || "",
                  sindico: editando.sindico || "",
                  telefone: editando.telefone || "",
                  whatsapp: editando.whatsapp || "",
                  email: editando.email || "",
                  email_financeiro: editando.email_financeiro || "",
                  telefone_financeiro: editando.telefone_financeiro || "",
                  tipo_edificio: editando.tipo_edificio || "",
                  qtd_andares: editando.qtd_andares ? String(editando.qtd_andares) : "",
                  qtd_portas_cf: editando.qtd_portas_cf ? String(editando.qtd_portas_cf) : "",
                  perfil_tecnico: editando.perfil_tecnico || "",
                  status: editando.status,
                  data_ultima_vistoria: editando.data_ultima_vistoria || "",
                  observacoes: editando.observacoes || "",
                } : undefined}
                onSalvar={salvar}
                onCancelar={fecharModal}
                salvando={salvando}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal importação CSV */}
      {modalImportacao && (
        <ModalImportacao
          onFechar={() => setModalImportacao(false)}
          onImportado={() => { carregar(); }}
        />
      )}
    </div>
  );
}
