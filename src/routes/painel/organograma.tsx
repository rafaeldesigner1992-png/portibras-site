import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Plus, X, ChevronDown, ChevronRight, Edit2, Trash2,
  RefreshCw, Calculator, LayoutList, GitBranch, BarChart2,
  Building2, Shield, Briefcase, GraduationCap, Wrench,
  DollarSign, AlertCircle, Check, Loader2, Info, ExternalLink,
  Save, Search, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/organograma")({
  component: OrganogramaPage,
});

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Cargo {
  id: string;
  titulo: string;
  cbo: string | null;
  cbo_descricao: string | null;
  nivel: NivelCargo;
  departamento: string | null;
  vagas_total: number;
  sindicato_nome: string | null;
  sindicato_cnpj: string | null;
  convencao_coletiva: string | null;
  data_validade_cct: string | null;
  clt_referencia: string | null;
  piso_salarial: number | null;
  salario_estimado: number | null;
  vale_transporte: boolean;
  vale_refeicao_valor: number | null;
  plano_saude: boolean;
  observacoes: string | null;
  ultima_atualizacao_sindical: string | null;
  dados_sindicato_json: Record<string, unknown> | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface FuncionarioCargo {
  id: string;
  usuario_id: string;
  cargo_id: string;
  data_inicio: string;
  data_fim: string | null;
  salario_real: number | null;
  usuario?: { id: string; nome: string; email: string; perfil: string; ativo: boolean };
}

type NivelCargo = "diretoria" | "gerencia" | "coordenacao" | "operacional" | "estagio" | "terceirizado";
type VisualizacaoTipo = "lista" | "infografico" | "diagrama";

// ─── Constantes ──────────────────────────────────────────────────────────────
const NIVEIS: Record<NivelCargo, { label: string; cor: string; corBg: string; icon: React.ElementType; ordem: number }> = {
  diretoria:    { label: "Diretoria",     cor: "text-purple-800", corBg: "bg-purple-100 border-purple-300", icon: Shield,       ordem: 1 },
  gerencia:     { label: "Gerência",      cor: "text-blue-800",   corBg: "bg-blue-100 border-blue-300",     icon: Briefcase,    ordem: 2 },
  coordenacao:  { label: "Coordenação",   cor: "text-cyan-800",   corBg: "bg-cyan-100 border-cyan-300",     icon: Users,        ordem: 3 },
  operacional:  { label: "Operacional",   cor: "text-green-800",  corBg: "bg-green-100 border-green-300",   icon: Wrench,       ordem: 4 },
  estagio:      { label: "Estágio",       cor: "text-yellow-800", corBg: "bg-yellow-100 border-yellow-300", icon: GraduationCap,ordem: 5 },
  terceirizado: { label: "Terceirizado",  cor: "text-gray-700",   corBg: "bg-gray-100 border-gray-300",     icon: Building2,    ordem: 6 },
};

const ENCARGOS = {
  inss_empresa: 0.20,       // 20% INSS patronal
  fgts: 0.08,               // 8% FGTS
  ferias_proporcional: 1/12, // 1/12 de férias por mês
  decimo_terceiro: 1/12,    // 1/12 de 13º por mês
  aviso_previo: 1/12,       // provisão aviso prévio
  multa_fgts_provisao: 0.04, // 4% provisão multa FGTS
  rac: 0.01,                // RAC (riscos ambientais)
  sesi_sesc: 0.015,         // SESI/SESC 1,5%
  senai_senac: 0.01,        // SENAI/SENAC 1%
  sebrae: 0.006,            // SEBRAE 0,6%
  incra: 0.002,             // INCRA 0,2%
  salario_educacao: 0.025,  // Salário Educação 2,5%
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Calculadora Salarial ─────────────────────────────────────────────────────
function CalculadoraSalarial({ cargo, onClose }: { cargo: Cargo; onClose: () => void }) {
  const [salario, setSalario] = useState(String(cargo.salario_estimado ?? cargo.piso_salarial ?? 1800));
  const [vt, setVt] = useState(cargo.vale_transporte);
  const [vrDia, setVrDia] = useState(String(cargo.vale_refeicao_valor ?? 0));
  const [diasUteis, setDiasUteis] = useState("22");
  const [planoSaude, setPlanoSaude] = useState(cargo.plano_saude);
  const [planoSaudeValor, setPlanoSaudeValor] = useState("200");
  const [horistas, setHoristas] = useState(false);
  const [expandEncargos, setExpandEncargos] = useState(false);

  const sal = parseFloat(salario) || 0;
  const vr = parseFloat(vrDia) || 0;
  const du = parseInt(diasUteis) || 22;
  const ps = parseFloat(planoSaudeValor) || 0;

  // Desconto INSS empregado (tabela 2024)
  const calcINSSEmpregado = (s: number) => {
    if (s <= 1412.00) return s * 0.075;
    if (s <= 2666.68) return s * 0.09;
    if (s <= 4000.03) return s * 0.12;
    if (s <= 7786.02) return s * 0.14;
    return 908.86; // teto
  };

  const inssEmpregado = calcINSSEmpregado(sal);
  const baseIRRF = sal - inssEmpregado;
  // IRRF simplificado (tabela 2024)
  const calcIRRF = (b: number) => {
    if (b <= 2259.20) return 0;
    if (b <= 2826.65) return b * 0.075 - 169.44;
    if (b <= 3751.05) return b * 0.15 - 381.44;
    if (b <= 4664.68) return b * 0.225 - 662.77;
    return b * 0.275 - 896.00;
  };
  const irrf = calcIRRF(baseIRRF);
  const salarioLiquido = sal - inssEmpregado - irrf;

  // VT: desconto 6% sobre salário (lei do VT)
  const vtDesconto = vt ? Math.min(sal * 0.06, vr * du) : 0;
  const vtCustoEmpresa = vt ? (vr * du) - vtDesconto : 0;

  // Encargos patronais
  const inssPatronal = sal * ENCARGOS.inss_empresa;
  const fgts = sal * ENCARGOS.fgts;
  const feriasProvisao = sal * (ENCARGOS.ferias_proporcional + 1/3 * ENCARGOS.ferias_proporcional);
  const decimoTerceiro = sal * ENCARGOS.decimo_terceiro;
  const avisoPrevio = sal * ENCARGOS.aviso_previo;
  const multaFGTS = sal * ENCARGOS.multa_fgts_provisao;
  const sistemaS = sal * (ENCARGOS.sesi_sesc + ENCARGOS.senai_senac + ENCARGOS.sebrae + ENCARGOS.incra + ENCARGOS.salario_educacao);
  const rac = sal * ENCARGOS.rac;
  const totalEncargos = inssPatronal + fgts + feriasProvisao + decimoTerceiro + avisoPrevio + multaFGTS + sistemaS + rac;

  // Custo total mensal
  const custoTotal = sal + totalEncargos + (vt ? vtCustoEmpresa : 0) + (vr * du) + (planoSaude ? ps : 0);
  const percentualEncargos = sal > 0 ? ((totalEncargos / sal) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Calculadora Salarial</h2>
            <p className="text-sm text-gray-500">{cargo.titulo}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Salário Bruto (R$)</label>
              <input
                type="number"
                value={salario}
                onChange={e => setSalario(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]"
              />
              {cargo.piso_salarial && (
                <p className="mt-1 text-xs text-gray-400">
                  Piso: {fmt(cargo.piso_salarial)}
                  {parseFloat(salario) < cargo.piso_salarial && (
                    <span className="ml-1 text-red-500 font-medium">⚠ Abaixo do piso!</span>
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Dias Úteis no Mês</label>
              <input
                type="number"
                value={diasUteis}
                onChange={e => setDiasUteis(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vale Refeição (R$/dia)</label>
              <input
                type="number"
                value={vrDia}
                onChange={e => setVrDia(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vale Transporte</label>
              <button
                onClick={() => setVt(v => !v)}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  vt ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-50 text-gray-600"
                )}
              >
                {vt ? "✓ Concedido (desconto 6%)" : "✗ Não concedido"}
              </button>
            </div>

            <div className="col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={planoSaude} onChange={e => setPlanoSaude(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">Plano de Saúde</span>
              </label>
              {planoSaude && (
                <input
                  type="number"
                  value={planoSaudeValor}
                  onChange={e => setPlanoSaudeValor(e.target.value)}
                  placeholder="Valor R$/mês"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]"
                />
              )}
            </div>
          </div>

          {/* Resultado para o empregado */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-3">💼 Holerite do Empregado</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Salário Bruto</span><span className="font-semibold">{fmt(sal)}</span></div>
              <div className="flex justify-between text-red-600"><span>(-) INSS Empregado</span><span>- {fmt(inssEmpregado)}</span></div>
              <div className="flex justify-between text-red-600"><span>(-) IRRF</span><span>- {fmt(irrf)}</span></div>
              {vt && <div className="flex justify-between text-red-600"><span>(-) VT (6% do salário)</span><span>- {fmt(vtDesconto)}</span></div>}
              <div className="border-t border-blue-200 pt-2 flex justify-between font-bold text-blue-900">
                <span>= Salário Líquido</span><span>{fmt(salarioLiquido - (vt ? vtDesconto : 0))}</span>
              </div>
            </div>
          </div>

          {/* Custo para a empresa */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-bold text-green-900 mb-3">🏢 Custo Total para a Empresa</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Salário Bruto</span><span className="font-semibold">{fmt(sal)}</span></div>

              {/* Encargos colapsáveis */}
              <button
                onClick={() => setExpandEncargos(e => !e)}
                className="flex w-full items-center justify-between rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-800"
              >
                <span>(+) Encargos Patronais (~{percentualEncargos}%)</span>
                <span className="flex items-center gap-1">
                  {fmt(totalEncargos)}
                  {expandEncargos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
              </button>

              {expandEncargos && (
                <div className="ml-3 space-y-1 text-xs text-gray-600 border-l-2 border-green-200 pl-3">
                  <div className="flex justify-between"><span>INSS Patronal (20%)</span><span>{fmt(inssPatronal)}</span></div>
                  <div className="flex justify-between"><span>FGTS (8%)</span><span>{fmt(fgts)}</span></div>
                  <div className="flex justify-between"><span>Férias + 1/3 (prov.)</span><span>{fmt(feriasProvisao)}</span></div>
                  <div className="flex justify-between"><span>13º Salário (prov.)</span><span>{fmt(decimoTerceiro)}</span></div>
                  <div className="flex justify-between"><span>Aviso Prévio (prov.)</span><span>{fmt(avisoPrevio)}</span></div>
                  <div className="flex justify-between"><span>Multa FGTS (prov. 4%)</span><span>{fmt(multaFGTS)}</span></div>
                  <div className="flex justify-between"><span>Sistema S (SESI/SENAI etc.)</span><span>{fmt(sistemaS)}</span></div>
                  <div className="flex justify-between"><span>RAC (1%)</span><span>{fmt(rac)}</span></div>
                </div>
              )}

              {vr > 0 && <div className="flex justify-between"><span className="text-gray-600">(+) Vale Refeição ({du}d × {fmt(vr)})</span><span>{fmt(vr * du)}</span></div>}
              {vt && vtCustoEmpresa > 0 && <div className="flex justify-between"><span className="text-gray-600">(+) VT custo empresa</span><span>{fmt(vtCustoEmpresa)}</span></div>}
              {planoSaude && ps > 0 && <div className="flex justify-between"><span className="text-gray-600">(+) Plano de Saúde</span><span>{fmt(ps)}</span></div>}

              <div className="border-t border-green-300 pt-2 flex justify-between font-bold text-green-900 text-base">
                <span>= Custo Total / Mês</span><span>{fmt(custoTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Custo Anual estimado</span><span>{fmt(custoTotal * 12)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            * Cálculos baseados na tabela INSS/IRRF 2024. Encargos podem variar conforme convenção coletiva e modalidade de contrato. Consulte seu contador.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Cargo ───────────────────────────────────────────────────────────
const FORM_VAZIO = {
  titulo: "", cbo: "", cbo_descricao: "", nivel: "operacional" as NivelCargo,
  departamento: "", vagas_total: 1, sindicato_nome: "", sindicato_cnpj: "",
  convencao_coletiva: "", data_validade_cct: "", clt_referencia: "",
  piso_salarial: "", salario_estimado: "", vale_transporte: true,
  vale_refeicao_valor: "", plano_saude: false, observacoes: "", ativo: true,
};

function ModalCargo({
  cargo,
  onClose,
  onSave,
}: {
  cargo: Cargo | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({ ...FORM_VAZIO, ...(cargo ? {
    ...cargo,
    piso_salarial: String(cargo.piso_salarial ?? ""),
    salario_estimado: String(cargo.salario_estimado ?? ""),
    vale_refeicao_valor: String(cargo.vale_refeicao_valor ?? ""),
    data_validade_cct: cargo.data_validade_cct ?? "",
  } : {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoSindical, setBuscandoSindical] = useState(false);
  const [msgSindical, setMsgSindical] = useState<string | null>(null);

  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const atualizarSindical = async () => {
    if (!form.cbo) { setMsgSindical("Informe o CBO primeiro."); return; }
    setBuscandoSindical(true);
    setMsgSindical(null);
    // Simulação — em produção conectaria à API do MTE ou CAGED
    await new Promise(r => setTimeout(r, 1500));
    const simulado = {
      data_consulta: new Date().toISOString(),
      cbo: form.cbo,
      fonte: "Simulação (MTE/CAGED)",
      piso_vigente: form.piso_salarial || "1800,00",
      convencao: form.convencao_coletiva || "CCT 2024/2025",
      sindicato: form.sindicato_nome || "SINDMANI-RJ",
      observacao: "Dados simulados — conecte à API do MTE para dados reais.",
    };
    setForm(f => ({ ...f, dados_sindicato_json: JSON.stringify(simulado), ultima_atualizacao_sindical: new Date().toISOString() }));
    setMsgSindical(`✓ Dados atualizados em ${new Date().toLocaleString("pt-BR")}`);
    setBuscandoSindical(false);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { setErro("Título é obrigatório."); return; }
    setSalvando(true);
    setErro(null);
    const payload = {
      titulo: form.titulo.trim(),
      cbo: form.cbo || null,
      cbo_descricao: form.cbo_descricao || null,
      nivel: form.nivel,
      departamento: form.departamento || null,
      vagas_total: parseInt(String(form.vagas_total)) || 1,
      sindicato_nome: form.sindicato_nome || null,
      sindicato_cnpj: form.sindicato_cnpj || null,
      convencao_coletiva: form.convencao_coletiva || null,
      data_validade_cct: form.data_validade_cct || null,
      clt_referencia: form.clt_referencia || null,
      piso_salarial: parseFloat(String(form.piso_salarial)) || null,
      salario_estimado: parseFloat(String(form.salario_estimado)) || null,
      vale_transporte: form.vale_transporte,
      vale_refeicao_valor: parseFloat(String(form.vale_refeicao_valor)) || null,
      plano_saude: form.plano_saude,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };
    let err;
    if (cargo) {
      ({ error: err } = await supabase.from("cargos").update(payload).eq("id", cargo.id));
    } else {
      ({ error: err } = await supabase.from("cargos").insert(payload));
    }
    setSalvando(false);
    if (err) { setErro(err.message); return; }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{cargo ? "Editar Cargo" : "Novo Cargo / Vaga"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{erro}</div>}

          {/* Básico */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b w-full">Identificação</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título do Cargo *</label>
                <input value={form.titulo} onChange={campo("titulo")} placeholder="Ex: Técnico em Manutenção de Portas Corta-Fogo"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CBO (Código Brasileiro de Ocupações)</label>
                <input value={form.cbo} onChange={campo("cbo")} placeholder="Ex: 7156-10"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nível Hierárquico</label>
                <select value={form.nivel} onChange={campo("nivel")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]">
                  {Object.entries(NIVEIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento / Área</label>
                <input value={form.departamento} onChange={campo("departamento")} placeholder="Ex: Técnica, Comercial, Admin"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd de Vagas</label>
                <input type="number" min={1} value={form.vagas_total} onChange={campo("vagas_total")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição CBO</label>
                <input value={form.cbo_descricao} onChange={campo("cbo_descricao")} placeholder="Descrição oficial do CBO"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
            </div>
          </fieldset>

          {/* CLT / Sindicato */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b w-full">CLT / Convenção Coletiva / Sindicato</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sindicato Responsável</label>
                <input value={form.sindicato_nome} onChange={campo("sindicato_nome")} placeholder="Ex: SINTIMANI-RJ"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CNPJ do Sindicato</label>
                <input value={form.sindicato_cnpj} onChange={campo("sindicato_cnpj")} placeholder="00.000.000/0000-00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Convenção Coletiva (CCT)</label>
                <input value={form.convencao_coletiva} onChange={campo("convencao_coletiva")} placeholder="Ex: CCT 2024/2025"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Validade da CCT</label>
                <input type="date" value={form.data_validade_cct} onChange={campo("data_validade_cct")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Referência CLT (artigo/parágrafo)</label>
                <input value={form.clt_referencia} onChange={campo("clt_referencia")} placeholder="Ex: Art. 458, CLT — Benefícios em espécie"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>

              {/* Botão atualizar sindical */}
              <div className="col-span-2">
                <button onClick={atualizarSindical} disabled={buscandoSindical}
                  className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                  {buscandoSindical ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar dados do sindicato / CCT
                </button>
                {msgSindical && <p className="mt-1 text-xs text-green-600">{msgSindical}</p>}
                <p className="mt-1 text-xs text-gray-400">Consulta CBO e sindicato para trazer atualizações da CCT vigente.</p>
              </div>
            </div>
          </fieldset>

          {/* Salário e benefícios */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b w-full">Salário &amp; Benefícios</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Piso Salarial (R$)</label>
                <input type="number" value={form.piso_salarial} onChange={campo("piso_salarial")} placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Salário Estimado (R$)</label>
                <input type="number" value={form.salario_estimado} onChange={campo("salario_estimado")} placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vale Refeição (R$/dia)</label>
                <input type="number" value={form.vale_refeicao_valor} onChange={campo("vale_refeicao_valor")} placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.vale_transporte} onChange={campo("vale_transporte")} className="rounded" />
                  Vale Transporte (obrigatório CLT)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.plano_saude} onChange={campo("plano_saude")} className="rounded" />
                  Plano de Saúde
                </label>
              </div>
            </div>
          </fieldset>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={campo("observacoes")} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f] resize-none" />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={form.ativo} onChange={campo("ativo")} className="rounded" />
              Vaga ativa
            </label>
            <div className="flex-1" />
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-sm font-medium text-white hover:bg-[#155a27] disabled:opacity-50">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {cargo ? "Salvar alterações" : "Criar cargo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card de Cargo ────────────────────────────────────────────────────────────
function CardCargo({
  cargo,
  funcionarios,
  onEditar,
  onCalculadora,
  onExcluir,
}: {
  cargo: Cargo;
  funcionarios: FuncionarioCargo[];
  onEditar: () => void;
  onCalculadora: () => void;
  onExcluir: () => void;
}) {
  const nivel = NIVEIS[cargo.nivel];
  const Icon = nivel.icon;
  const vagasOcupadas = funcionarios.filter(f => !f.data_fim).length;
  const vagasLivres = cargo.vagas_total - vagasOcupadas;
  const cctVencida = cargo.data_validade_cct && new Date(cargo.data_validade_cct) < new Date();

  return (
    <div className={cn("rounded-xl border-2 bg-white p-4 shadow-sm transition-shadow hover:shadow-md", nivel.corBg)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn("rounded-lg p-2 flex-shrink-0", nivel.corBg)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{cargo.titulo}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", nivel.cor, nivel.corBg)}>
                {nivel.label}
              </span>
              {cargo.departamento && (
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {cargo.departamento}
                </span>
              )}
              {!cargo.ativo && <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">Inativa</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onCalculadora} title="Calculadora salarial" className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-green-700">
            <Calculator className="h-4 w-4" />
          </button>
          <button onClick={onEditar} title="Editar" className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-blue-700">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onExcluir} title="Excluir" className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {cargo.cbo && (
          <div className="flex gap-1">
            <span className="text-gray-500">CBO:</span>
            <span className="font-medium text-gray-700">{cargo.cbo}</span>
          </div>
        )}
        {cargo.piso_salarial && (
          <div className="flex gap-1">
            <span className="text-gray-500">Piso:</span>
            <span className="font-medium text-gray-700">{fmt(cargo.piso_salarial)}</span>
          </div>
        )}
        {cargo.sindicato_nome && (
          <div className="col-span-2 flex gap-1">
            <span className="text-gray-500">Sindicato:</span>
            <span className="font-medium text-gray-700 truncate">{cargo.sindicato_nome}</span>
          </div>
        )}
        {cargo.convencao_coletiva && (
          <div className="col-span-2 flex items-center gap-1">
            <span className="text-gray-500">CCT:</span>
            <span className="font-medium text-gray-700">{cargo.convencao_coletiva}</span>
            {cctVencida && <span className="text-red-500 font-bold">⚠ Vencida</span>}
          </div>
        )}
      </div>

      {/* Vagas */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">VAGAS</span>
          <span className="text-xs text-gray-500">{vagasOcupadas}/{cargo.vagas_total} ocupadas</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mb-2">
          <div className="h-full rounded-full bg-[#1a6b2f] transition-all" style={{ width: `${cargo.vagas_total > 0 ? (vagasOcupadas / cargo.vagas_total) * 100 : 0}%` }} />
        </div>
        <div className="flex gap-2">
          {funcionarios.filter(f => !f.data_fim).map(f => (
            <div key={f.id} title={f.usuario?.nome ?? ""}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-xs font-bold text-[#1a6b2f]">
              {(f.usuario?.nome ?? "?").charAt(0)}
            </div>
          ))}
          {vagasLivres > 0 && Array.from({ length: vagasLivres }).map((_, i) => (
            <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-xs text-gray-400">
              +
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Visão Diagrama (organograma visual) ─────────────────────────────────────
function VistaDiagrama({ cargos, funcionarios }: { cargos: Cargo[]; funcionarios: FuncionarioCargo[] }) {
  const niveisOrdenados = Object.entries(NIVEIS).sort((a, b) => a[1].ordem - b[1].ordem);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px] space-y-0">
        {niveisOrdenados.map(([nivel, info], idx) => {
          const cargosNivel = cargos.filter(c => c.nivel === nivel && c.ativo);
          if (cargosNivel.length === 0) return null;
          const Icon = info.icon;
          return (
            <div key={nivel} className="relative">
              {/* Linha de nível */}
              <div className="flex items-center gap-3 mb-2 mt-4">
                <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border", info.corBg, info.cor)}>
                  <Icon className="h-3.5 w-3.5" />
                  {info.label}
                </div>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Cargos do nível */}
              <div className="flex flex-wrap gap-3 pl-4">
                {cargosNivel.map(cargo => {
                  const ocupantes = funcionarios.filter(f => f.cargo_id === cargo.id && !f.data_fim);
                  return (
                    <div key={cargo.id}
                      className={cn("relative rounded-xl border-2 bg-white p-3 min-w-[160px] max-w-[200px] shadow-sm", info.corBg)}>
                      {/* Conector vertical (exceto primeiro nível) */}
                      {idx > 0 && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-px h-4 bg-gray-300" />
                      )}
                      <p className="text-xs font-bold text-gray-800 leading-tight">{cargo.titulo}</p>
                      {cargo.departamento && <p className="text-xs text-gray-500 mt-0.5">{cargo.departamento}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ocupantes.length > 0 ? ocupantes.map(f => (
                          <span key={f.id} className="inline-block rounded-full bg-white/80 border border-gray-200 px-2 py-0.5 text-xs text-gray-700">
                            {f.usuario?.nome?.split(" ")[0] ?? "?"}
                          </span>
                        )) : (
                          <span className="text-xs text-gray-400 italic">Vaga aberta</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Visão Infográfico ────────────────────────────────────────────────────────
function VistaInfografico({ cargos, funcionarios }: { cargos: Cargo[]; funcionarios: FuncionarioCargo[] }) {
  const totalVagas = cargos.reduce((s, c) => s + c.vagas_total, 0);
  const totalOcupadas = cargos.reduce((s, c) => s + funcionarios.filter(f => f.cargo_id === c.id && !f.data_fim).length, 0);
  const totalLivres = totalVagas - totalOcupadas;

  const porNivel = Object.entries(NIVEIS).map(([nivel, info]) => ({
    nivel, label: info.label, cor: info.corBg, corTexto: info.cor,
    icon: info.icon,
    total: cargos.filter(c => c.nivel === nivel).reduce((s, c) => s + c.vagas_total, 0),
    ocupadas: cargos.filter(c => c.nivel === nivel).reduce((s, c) => s + funcionarios.filter(f => f.cargo_id === c.id && !f.data_fim).length, 0),
  })).filter(n => n.total > 0);

  const porDepto = Object.entries(
    cargos.reduce((acc: Record<string, number>, c) => {
      const d = c.departamento ?? "Sem departamento";
      acc[d] = (acc[d] ?? 0) + c.vagas_total;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxDepto = Math.max(...porDepto.map(d => d[1]), 1);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Donut resumo */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Ocupação Geral</h3>
        <div className="flex items-center justify-center gap-6">
          <svg viewBox="0 0 120 120" width={110} height={110}>
            {totalVagas > 0 && (() => {
              const r = 48, cx = 60, cy = 60;
              const pct = totalOcupadas / totalVagas;
              const angle = pct * 2 * Math.PI - Math.PI / 2;
              const x1 = cx + r * Math.cos(-Math.PI / 2);
              const y1 = cy + r * Math.sin(-Math.PI / 2);
              const x2 = cx + r * Math.cos(angle);
              const y2 = cy + r * Math.sin(angle);
              const large = pct > 0.5 ? 1 : 0;
              return (
                <>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
                  {totalOcupadas > 0 && (
                    <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                      fill="none" stroke="#1a6b2f" strokeWidth="18" strokeLinecap="round" />
                  )}
                  <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1a6b2f">
                    {totalOcupadas}
                  </text>
                  <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#6b7280">
                    de {totalVagas}
                  </text>
                </>
              );
            })()}
          </svg>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#1a6b2f] flex-shrink-0" />
              <span className="text-gray-600">Ocupadas: <strong>{totalOcupadas}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-gray-200 flex-shrink-0" />
              <span className="text-gray-600">Abertas: <strong>{totalLivres}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-dashed border-gray-400 flex-shrink-0" />
              <span className="text-gray-600">Total: <strong>{totalVagas}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Por nível */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Por Nível Hierárquico</h3>
        <div className="space-y-3">
          {porNivel.map(n => {
            const Icon = n.icon;
            return (
              <div key={n.nivel}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Icon className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-gray-700 font-medium">{n.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">{n.ocupadas}/{n.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#1a6b2f] transition-all"
                    style={{ width: `${n.total > 0 ? (n.ocupadas / n.total) * 100 : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por departamento */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Por Departamento</h3>
        <div className="space-y-2">
          {porDepto.map(([depto, qtd]) => (
            <div key={depto} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-28 truncate">{depto}</span>
              <div className="flex-1 h-4 rounded bg-gray-100 overflow-hidden">
                <div className="h-full rounded bg-[#1a6b2f]/70 transition-all"
                  style={{ width: `${(qtd / maxDepto) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-700 w-6 text-right">{qtd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
function OrganogramaPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioCargo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>("lista");
  const [modalCargo, setModalCargo] = useState<Cargo | null | "novo">(null);
  const [calculadora, setCalculadora] = useState<Cargo | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<NivelCargo | "todos">("todos");

  // Bloquear acesso não-admin
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [usuario]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [cargosRes, fcRes] = await Promise.all([
      supabase.from("cargos").select("*").order("nivel").order("titulo"),
      supabase.from("funcionarios_cargos").select("*, usuario:usuarios(id, nome, email, perfil, ativo)"),
    ]);
    if (cargosRes.data) setCargos(cargosRes.data as Cargo[]);
    if (fcRes.data) setFuncionarios(fcRes.data as FuncionarioCargo[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const excluirCargo = async (id: string) => {
    if (!confirm("Excluir este cargo? Esta ação não pode ser desfeita.")) return;
    await supabase.from("cargos").delete().eq("id", id);
    carregar();
  };

  const cargosFiltrados = cargos.filter(c => {
    const q = busca.toLowerCase();
    const matchBusca = !q || c.titulo.toLowerCase().includes(q) || (c.departamento ?? "").toLowerCase().includes(q) || (c.sindicato_nome ?? "").toLowerCase().includes(q);
    const matchNivel = filtroNivel === "todos" || c.nivel === filtroNivel;
    return matchBusca && matchNivel;
  });

  if (usuario?.perfil !== "admin") return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Cabeçalho ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-[#1a6b2f]" />
            Organograma &amp; RH
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargos.length} cargos · {cargos.reduce((s, c) => s + c.vagas_total, 0)} vagas ·{" "}
            {funcionarios.filter(f => !f.data_fim).length} ocupadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
          </button>
          <button
            onClick={() => setModalCargo("novo")}
            className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-sm font-medium text-white hover:bg-[#155a27]">
            <Plus className="h-4 w-4" />
            Novo Cargo
          </button>
        </div>
      </div>

      {/* ── Filtros + Visualização ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cargo, departamento..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
        </div>

        {/* Filtro nível */}
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value as NivelCargo | "todos")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]">
          <option value="todos">Todos os níveis</option>
          {Object.entries(NIVEIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Toggle visualização */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 gap-1">
          {([["lista", LayoutList, "Lista"], ["infografico", BarChart2, "Infográfico"], ["diagrama", GitBranch, "Diagrama"]] as const).map(([tipo, Icon, label]) => (
            <button key={tipo} onClick={() => setVisualizacao(tipo)}
              title={label}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                visualizacao === tipo ? "bg-[#1a6b2f] text-white" : "text-gray-600 hover:bg-gray-100")}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {carregando ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : cargos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cargo cadastrado</p>
          <p className="text-sm text-gray-400 mt-1">Crie o primeiro cargo para começar o organograma.</p>
          <button onClick={() => setModalCargo("novo")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2 text-sm font-medium text-white hover:bg-[#155a27]">
            <Plus className="h-4 w-4" />Criar primeiro cargo
          </button>
        </div>
      ) : (
        <>
          {visualizacao === "lista" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cargosFiltrados.map(cargo => (
                <CardCargo
                  key={cargo.id}
                  cargo={cargo}
                  funcionarios={funcionarios.filter(f => f.cargo_id === cargo.id)}
                  onEditar={() => setModalCargo(cargo)}
                  onCalculadora={() => setCalculadora(cargo)}
                  onExcluir={() => excluirCargo(cargo.id)}
                />
              ))}
            </div>
          )}

          {visualizacao === "infografico" && (
            <VistaInfografico cargos={cargosFiltrados} funcionarios={funcionarios} />
          )}

          {visualizacao === "diagrama" && (
            <VistaDiagrama cargos={cargosFiltrados} funcionarios={funcionarios} />
          )}
        </>
      )}

      {/* ── Aviso de acesso ── */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Módulo restrito a Administradores.</strong> Informações de cargos, salários e encargos são confidenciais.
          A calculadora usa tabela INSS/IRRF 2024 — consulte seu contador para confirmação.
        </div>
      </div>

      {/* ── Modais ── */}
      {modalCargo !== null && (
        <ModalCargo
          cargo={modalCargo === "novo" ? null : modalCargo}
          onClose={() => setModalCargo(null)}
          onSave={carregar}
        />
      )}
      {calculadora && (
        <CalculadoraSalarial cargo={calculadora} onClose={() => setCalculadora(null)} />
      )}
    </div>
  );
}
