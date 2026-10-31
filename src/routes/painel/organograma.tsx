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

// ─── Banco CBO (Código Brasileiro de Ocupações) ───────────────────────────────
const CBO_DATABASE = [
  { codigo: "1231-05", titulo: "Diretor Geral",                              descricao: "Planeja, organiza e dirige atividades da empresa; define políticas e metas estratégicas." },
  { codigo: "1412-05", titulo: "Gerente de Operações",                        descricao: "Coordena operações da empresa, supervisiona equipes técnicas e administrativas." },
  { codigo: "1414-05", titulo: "Gerente Administrativo",                      descricao: "Administra recursos humanos, financeiros e materiais de unidades organizacionais." },
  { codigo: "1425-05", titulo: "Gerente Comercial",                           descricao: "Gerencia atividades comerciais, coordena equipes de vendas e prospecção." },
  { codigo: "1411-05", titulo: "Gerente de Manutenção",                       descricao: "Coordena e controla equipes de manutenção predial e industrial." },
  { codigo: "3514-05", titulo: "Coordenador de Operações",                    descricao: "Coordena operações de campo, agenda serviços e controla execução técnica." },
  { codigo: "3542-05", titulo: "Vendedor Técnico",                            descricao: "Comercializa produtos e serviços técnicos, elabora propostas e orçamentos." },
  { codigo: "3543-05", titulo: "Vendedor Externo",                            descricao: "Realiza vendas externas, visita clientes, prospecta e fecha negócios." },
  { codigo: "7156-10", titulo: "Técnico em Manutenção Predial",               descricao: "Realiza manutenção preventiva e corretiva em sistemas prediais, incluindo portas, esquadrias e sistemas de segurança." },
  { codigo: "7156-30", titulo: "Técnico de Manutenção Industrial",            descricao: "Executa manutenção em equipamentos e instalações industriais." },
  { codigo: "7171-05", titulo: "Técnico em Proteção Contra Incêndio",         descricao: "Instala, inspeciona e mantém sistemas e equipamentos de proteção contra incêndio." },
  { codigo: "7171-15", titulo: "Inspetor de Segurança Contra Incêndio",       descricao: "Vistoria instalações e equipamentos de combate a incêndio, emite laudos e relatórios técnicos." },
  { codigo: "7242-10", titulo: "Soldador",                                    descricao: "Executa soldagem de peças metálicas por diferentes processos (MIG, TIG, eletrodo)." },
  { codigo: "7215-35", titulo: "Serralheiro",                                 descricao: "Fabrica e instala esquadrias metálicas, grades, portões e estruturas em aço." },
  { codigo: "7156-15", titulo: "Auxiliar de Manutenção Predial",              descricao: "Auxilia em serviços de manutenção predial, realiza reparos e conservação." },
  { codigo: "7215-05", titulo: "Ajustador Mecânico",                          descricao: "Monta, ajusta e regula peças e componentes mecânicos conforme especificações." },
  { codigo: "5143-20", titulo: "Vistoriador Predial",                         descricao: "Vistoria imóveis e instalações, elabora laudos técnicos e relatórios de condições." },
  { codigo: "3131-05", titulo: "Técnico em Eletrotécnica",                    descricao: "Instala, opera e mantém sistemas elétricos prediais e industriais." },
  { codigo: "4110-05", titulo: "Assistente Administrativo",                   descricao: "Executa atividades administrativas, organiza documentos, controla arquivo e apoia gestão." },
  { codigo: "4101-05", titulo: "Auxiliar Administrativo",                     descricao: "Realiza tarefas de suporte administrativo, atendimento e organização de rotinas." },
  { codigo: "4131-10", titulo: "Auxiliar de Escritório",                      descricao: "Executa serviços gerais de escritório, digitação, arquivo e atendimento." },
  { codigo: "4211-10", titulo: "Recepcionista",                               descricao: "Recepciona pessoas, atende chamadas, agenda compromissos e realiza triagem." },
  { codigo: "2521-05", titulo: "Analista de Recursos Humanos",                descricao: "Desenvolve e implementa políticas de RH, recrutamento, treinamento e remuneração." },
  { codigo: "2522-05", titulo: "Analista Financeiro",                         descricao: "Analisa dados financeiros, elabora relatórios e controla fluxo de caixa." },
  { codigo: "2524-05", titulo: "Analista de Sistemas",                        descricao: "Analisa, projeta e implementa sistemas de informação." },
  { codigo: "5191-05", titulo: "Auxiliar de Serviços Gerais",                 descricao: "Realiza limpeza, conservação e serviços gerais em instalações." },
  { codigo: "8281-20", titulo: "Montador de Estruturas Metálicas",            descricao: "Monta estruturas metálicas em obras e instalações industriais e prediais." },
  { codigo: "3513-35", titulo: "Estagiário",                                  descricao: "Desenvolve atividades de aprendizado prático conforme Lei 11.788/08, sob supervisão." },
  { codigo: "7215-40", titulo: "Ferreiro / Armador",                          descricao: "Fabrica e instala ferragens, dobradiças e fechaduras em esquadrias e portas." },
  { codigo: "3514-25", titulo: "Técnico de Vendas e Serviços",                descricao: "Presta suporte técnico a clientes, demonstra produtos e resolve problemas de campo." },
  { codigo: "1232-05", titulo: "Diretor Comercial",                           descricao: "Dirige área comercial, define estratégia de vendas, metas e políticas de preços." },
  { codigo: "2515-10", titulo: "Psicólogo Organizacional",                    descricao: "Realiza seleção, avaliação e desenvolvimento de pessoal em contextos organizacionais." },
  { codigo: "4221-05", titulo: "Operador de Telemarketing",                   descricao: "Realiza atendimento ativo e receptivo por telefone para suporte ou vendas." },
  { codigo: "7821-05", titulo: "Motorista de Veículo Leve",                   descricao: "Conduz veículos leves para transporte de pessoas ou materiais." },
  { codigo: "7823-05", titulo: "Motorista de Veículo Pesado",                 descricao: "Conduz caminhões ou veículos de carga para transporte de materiais." },
  { codigo: "3543-20", titulo: "Representante Comercial",                     descricao: "Representa empresa junto a clientes, negocia contratos e desenvolve carteira." },
  { codigo: "4143-10", titulo: "Almoxarife",                                  descricao: "Controla estoque, recebe e distribui materiais, realiza inventários." },
  { codigo: "5141-05", titulo: "Porteiro",                                    descricao: "Controla acesso de pessoas e veículos, realiza ronda e vigilância patrimonial." },
  { codigo: "1414-15", titulo: "Supervisor Administrativo",                   descricao: "Supervisiona equipe administrativa, coordena rotinas e processos internos." },
];

// Normaliza texto para comparação: remove acentos, minúsculas
function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Fuzzy match por relevância de palavras-chave
function buscarCBO(query: string): typeof CBO_DATABASE {
  if (!query.trim()) return [];
  const palavras = normalizar(query).split(/\s+/).filter(p => p.length > 2);
  if (!palavras.length) return [];

  const scored = CBO_DATABASE.map(entry => {
    const haystack = normalizar(entry.titulo + " " + entry.descricao + " " + entry.codigo);
    let score = 0;
    for (const p of palavras) {
      if (haystack.includes(p)) score += p.length; // mais peso para palavras longas
    }
    return { ...entry, score };
  }).filter(e => e.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

// ─── Recomendações de Vagas para PORTIBRAS ────────────────────────────────────
const RECOMENDACOES_PORTIBRAS = [
  {
    titulo: "Técnico em Manutenção Predial",
    cbo: "7156-10",
    cbo_descricao: "Realiza manutenção preventiva e corretiva em sistemas prediais, incluindo portas, esquadrias e sistemas de segurança.",
    nivel: "operacional" as const,
    departamento: "Técnica",
    piso_salarial: 1800,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINTIMANI-RJ",
    observacoes: "Cargo principal — instalação e manutenção de portas corta-fogo (PCF). Exige NR35, NR10 e conhecimento de ABNT NBR 11742.",
    emoji: "🔧",
    destaque: true,
  },
  {
    titulo: "Técnico em Proteção Contra Incêndio",
    cbo: "7171-05",
    cbo_descricao: "Instala, inspeciona e mantém sistemas e equipamentos de proteção contra incêndio.",
    nivel: "operacional" as const,
    departamento: "Técnica",
    piso_salarial: 2000,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINTIMANI-RJ",
    observacoes: "Inspeção e certificação de PCF. Conhecimento de normas do Corpo de Bombeiros RJ e CBMERJ.",
    emoji: "🔥",
    destaque: true,
  },
  {
    titulo: "Vistoriador Predial",
    cbo: "5143-20",
    cbo_descricao: "Vistoria imóveis e instalações, elabora laudos técnicos e relatórios de condições.",
    nivel: "operacional" as const,
    departamento: "Técnica",
    piso_salarial: 1700,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINTIMANI-RJ",
    observacoes: "Realiza vistorias em clientes para diagnóstico do estado das PCF e geração de relatórios para proposta comercial.",
    emoji: "🔍",
    destaque: false,
  },
  {
    titulo: "Auxiliar de Manutenção Predial",
    cbo: "7156-15",
    cbo_descricao: "Auxilia em serviços de manutenção predial, realiza reparos e conservação.",
    nivel: "operacional" as const,
    departamento: "Técnica",
    piso_salarial: 1412,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINTIMANI-RJ",
    observacoes: "Apoia técnicos nas instalações e manutenções de PCF. Perfil de desenvolvimento para técnico pleno.",
    emoji: "🔩",
    destaque: false,
  },
  {
    titulo: "Vendedor Técnico",
    cbo: "3542-05",
    cbo_descricao: "Comercializa produtos e serviços técnicos, elabora propostas e orçamentos.",
    nivel: "operacional" as const,
    departamento: "Comercial",
    piso_salarial: 1800,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINDESP-RJ",
    observacoes: "Prospecção de condomínios, indústrias e shopping centers. Metas de novos contratos de manutenção 12x. Comissão sobre vendas.",
    emoji: "💼",
    destaque: true,
  },
  {
    titulo: "Coordenador de Operações",
    cbo: "3514-05",
    cbo_descricao: "Coordena operações de campo, agenda serviços e controla execução técnica.",
    nivel: "coordenacao" as const,
    departamento: "Operações",
    piso_salarial: 2800,
    vale_transporte: false,
    vale_refeicao_valor: 25,
    sindicato_nome: "SINDESP-RJ",
    observacoes: "Coordena agenda de técnicos, controla OS, gerencia estoque de peças e interface com clientes.",
    emoji: "📋",
    destaque: true,
  },
  {
    titulo: "Assistente Administrativo",
    cbo: "4110-05",
    cbo_descricao: "Executa atividades administrativas, organiza documentos, controla arquivo e apoia gestão.",
    nivel: "operacional" as const,
    departamento: "Administrativo",
    piso_salarial: 1600,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINDESP-RJ",
    observacoes: "Suporte às áreas financeira, comercial e RH. Emissão de NF, controle de contratos e documentação.",
    emoji: "📂",
    destaque: false,
  },
  {
    titulo: "Serralheiro",
    cbo: "7215-35",
    cbo_descricao: "Fabrica e instala esquadrias metálicas, grades, portões e estruturas em aço.",
    nivel: "operacional" as const,
    departamento: "Técnica",
    piso_salarial: 1800,
    vale_transporte: true,
    vale_refeicao_valor: 22,
    sindicato_nome: "SINTIMANI-RJ",
    observacoes: "Fabricação e ajuste de frames metálicos para portas corta-fogo. Trabalho em oficina e campo.",
    emoji: "⚙️",
    destaque: false,
  },
];

function PainelRecomendacoes({ onCriar }: { onCriar: (r: (typeof RECOMENDACOES_PORTIBRAS)[0]) => void }) {
  const [aberto, setAberto] = useState(false);
  const destaques = RECOMENDACOES_PORTIBRAS.filter(r => r.destaque);
  const outros = RECOMENDACOES_PORTIBRAS.filter(r => !r.destaque);

  return (
    <div className="mb-6 rounded-xl border border-[#1a6b2f]/30 bg-[#f0f9f2] overflow-hidden">
      <button
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#e8f5ec] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a6b2f]">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a6b2f]">Recomendações de Vagas — PORTIBRAS</p>
            <p className="text-xs text-[#1a6b2f]/70">Estrutura sugerida para empresa de manutenção de portas corta-fogo · {RECOMENDACOES_PORTIBRAS.length} vagas</p>
          </div>
        </div>
        {aberto ? <ChevronUp className="h-4 w-4 text-[#1a6b2f]" /> : <ChevronDown className="h-4 w-4 text-[#1a6b2f]" />}
      </button>

      {aberto && (
        <div className="border-t border-[#1a6b2f]/20 p-5 space-y-4">
          <p className="text-xs text-gray-600">
            Com base na atividade da PORTIBRAS (manutenção e instalação de portas corta-fogo), sugerimos os cargos abaixo.
            Clique em <strong>"Criar este cargo"</strong> para abrir o formulário pré-preenchido.
          </p>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">⭐ Cargos Prioritários</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {destaques.map(r => (
                <div key={r.cbo} className="flex items-start gap-3 rounded-lg bg-white border border-[#1a6b2f]/20 p-3">
                  <span className="text-xl">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{r.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">CBO {r.cbo} · {r.departamento} · R$ {r.piso_salarial.toLocaleString("pt-BR")}/mês</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.observacoes}</p>
                  </div>
                  <button
                    onClick={() => onCriar(r)}
                    className="flex-shrink-0 flex items-center gap-1 rounded-md bg-[#1a6b2f] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#155a27] whitespace-nowrap">
                    <Plus className="h-3 w-3" />Criar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Outros cargos sugeridos</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {outros.map(r => (
                <div key={r.cbo} className="flex items-start gap-3 rounded-lg bg-white border border-gray-200 p-3">
                  <span className="text-xl">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{r.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">CBO {r.cbo} · {r.departamento} · R$ {r.piso_salarial.toLocaleString("pt-BR")}/mês</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.observacoes}</p>
                  </div>
                  <button
                    onClick={() => onCriar(r)}
                    className="flex-shrink-0 flex items-center gap-1 rounded-md border border-[#1a6b2f] px-2.5 py-1.5 text-xs font-medium text-[#1a6b2f] hover:bg-[#f0f9f2] whitespace-nowrap">
                    <Plus className="h-3 w-3" />Criar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

function BuscadorCBO({ onSelecionar }: { onSelecionar: (r: { codigo: string; titulo: string; descricao: string }) => void }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ReturnType<typeof buscarCBO>>([]);
  const [buscando, setBuscando] = useState(false);

  const buscar = () => {
    if (!query.trim()) return;
    setBuscando(true);
    setTimeout(() => {
      setResultados(buscarCBO(query));
      setBuscando(false);
    }, 300);
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Buscar Vaga pelo CBO</p>
      </div>
      <p className="text-xs text-blue-600">Digite uma descrição aproximada da vaga (ex: "técnico porta corta fogo") e clique em Buscar para encontrar a nomenclatura oficial.</p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && buscar()}
          placeholder='Ex: técnico porta corta fogo, manutenção predial...'
          className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={buscar}
          disabled={buscando || !query.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      {resultados.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          <p className="text-xs text-blue-600 font-medium">{resultados.length} resultado(s) — clique para preencher o formulário:</p>
          {resultados.map(r => (
            <button
              key={r.codigo}
              onClick={() => { onSelecionar(r); setResultados([]); setQuery(""); }}
              className="w-full text-left rounded-lg border border-blue-200 bg-white px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{r.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.descricao}</p>
                </div>
                <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-mono">{r.codigo}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {resultados.length === 0 && query && !buscando && (
        <p className="text-xs text-blue-500 italic">Nenhum resultado. Tente termos diferentes ou preencha o CBO manualmente.</p>
      )}
    </div>
  );
}

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
    if (cargo && cargo.id) {
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
          <h2 className="text-lg font-bold text-gray-900">{cargo?.id ? "Editar Cargo" : "Novo Cargo / Vaga"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{erro}</div>}

          {/* Buscador CBO */}
          <BuscadorCBO onSelecionar={r => setForm(f => ({
            ...f,
            titulo: r.titulo,
            cbo: r.codigo,
            cbo_descricao: r.descricao,
          }))} />

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

// ─── Modal de Alocação de Colaborador ────────────────────────────────────────
function ModalAlocar({
  cargo,
  alocados,
  onClose,
  onSave,
}: {
  cargo: Cargo;
  alocados: FuncionarioCargo[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; email: string; perfil: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const idsAlocados = new Set(alocados.filter(f => !f.data_fim).map(f => f.usuario_id));
  const vagasOcupadas = idsAlocados.size;
  const vagasLivres = cargo.vagas_total - vagasOcupadas;

  useEffect(() => {
    supabase.from("usuarios").select("id, nome, email, perfil").eq("ativo", true).order("nome")
      .then(({ data }) => { if (data) setUsuarios(data); setCarregando(false); });
  }, []);

  const alocar = async (userId: string) => {
    if (vagasLivres <= 0) { setErro("Todas as vagas deste cargo estão ocupadas."); return; }
    setSalvando(userId);
    setErro(null);
    const { error } = await supabase.from("funcionarios_cargos").insert({
      usuario_id: userId,
      cargo_id: cargo.id,
      data_inicio: new Date().toISOString().split("T")[0],
    });
    setSalvando(null);
    if (error) { setErro(error.message); return; }
    onSave();
  };

  const desalocar = async (userId: string) => {
    setSalvando(userId);
    setErro(null);
    const vinculo = alocados.find(f => f.usuario_id === userId && !f.data_fim);
    if (!vinculo) { setSalvando(null); return; }
    const { error } = await supabase.from("funcionarios_cargos")
      .update({ data_fim: new Date().toISOString().split("T")[0] })
      .eq("id", vinculo.id);
    setSalvando(null);
    if (error) { setErro(error.message); return; }
    onSave();
  };

  const filtrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Alocar Colaborador</h2>
            <p className="text-xs text-gray-500 mt-0.5">{cargo.titulo} · {vagasOcupadas}/{cargo.vagas_total} vagas ocupadas</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        {/* Barra de progresso vagas */}
        <div className="px-5 pt-3 pb-2">
          <div className="h-1.5 rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#1a6b2f] transition-all"
              style={{ width: `${cargo.vagas_total > 0 ? (vagasOcupadas / cargo.vagas_total) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Busca */}
        <div className="px-5 pb-2 relative">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..."
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b2f]" />
        </div>

        {erro && <div className="mx-5 mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{erro}</div>}

        {/* Lista de usuários */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">Nenhum colaborador encontrado.</p>
          ) : filtrados.map(u => {
            const alocado = idsAlocados.has(u.id);
            const ocupando = salvando === u.id;
            return (
              <div key={u.id} className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                alocado ? "border-[#1a6b2f]/40 bg-[#f0f9f2]" : "border-gray-200 bg-white"
              )}>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1a6b2f]/10 text-sm font-bold text-[#1a6b2f]">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{u.nome}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                {alocado ? (
                  <button onClick={() => desalocar(u.id)} disabled={ocupando}
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
                    {ocupando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Remover
                  </button>
                ) : (
                  <button onClick={() => alocar(u.id)} disabled={ocupando || vagasLivres <= 0}
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-[#1a6b2f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#155a27] disabled:opacity-40">
                    {ocupando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Alocar
                  </button>
                )}
              </div>
            );
          })}
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
  onAlocar,
}: {
  cargo: Cargo;
  funcionarios: FuncionarioCargo[];
  onEditar: () => void;
  onCalculadora: () => void;
  onExcluir: () => void;
  onAlocar: () => void;
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
            <button key={i} onClick={onAlocar} title="Alocar colaborador"
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-[#1a6b2f] hover:text-[#1a6b2f] hover:bg-[#f0f9f2] transition-colors">
              +
            </button>
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
  const [modalAlocar, setModalAlocar] = useState<Cargo | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<NivelCargo | "todos">("todos");

  const criarDeRecomendacao = (r: typeof RECOMENDACOES_PORTIBRAS[0]) => {
    // Cria um objeto Cargo "falso" (sem id) para pré-preencher o modal
    const preenchido = {
      id: "", titulo: r.titulo, cbo: r.cbo, cbo_descricao: r.cbo_descricao,
      nivel: r.nivel, departamento: r.departamento, vagas_total: 1,
      sindicato_nome: r.sindicato_nome, sindicato_cnpj: null,
      convencao_coletiva: null, data_validade_cct: null, clt_referencia: null,
      piso_salarial: r.piso_salarial, salario_estimado: r.piso_salarial,
      vale_transporte: r.vale_transporte, vale_refeicao_valor: r.vale_refeicao_valor,
      plano_saude: false, observacoes: r.observacoes, ultima_atualizacao_sindical: null,
      dados_sindicato_json: null, ativo: true, criado_em: "", atualizado_em: "",
    } as Cargo;
    setModalCargo(preenchido);
  };

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

      {/* ── Recomendações ── */}
      <PainelRecomendacoes onCriar={criarDeRecomendacao} />

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
                  onAlocar={() => setModalAlocar(cargo)}
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
      {modalAlocar && (
        <ModalAlocar
          cargo={modalAlocar}
          alocados={funcionarios.filter(f => f.cargo_id === modalAlocar.id)}
          onClose={() => setModalAlocar(null)}
          onSave={() => { carregar(); }}
        />
      )}
    </div>
  );
}
