import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, Plus, AlertTriangle, X, ShoppingCart,
  ExternalLink, Clock, Pencil, Trash2, AlertCircle,
  Wrench, CalendarDays as CalendarIcon, Ticket, ChevronRight, MapPin, User, HardHat, Check,
  ClipboardList, ShoppingBag, ChevronDown, ChevronUp, Loader2, BarChart2, FileCheck,
  ClipboardCheck, Upload, FileText, Phone, Mail, Building2, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Dados da PORTIBRAS ───────────────────────────────────────────────────────
const PB_RAZAO    = "PORTIBRAS SISTEMAS CONTRA INCENDIO LTDA";
const PB_CNPJ     = "63.823.452/0001-93";
const PB_TELEFONE = "(22) 99104-8162";
const PB_EMAIL    = "adm@portibras.com.br";

// ─── Carrega pdfmake do CDN (singleton) ──────────────────────────────────────
async function carregarPdfMakeLog() {
  if ((window as Record<string, unknown>).pdfMake) return;
  await new Promise<void>((resolve, reject) => {
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js";
      s2.onload = () => resolve();
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    s1.onerror = reject;
    document.head.appendChild(s1);
  });
}

// ─── Carrega logo PORTIBRAS como base64 ──────────────────────────────────────
let _pbLogoCache: string | null = null;
async function carregarLogoPortibras(): Promise<string | null> {
  if (_pbLogoCache) return _pbLogoCache;
  try {
    const r = await fetch("/logo-portibras.png");
    const blob = await r.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => { _pbLogoCache = reader.result as string; resolve(_pbLogoCache); };
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── Geração do Certificado de Garantia ──────────────────────────────────────
function gerarCertificadoPdf(pedido: {
  cliente_nome: string | null;
  cliente_empresa: string | null;
  cliente_endereco: string | null;
  tipo_servico: string | null;
  portas: number | null;
  valor_venda: number | null;
  criado_em: string;
  atualizado_em: string;
}, itensAquis: { nome: string; quantidade: number; unidade: string }[], logoB64: string | null) {
  const pm = (window as Record<string, unknown>).pdfMake as {
    createPdf: (def: unknown) => { download: (name: string) => void };
  };

  const dataEmissao  = new Date().toLocaleDateString("pt-BR");
  const dataServico  = new Date(pedido.atualizado_em).toLocaleDateString("pt-BR");
  const dataValidade = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString("pt-BR");
  })();

  const cliente      = pedido.cliente_empresa || pedido.cliente_nome || "Cliente";
  const tipoServico  = pedido.tipo_servico === "manutencao" ? "Manutenção Preventiva" : "Instalação / Substituição";
  const escopo       = pedido.tipo_servico === "manutencao" && pedido.portas
    ? `Todas as ${pedido.portas} portas corta-fogo do local`
    : pedido.tipo_servico === "manutencao"
    ? "Todas as portas corta-fogo do local"
    : itensAquis.length > 0
    ? itensAquis.map(i => `${i.nome} (${i.quantidade} ${i.unidade})`).join(", ")
    : "Conforme escopo do serviço";

  const verde  = "#1a6b2f";
  const cinza  = "#6b7280";
  const cinzaL = "#f3f4f6";

  const docDef = {
    pageSize: "A4",
    pageMargins: [50, 50, 50, 60],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#1f2937" },
    content: [
      // Cabeçalho
      {
        columns: [
          {
            stack: [
              ...(logoB64 ? [{ image: logoB64, width: 160, margin: [0, 0, 0, 4] }] : []),
              { text: PB_RAZAO, fontSize: 9, bold: true, color: verde },
              { text: `CNPJ: ${PB_CNPJ}`, fontSize: 8, color: cinza },
              { text: `${PB_TELEFONE} · ${PB_EMAIL}`, fontSize: 8, color: cinza },
            ],
          },
          {
            stack: [
              { text: "CERTIFICADO DE GARANTIA", fontSize: 14, bold: true, color: verde, alignment: "right" },
              { text: "NBR 11.742:2018", fontSize: 9, color: cinza, alignment: "right" },
            ],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: 495, y2: 8, lineWidth: 2, lineColor: verde }], margin: [0, 10, 0, 16] },

      // Bloco de identificação
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "BENEFICIÁRIO", style: "labelCell" },
              { text: "DATA DE EMISSÃO", style: "labelCell" },
            ],
            [
              { text: cliente, style: "valueCell" },
              { text: dataEmissao, style: "valueCell" },
            ],
            [
              { text: "ENDEREÇO DO LOCAL ATENDIDO", style: "labelCell", colSpan: 2 }, {},
            ],
            [
              { text: pedido.cliente_endereco || "—", style: "valueCell", colSpan: 2 }, {},
            ],
            [
              { text: "TIPO DE SERVIÇO REALIZADO", style: "labelCell" },
              { text: "DATA DA CONCLUSÃO DO SERVIÇO", style: "labelCell" },
            ],
            [
              { text: tipoServico, style: "valueCell" },
              { text: dataServico, style: "valueCell" },
            ],
            [
              { text: "ESCOPO COBERTO PELA GARANTIA", style: "labelCell", colSpan: 2 }, {},
            ],
            [
              { text: escopo, style: "valueCell", colSpan: 2 }, {},
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? cinzaL : null,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#e5e7eb",
          vLineColor: () => "#e5e7eb",
        },
        margin: [0, 0, 0, 20],
      },

      // Período de garantia — destaque
      {
        fillColor: verde,
        table: {
          widths: ["*"],
          body: [[
            {
              stack: [
                { text: "PERÍODO DE GARANTIA", fontSize: 8, bold: true, color: "#ffffff", alignment: "center", margin: [0, 0, 0, 2] },
                { text: `${dataEmissao}  →  ${dataValidade}`, fontSize: 14, bold: true, color: "#ffffff", alignment: "center" },
                { text: "6 (seis) meses a partir da data de emissão", fontSize: 8, color: "#d1fae5", alignment: "center", margin: [0, 2, 0, 0] },
              ],
              margin: [0, 10, 0, 10],
            },
          ]],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 20],
      },

      // Condições
      { text: "CONDIÇÕES DA GARANTIA", fontSize: 10, bold: true, color: verde, margin: [0, 0, 0, 6] },
      {
        ul: [
          "Esta garantia cobre defeitos de execução e materiais aplicados durante o serviço descrito acima, em conformidade com a NBR 11.742:2018.",
          "Não estão cobertos: danos causados por uso inadequado, vandalismo, sinistros, reformas realizadas por terceiros, ou falta de manutenção preventiva regular.",
          "Para acionamento da garantia, entre em contato com a PORTIBRAS pelo telefone ou e-mail informados neste certificado.",
          "A garantia é intransferível e válida exclusivamente para o endereço e escopo descritos neste documento.",

        ],
        margin: [0, 0, 0, 20],
        fontSize: 9,
        color: "#374151",
      },

      // Assinatura
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, lineColor: "#9ca3af" }], margin: [0, 20, 0, 4] },
      { text: PB_RAZAO, fontSize: 9, bold: true },
      { text: `CNPJ: ${PB_CNPJ}`, fontSize: 8, color: cinza },
      { text: "Responsável Técnico — Serviços de Proteção contra Incêndio", fontSize: 8, color: cinza },
    ],
    styles: {
      labelCell: { fontSize: 7, bold: true, color: cinza, fillColor: cinzaL, margin: [4, 3, 4, 2] },
      valueCell: { fontSize: 9, bold: false, margin: [4, 3, 4, 4] },
    },
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Documento gerado em ${dataEmissao} · NBR 11.742:2018`, fontSize: 7, color: cinza, margin: [50, 0, 0, 0] },
        { text: `Página ${page} de ${pages}`, fontSize: 7, color: cinza, alignment: "right", margin: [0, 0, 50, 0] },
      ],
    }),
  };

  const nomeArq = `Certificado_Garantia_${cliente.replace(/\s+/g, "_")}_${dataEmissao.replace(/\//g, "-")}.pdf`;
  pm.createPdf(docDef).download(nomeArq);
}

// ─── Geração do Manual de Boas Práticas ──────────────────────────────────────
function gerarManualPdf(pedido: { cliente_empresa: string | null; cliente_nome: string | null }, logoB64: string | null) {
  const pm = (window as Record<string, unknown>).pdfMake as {
    createPdf: (def: unknown) => { download: (name: string) => void };
  };

  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const cliente     = pedido.cliente_empresa || pedido.cliente_nome || "Cliente";
  const verde       = "#1a6b2f";
  const cinza       = "#6b7280";

  const secao = (titulo: string, itens: string[]) => [
    { text: titulo, fontSize: 11, bold: true, color: verde, margin: [0, 14, 0, 6] },
    ...itens.map(item => ({ text: `• ${item}`, fontSize: 9, color: "#374151", margin: [8, 2, 0, 0] })),
  ];

  const docDef = {
    pageSize: "A4",
    pageMargins: [50, 50, 50, 60],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#1f2937" },
    content: [
      // Cabeçalho
      {
        columns: [
          {
            stack: [
              ...(logoB64 ? [{ image: logoB64, width: 150, margin: [0, 0, 0, 4] }] : []),
              { text: PB_RAZAO, fontSize: 9, bold: true, color: verde },
              { text: `CNPJ: ${PB_CNPJ}`, fontSize: 8, color: cinza },
              { text: `${PB_TELEFONE} · ${PB_EMAIL}`, fontSize: 8, color: cinza },
            ],
          },
          { text: "MANUAL DE BOAS PRÁTICAS\nPortas Corta-Fogo — NBR 11.742:2018", fontSize: 11, bold: true, color: verde, alignment: "right" },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: 495, y2: 8, lineWidth: 2, lineColor: verde }], margin: [0, 10, 0, 6] },
      { text: `Destinatário: ${cliente}   ·   Emitido em: ${dataEmissao}`, fontSize: 8, color: cinza, margin: [0, 0, 0, 10] },

      { text: "Por que as portas corta-fogo são essenciais?", fontSize: 12, bold: true, color: verde, margin: [0, 4, 0, 6] },
      {
        text: "As portas corta-fogo são elementos fundamentais de segurança passiva contra incêndio. Elas compartimentam ambientes, retardam a propagação do fogo e da fumaça, garantindo rotas de fuga seguras. A NBR 11.742:2018 estabelece os requisitos mínimos de desempenho, instalação e manutenção dessas portas no Brasil.",
        fontSize: 9, color: "#374151", margin: [0, 0, 0, 4],
      },

      ...secao("1. USO CORRETO DAS PORTAS CORTA-FOGO", [
        "Nunca bloquear ou calçar a porta em posição aberta. Ela deve fechar automaticamente após cada passagem.",
        "Não utilizar a porta corta-fogo como acesso rotineiro de cargas, móveis ou equipamentos volumosos.",
        "Nunca remover, danificar ou modificar as molas, trilhos, dobradiças ou batentes sem autorização técnica.",
        "Manter o caminho de fuga nas escadas e corredores próximos à porta sempre desobstruído.",
        "Não fixar cartazes, decorações ou equipamentos diretamente na porta ou no batente.",
      ]),

      ...secao("2. INSPEÇÃO PERIÓDICA — O QUE VERIFICAR", [
        "Feche a porta manualmente e observe se ela encosta completamente no batente, sem folgas visíveis.",
        "Verifique se a mola está funcionando: a porta deve fechar sozinha a partir de qualquer ângulo de abertura.",
        "Certifique-se de que a maçaneta e a trava antipânico (quando existente) operam suavemente.",
        "Observe se há sinais de ferrugem, deformação, amassados ou trincas na folha da porta.",
        "Verifique se a sinalização de saída acima da porta está visível e funcionando.",
      ]),

      ...secao("3. CUIDADOS E MANUTENÇÃO PREVENTIVA", [
        "Lubrificar dobradiças e trilhos com produto adequado a cada 6 meses ou conforme recomendação técnica.",
        "Em caso de sinistro (incêndio, impacto ou enchente), acione a empresa de manutenção antes de continuar usando a porta.",
        "Guarde os documentos técnicos (DTS, DTE, laudos) em local acessível para inspeções do Corpo de Bombeiros.",
        "Mantenha o registro das manutenções realizadas — datas, empresa contratada e serviços executados.",
      ]),

      ...secao("4. O QUE NÃO FAZER", [
        "Não pintar a porta com tinta comum — isso pode comprometer o material intumescente e anular a certificação.",
        "Não substituir peças originais por componentes não certificados pelo INMETRO.",
        "Não permitir que crianças brinquem ou se pendurem na porta.",
        "Não instalar fechaduras adicionais que impeçam a abertura rápida em emergências.",
        "Não ignorar rangidos, dificuldade para fechar ou folgas — acione a manutenção imediatamente.",
      ]),

      ...secao("5. EM CASO DE EMERGÊNCIA", [
        "Lembre os moradores e funcionários: na presença de fumaça, mantenha a porta fechada para conter o fogo.",
        "Acione o Corpo de Bombeiros (193) e abandone o local ordenadamente pelas rotas de fuga sinalizadas.",
        "Após qualquer incêndio, mesmo que pequeno, a porta deve ser vistoriada antes de ser recolocada em uso.",
      ]),

      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 20, 0, 10] },
      {
        columns: [
          {
            stack: [
              { text: "Dúvidas? Fale com a PORTIBRAS:", fontSize: 9, bold: true, color: verde },
              { text: `${PB_TELEFONE}  ·  ${PB_EMAIL}`, fontSize: 9, color: cinza },
            ],
          },
          { text: "Este manual é informativo e complementa, sem substituir, as normas técnicas ABNT NBR 11.742:2018 e orientações do Corpo de Bombeiros local.", fontSize: 7, color: cinza, alignment: "right", width: 200 },
        ],
      },
    ],
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Manual de Boas Práticas — Portas Corta-Fogo · ${PB_RAZAO}`, fontSize: 7, color: cinza, margin: [50, 0, 0, 0] },
        { text: `Página ${page} de ${pages}`, fontSize: 7, color: cinza, alignment: "right", margin: [0, 0, 50, 0] },
      ],
    }),
  };

  pm.createPdf(docDef).download(`Manual_Boas_Praticas_PCF_${cliente.replace(/\s+/g, "_")}.pdf`);
}

export const Route = createFileRoute("/painel/logistica")({
  component: LogisticaPage,
});

// ─── Estoque ──────────────────────────────────────────────────────────────────
interface ItemEstoque {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  localizacao: string;
}

// ─── Profissionais Terceirizados ──────────────────────────────────────────────
interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  tipo_cobranca: "diaria" | "por_unidade";  // diária = × diasCampo; por_unidade = × qtd portas (ex: pintor)
  custo_diario: number;     // usado quando tipo_cobranca = "diaria"
  custo_unitario: number;   // usado quando tipo_cobranca = "por_unidade"
  ativo: boolean;
  terceirizado: boolean;    // false = Rafael Nunes (próprio, sem custo); true = profissional externo
}

// ─── Suprimentos ──────────────────────────────────────────────────────────────
interface Suprimento {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  unidade: string;
  custo_unitario: number;
  tempo_instalacao_min: number;  // minutos por unidade para instalação
  profissionais_ids: string[];   // profissionais necessários para instalar
  link_compra: string;
  atualizado_em: string;
}

const DIAS_ALERTA = 15;

function diasDesdeAtualizacao(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Ticket Técnico ───────────────────────────────────────────────────────────
interface TicketTecnico {
  id: string;
  titulo: string;
  cliente: string;
  endereco: string;
  tecnico: string;
  status: string;
  prioridade: string;
  agendado_para: string;
  criado_em: string;
}

const SISTEMAS_EXTERNOS = [
  {
    nome: "Aplicativo de Serviços",
    descricao: "Gestão de ordens de serviço em campo",
    url: "https://www.appsheet.com/start/1fd097c9-0986-4133-bdc5-e381bcd4bf37",
    cor: "bg-blue-50 border-blue-200 text-blue-700",
    icone: Wrench,
  },
  {
    nome: "Aplicativo de Vistorias",
    descricao: "Laudos e vistorias técnicas",
    url: "https://www.appsheet.com/start/755184c3-0072-4536-9f99-420a62a919c5",
    cor: "bg-purple-50 border-purple-200 text-purple-700",
    icone: CalendarIcon,
  },
];

const STATUS_CORES: Record<string, string> = {
  aberto:       "bg-blue-100 text-blue-700",
  em_andamento: "bg-yellow-100 text-yellow-700",
  aguardando:   "bg-orange-100 text-orange-700",
  concluido:    "bg-green-100 text-green-700",
  cancelado:    "bg-gray-100 text-gray-500",
};

const PRIORIDADE_CORES: Record<string, string> = {
  baixa:  "bg-gray-100 text-gray-500",
  normal: "bg-blue-100 text-blue-600",
  alta:   "bg-orange-100 text-orange-700",
  urgente:"bg-red-100 text-red-700",
};

// ─── Pedidos Logísticos (vindos do CRM) ───────────────────────────────────────
type EtapaLogistica  = "tratamento" | "aguard_material" | "aguard_cobranca" | "em_execucao" | "concluido" | "cancelado";
type TipoCobranca    = "antes" | "apos" | "sem_cobranca";
type StatusCobranca  = "aguardando" | "cobrado_parcial" | "cobrado_total";

interface PedidoLogistico {
  id: string;
  crm_lead_id: string | null;
  cliente_nome: string | null;
  cliente_empresa: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_endereco: string | null;
  tipo_servico: string | null;
  valor_venda: number | null;
  custo_estimado: number | null;
  margem_pct: number | null;
  observacoes_crm: string | null;
  portas: number | null;
  parcela_mensal: number | null;
  etapa: EtapaLogistica;
  tipo_cobranca: TipoCobranca;
  cobrado: boolean;
  cobrado_em: string | null;
  status_cobranca: StatusCobranca | null;
  responsavel: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  is_ticket: boolean | null;
  ticket_motivo: string | null;
  ticket_prioridade: string | null;
  ticket_contato_nome: string | null;
  ticket_contato_tel: string | null;
  ticket_sla_at: string | null;
  classificacao_op: "fornecimento" | "instalacao" | null;
}

interface ItemAquisicao {
  id: string;
  pedido_id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number | null;
  fornecedor: string | null;
  link_compra: string | null;
  status: "pendente" | "pedido" | "recebido";
  observacoes: string | null;
  criado_em: string;
}

// ─── Tarefa de Pedido ─────────────────────────────────────────────────────────
interface TarefaPedido {
  id: string;
  pedido_id: string;
  descricao: string;
  concluida: boolean;
  ordem: number;
  criado_em: string;
  concluida_em: string | null;
}

interface CheckAba {
  id: string;
  pedido_id: string;
  aba: "info" | "aquisicao" | "tarefas";
  checked: boolean;
  checked_em: string;
  checked_por: string | null;
}

// ─── Pedidos Fechados (legado — mantido para compatibilidade) ─────────────────
interface PedidoFechado {
  id: string;
  lead_id: string;
  tipo: "orcamento" | "manutencao";
  nome_arquivo: string;
  status: string;
  conteudo: { portas?: number; parcela?: number } | null;
  criado_em: string;
  atualizado_em: string | null;
  enviado_logistica: boolean;
  lead?: { nome: string; empresa: string };
}

// ─── Atendimentos ─────────────────────────────────────────────────────────────
interface Atendimento {
  id: string;
  cliente_id: string | null;
  proposta_id: string | null;
  titulo: string;
  classificacao: "Serviço" | "Vistoria" | "Retorno" | "Operacional" | "Terceirizados";
  status: "Programado" | "Em andamento" | "Concluído" | "Cancelado";
  data_agendada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  responsaveis: string[];
  endereco: string | null;
  atividade: string | null;
  descricao: string | null;
  agendado_com_cliente: boolean;
  em_sistema: boolean;
  relatorio_campo: string | null;
  criado_em: string;
  atualizado_em: string;
  // Contato do cliente para emails
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_email_cc: string | null;
}

interface Material {
  id: string;
  atendimento_id: string;
  descricao: string;
  codigo: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  fornecedor: string | null;
  link_compra: string | null;
  status: "Solicitado" | "Comprado" | "Chegou no escritório" | "Enviado ao campo" | "Instalado";
  data_solicitacao: string | null;
  data_compra: string | null;
  data_chegada: string | null;
  data_envio: string | null;
  observacoes: string | null;
}

interface Vistoria {
  id: string;
  lead_id: string | null;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  status: "pendente" | "agendada" | "em_andamento" | "concluida" | "cancelada";
  data_agendada: string | null;
  tecnico_nome: string | null;
  observacoes: string | null;
  dts_url: string | null;
  dts_nome: string | null;
  dts_resumo_ia: string | null;
  dts_materiais: any | null;
  enviado_por: string | null;
  enviado_em: string;
  concluida_em: string | null;
  criado_em: string;
}

const STATUS_VISTORIA_COR: Record<string, string> = {
  "pendente":      "bg-orange-50 text-orange-700 border-orange-200",
  "agendada":      "bg-blue-50 text-blue-700 border-blue-200",
  "em_andamento":  "bg-yellow-50 text-yellow-700 border-yellow-200",
  "concluida":     "bg-green-50 text-green-700 border-green-200",
  "cancelada":     "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_VISTORIA_LABEL: Record<string, string> = {
  "pendente":     "Pendente",
  "agendada":     "Agendada",
  "em_andamento": "Em andamento",
  "concluida":    "Concluída",
  "cancelada":    "Cancelada",
};

const STATUS_ATEND_COR: Record<string, string> = {
  "Programado":   "bg-blue-50 text-blue-700 border-blue-200",
  "Em andamento": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Concluído":    "bg-green-50 text-green-700 border-green-200",
  "Cancelado":    "bg-gray-100 text-gray-500 border-gray-200",
};

const CLASS_COR: Record<string, string> = {
  "Serviço":       "bg-emerald-50 text-emerald-700",
  "Vistoria":      "bg-purple-50 text-purple-700",
  "Retorno":       "bg-sky-50 text-sky-700",
  "Operacional":   "bg-orange-50 text-orange-700",
  "Terceirizados": "bg-pink-50 text-pink-700",
};

const STATUS_MAT_COR: Record<string, string> = {
  "Solicitado":           "bg-gray-100 text-gray-500",
  "Comprado":             "bg-blue-50 text-blue-700",
  "Chegou no escritório": "bg-yellow-50 text-yellow-700",
  "Enviado ao campo":     "bg-purple-50 text-purple-700",
  "Instalado":            "bg-green-50 text-green-700",
};

const RESPONSAVEIS_OPCOES = ["Rafael Nunes", "Matheus Alves", "Dinho", "Marco", "Ajudante"];

const EMPTY_ATEND = {
  titulo: "", classificacao: "Serviço" as const, status: "Programado" as const,
  data_agendada: "", hora_inicio: "", hora_fim: "",
  responsaveis: [] as string[], endereco: "", atividade: "", descricao: "",
  agendado_com_cliente: false, em_sistema: false,
  cliente_email: "", cliente_nome: "", cliente_email_cc: "",
};

const EMPTY_MAT = {
  descricao: "", codigo: "", quantidade: 1, unidade: "un",
  valor_unitario: null as number | null, fornecedor: "", link_compra: "",
  status: "Solicitado" as const, observacoes: "",
};

// ─── Cores por responsável ────────────────────────────────────────────────────
const RESP_CORES: Record<string, { bg: string; text: string; border: string }> = {
  "Rafael Nunes": { bg: "bg-blue-100",    text: "text-blue-800",   border: "border-blue-300" },
  "Matheus Alves":{ bg: "bg-purple-100",  text: "text-purple-800", border: "border-purple-300" },
  "Dinho":        { bg: "bg-orange-100",  text: "text-orange-800", border: "border-orange-300" },
  "Marco":        { bg: "bg-pink-100",    text: "text-pink-800",   border: "border-pink-300" },
  "Ajudante":     { bg: "bg-gray-100",    text: "text-gray-700",   border: "border-gray-300" },
};
const RESP_COR_DEFAULT = { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" };

function corParaResp(r: string) {
  return RESP_CORES[r] ?? RESP_COR_DEFAULT;
}

function GanttView({ atendimentos, carregando }: { atendimentos: Atendimento[]; carregando: boolean }) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Calcular janela de 6 semanas a partir de segunda-feira da semana atual
  const inicioJanela = useMemo(() => {
    const d = new Date(hoje);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=seg
    d.setDate(d.getDate() - dow);
    return d;
  }, []);

  const SEMANAS = 6;
  const DIAS_TOTAL = SEMANAS * 7;

  const diasJanela = useMemo(() => {
    return Array.from({ length: DIAS_TOTAL }, (_, i) => {
      const d = new Date(inicioJanela);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [inicioJanela]);

  // Semanas agrupadas
  const semanas = useMemo(() => {
    const result = [];
    for (let s = 0; s < SEMANAS; s++) {
      const inicio = new Date(inicioJanela);
      inicio.setDate(inicio.getDate() + s * 7);
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicio);
        d.setDate(d.getDate() + i);
        return d;
      });
      result.push({ inicio, dias });
    }
    return result;
  }, [inicioJanela]);

  // Atendimentos com data na janela
  const atendComData = useMemo(() => {
    return atendimentos
      .filter(a => a.data_agendada && a.status !== "Cancelado")
      .map(a => {
        const d = new Date(a.data_agendada! + "T00:00:00");
        return { ...a, dataObj: d };
      })
      .filter(a => {
        const fim = new Date(inicioJanela);
        fim.setDate(fim.getDate() + DIAS_TOTAL);
        return a.dataObj >= inicioJanela && a.dataObj < fim;
      })
      .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime());
  }, [atendimentos, inicioJanela]);

  // Atendimentos sem data
  const semData = atendimentos.filter(a => !a.data_agendada && a.status !== "Cancelado");

  const nomesDia = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  function idxDia(data: Date): number {
    const ms = data.getTime() - inicioJanela.getTime();
    return Math.floor(ms / 86400000);
  }

  function ehHoje(d: Date) {
    return d.toDateString() === hoje.toDateString();
  }

  function ehFds(d: Date) {
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando atendimentos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legenda responsáveis */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Responsáveis:</span>
        {Object.entries(RESP_CORES).map(([nome, cor]) => (
          <span key={nome} className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border", cor.bg, cor.text, cor.border)}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60 inline-block" />
            {nome}
          </span>
        ))}
      </div>

      {/* Grade Gantt */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header semanas + dias */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${DIAS_TOTAL * 44 + 160}px` }}>
            {/* Linha de semanas */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="w-40 shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Atendimento
              </div>
              {semanas.map((s, i) => (
                <div key={i} className="flex border-r border-gray-200 last:border-r-0"
                  style={{ width: `${7 * 44}px` }}>
                  <div className="w-full px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Sem. {s.inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
            {/* Linha de dias */}
            <div className="flex border-b border-gray-200 bg-gray-50/60">
              <div className="w-40 shrink-0 border-r border-gray-200" />
              {diasJanela.map((d, i) => (
                <div key={i}
                  style={{ width: "44px" }}
                  className={cn(
                    "shrink-0 border-r border-gray-100 last:border-r-0 text-center py-1",
                    ehHoje(d) ? "bg-[#1a6b2f]/10" : "",
                    ehFds(d) ? "bg-gray-100/60" : "",
                  )}>
                  <div className={cn("text-[9px] font-medium", ehHoje(d) ? "text-[#1a6b2f] font-bold" : "text-gray-400")}>
                    {nomesDia[(d.getDay() + 6) % 7]}
                  </div>
                  <div className={cn("text-[10px] font-semibold leading-none", ehHoje(d) ? "text-[#1a6b2f]" : "text-gray-600")}>
                    {d.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Linhas de atendimentos */}
            {atendComData.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Nenhum atendimento agendado nas próximas 6 semanas
              </div>
            ) : (
              atendComData.map(a => {
                const idx = idxDia(a.dataObj);
                const primResp = a.responsaveis?.[0] ?? "";
                const cor = corParaResp(primResp);
                return (
                  <div key={a.id} className="flex items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40">
                    {/* Label */}
                    <div className="w-40 shrink-0 border-r border-gray-200 px-3 py-2">
                      <p className="text-xs font-medium text-gray-800 truncate leading-tight">{a.titulo}</p>
                      {a.responsaveis?.length > 0 && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{a.responsaveis.join(", ")}</p>
                      )}
                    </div>
                    {/* Grade */}
                    <div className="relative flex flex-1" style={{ height: "44px" }}>
                      {diasJanela.map((d, di) => (
                        <div key={di}
                          style={{ width: "44px" }}
                          className={cn(
                            "shrink-0 border-r border-gray-100 last:border-r-0 h-full",
                            ehHoje(d) ? "bg-[#1a6b2f]/5" : "",
                            ehFds(d) ? "bg-gray-50" : "",
                          )}
                        />
                      ))}
                      {/* Barra do atendimento */}
                      {idx >= 0 && idx < DIAS_TOTAL && (
                        <div
                          className={cn(
                            "absolute top-2.5 rounded-lg px-2 flex items-center gap-1 border text-[10px] font-semibold truncate",
                            cor.bg, cor.text, cor.border,
                          )}
                          style={{
                            left: `${idx * 44 + 2}px`,
                            width: "40px",
                            height: "22px",
                          }}
                          title={`${a.titulo} — ${a.data_agendada}`}
                        >
                          <span className={cn(
                            "rounded-full px-1 py-0 text-[9px] font-bold shrink-0",
                            a.status === "Concluído" ? "bg-green-200 text-green-800" :
                            a.status === "Em andamento" ? "bg-yellow-200 text-yellow-800" :
                            "bg-white/60 text-gray-600"
                          )}>
                            {a.status === "Concluído" ? "✓" : a.status === "Em andamento" ? "▶" : "○"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Atendimentos sem data */}
      {semData.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            Sem data agendada ({semData.length})
          </h3>
          <div className="space-y-2">
            {semData.map(a => {
              const primResp = a.responsaveis?.[0] ?? "";
              const cor = corParaResp(primResp);
              return (
                <div key={a.id} className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  cor.bg, cor.border
                )}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.titulo}</p>
                    {a.responsaveis?.length > 0 && (
                      <p className="text-xs opacity-70">{a.responsaveis.join(", ")}</p>
                    )}
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0",
                    STATUS_ATEND_COR[a.status]
                  )}>
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo por responsável */}
      {atendimentos.filter(a => a.status !== "Cancelado").length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Carga por responsável</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(RESP_CORES).map(resp => {
              const total = atendimentos.filter(
                a => a.responsaveis?.includes(resp) && a.status !== "Cancelado"
              );
              if (total.length === 0) return null;
              const concluidos = total.filter(a => a.status === "Concluído").length;
              const cor = corParaResp(resp);
              return (
                <div key={resp} className={cn("rounded-xl border p-4", cor.bg, cor.border)}>
                  <p className={cn("text-sm font-semibold", cor.text)}>{resp}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{total.length}</p>
                  <p className="text-xs text-gray-500">{concluidos} concluído{concluidos !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LogisticaPage() {
  const [aba, setAba] = useState<"estoque" | "suprimentos" | "equipe" | "tecnico" | "atendimentos" | "compras" | "gantt" | "pedidos">("pedidos");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function verificarPerfil() {
      const ADMIN_UID = "b90953f7-2f32-46b2-b1fe-6be7572fc9c7";
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsAdmin(session.user.id === ADMIN_UID);
    }
    verificarPerfil();
  }, []);

  // ── Pedidos Logísticos ─────────────────────────────────────────────────────
  const [pedidosLog, setPedidosLog] = useState<PedidoLogistico[]>([]);
  const [carregandoPedLog, setCarregandoPedLog] = useState(false);
  const [viewPedidos, setViewPedidos] = useState<"kanban" | "lista">("kanban");
  // progresso por pedido: { aquisicao: bool, tarefas: bool }
  const [progressoCards, setProgressoCards] = useState<Record<string, { info: boolean; aquisicao: boolean; tarefas: boolean }>>({});
  const [pedidoAberto, setPedidoAberto] = useState<PedidoLogistico | null>(null);
  const [abaPedido, setAbaPedido] = useState<"info" | "aquisicao" | "tarefas">("info");
  const [aquisicoes, setAquisicoes] = useState<ItemAquisicao[]>([]);
  const [carregandoAquis, setCarregandoAquis] = useState(false);
  const [formAquis, setFormAquis] = useState({ nome: "", quantidade: "1", unidade: "un", custo_unitario: "", fornecedor: "", link_compra: "", observacoes: "" });
  const [buscaSupAquis, setBuscaSupAquis] = useState("");
  const [supAquisAberto, setSupAquisAberto] = useState(false);
  const [supSelecionado, setSupSelecionado] = useState<Suprimento | null>(null);
  const [salvandoAquis, setSalvandoAquis] = useState(false);
  const [atualizandoEtapa, setAtualizandoEtapa] = useState<string | null>(null);
  const [emitindoCert, setEmitindoCert] = useState(false);

  // ── Tarefas do pedido ───────────────────────────────────────────────────────
  const [tarefas, setTarefas] = useState<TarefaPedido[]>([]);
  const [carregandoTarefas, setCarregandoTarefas] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [checksAbas, setChecksAbas] = useState<CheckAba[]>([]);
  const [salvandoCheck, setSalvandoCheck] = useState<"info" | "aquisicao" | "tarefas" | null>(null);

  // ── Estoque ────────────────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(true);
  const [modalEstoque, setModalEstoque] = useState(false);
  const [selEstoque, setSelEstoque] = useState<ItemEstoque | null>(null);
  const [formEstoque, setFormEstoque] = useState<Partial<ItemEstoque>>({
    nome: "", codigo: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, unidade: "un", localizacao: "",
  });

  // ── Pedidos Fechados ───────────────────────────────────────────────────────
  const [pedidosFechados, setPedidosFechados] = useState<PedidoFechado[]>([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [excluindoPedidoFechado, setExcluindoPedidoFechado] = useState<PedidoFechado | null>(null);
  const [processandoExclusaoPF, setProcessandoExclusaoPF] = useState(false);

  // ── Atendimentos ──────────────────────────────────────────────────────────
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregandoAtend, setCarregandoAtend] = useState(false);
  const [modalAtend, setModalAtend] = useState(false);
  const [selAtend, setSelAtend] = useState<Atendimento | null>(null);
  const [formAtend, setFormAtend] = useState<typeof EMPTY_ATEND>({ ...EMPTY_ATEND });
  const [salvandoAtend, setSalvandoAtend] = useState(false);
  const [filtroStatusAtend, setFiltroStatusAtend] = useState<string>("todos");
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [atendAberto, setAtendAberto] = useState<string | null>(null);
  const [subAbaAtend, setSubAbaAtend] = useState<"lista" | "calendario">("lista");
  const [calMes, setCalMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; });
  const [ticketsAbertos, setTicketsAbertos] = useState<PedidoLogistico[]>([]);
  const [calEventoPopup, setCalEventoPopup] = useState<Atendimento | null>(null);
  const [modalFeedUrl, setModalFeedUrl] = useState(false);
  const FEED_URL = "https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/ical-feed";
  // Modais de status com email
  const [modalConcluir, setModalConcluir] = useState<Atendimento | null>(null);
  const [modalCancelar, setModalCancelar] = useState<Atendimento | null>(null);
  const [processandoStatusAtend, setProcessandoStatusAtend] = useState(false);

  // ── Vistorias ─────────────────────────────────────────────────────────────
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [carregandoVistorias, setCarregandoVistorias] = useState(false);
  const [vistoriaAberta, setVistoriaAberta] = useState<string | null>(null);
  const [agendandoId, setAgendandoId] = useState<string | null>(null);
  const [dataAgendada, setDataAgendada] = useState("");
  const [tecnicoNome, setTecnicoNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [uploadingDts, setUploadingDts] = useState<string | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [filtroVistoria, setFiltroVistoria] = useState<string>("ativas");

  // ── Materiais legado (mantido para compatibilidade) ───────────────────────
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [carregandoMat, setCarregandoMat] = useState(false);
  const [modalMat, setModalMat] = useState<{ aberto: boolean; atendimentoId: string | null }>({ aberto: false, atendimentoId: null });
  const [formMat, setFormMat] = useState<typeof EMPTY_MAT>({ ...EMPTY_MAT });
  const [salvandoMat, setSalvandoMat] = useState(false);
  const [atendFiltroCompras, setAtendFiltroCompras] = useState<string | null>(null);

  // ── Materiais a Comprar ───────────────────────────────────────────────────
  type MatComprar = {
    id: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    fornecedor: string | null;
    urgencia: "baixa" | "normal" | "urgente";
    status: "Pendente" | "Comprado" | "Recebido";
    observacoes: string | null;
    criado_em: string;
    atualizado_em: string;
    custo_unitario?: number | null;
    vinculados?: { id: string; titulo: string; classificacao: string }[];
    // itens vindos de aquisições de pedidos
    _origem?: "pedido";
    _pedido_nome?: string;
    _pedido_id?: string;
  };
  const URGENCIA_COR: Record<string, string> = {
    "baixa":   "bg-gray-100 text-gray-500",
    "normal":  "bg-blue-100 text-blue-700",
    "urgente": "bg-red-100 text-red-700",
  };
  const STATUS_MATC_COR: Record<string, string> = {
    "Pendente":  "bg-orange-100 text-orange-700",
    "Comprado":  "bg-blue-100 text-blue-700",
    "Recebido":  "bg-green-100 text-green-700",
  };
  const EMPTY_MATC = {
    descricao: "", quantidade: "1", unidade: "un",
    fornecedor: "", urgencia: "normal" as MatComprar["urgencia"],
    status: "Pendente" as MatComprar["status"],
    observacoes: "", atendSel: [] as string[],
  };
  const [matComprar, setMatComprar] = useState<MatComprar[]>([]);
  const [carregandoMatC, setCarregandoMatC] = useState(false);
  const [modalMatC, setModalMatC] = useState(false);
  const [matCEditando, setMatCEditando] = useState<string | null>(null);
  const [formMatC, setFormMatC] = useState({ ...EMPTY_MATC });
  const [salvandoMatC, setSalvandoMatC] = useState(false);
  const [subAbaCompras, setSubAbaCompras] = useState<"pedidos" | "materiais">("pedidos");

  async function carregarMatComprar() {
    setCarregandoMatC(true);

    // ── 1. Materiais cadastrados manualmente ──────────────────────────────────
    const { data } = await supabase
      .from("logistica_materiais_comprar")
      .select("*")
      .order("criado_em", { ascending: false });

    const ids = (data ?? []).map((m: MatComprar) => m.id);
    const { data: vinculos } = ids.length
      ? await supabase.from("logistica_materiais_comprar_atendimentos").select("material_id, atendimento_id").in("material_id", ids)
      : { data: [] };
    const mapaV: Record<string, string[]> = {};
    for (const v of (vinculos ?? [])) {
      if (!mapaV[v.material_id]) mapaV[v.material_id] = [];
      mapaV[v.material_id].push(v.atendimento_id);
    }
    const manuais: MatComprar[] = (data ?? []).map((m: MatComprar) => {
      // custo_unitario: da tabela (se existir) ou fallback do catálogo de suprimentos pelo nome
      const custoFallback = m.custo_unitario != null
        ? m.custo_unitario
        : (suprimentos.find(s => s.nome.toLowerCase() === m.descricao.toLowerCase())?.custo_unitario ?? null);
      return {
        ...m,
        custo_unitario: custoFallback,
        vinculados: (mapaV[m.id] ?? [])
          .map(aid => atendimentos.find(a => a.id === aid))
          .filter(Boolean)
          .map(a => ({ id: a!.id, titulo: a!.titulo, classificacao: a!.classificacao })),
      };
    });

    // ── 2. Itens de aquisição dos pedidos (pendente ou pedido) ────────────────
    const { data: aquisData } = await supabase
      .from("logistica_aquisicoes")
      .select("id, pedido_id, nome, quantidade, unidade, fornecedor, custo_unitario, status, criado_em")
      .in("status", ["pendente", "pedido"]);

    // Mapear status de aquisição → status de MatComprar
    const statusAquis: Record<string, MatComprar["status"]> = {
      pendente: "Pendente",
      pedido:   "Comprado",
      recebido: "Recebido",
    };

    // Buscar nomes dos pedidos relacionados
    const pedidoIds = [...new Set((aquisData ?? []).map((a: { pedido_id: string }) => a.pedido_id))];
    const mapaPedido: Record<string, string> = {};
    if (pedidoIds.length) {
      const { data: pedData } = await supabase
        .from("logistica_pedidos")
        .select("id, cliente_nome, cliente_empresa")
        .in("id", pedidoIds);
      for (const p of (pedData ?? [])) {
        mapaPedido[p.id] = p.cliente_empresa || p.cliente_nome || "Pedido";
      }
    }

    const dePedidos: MatComprar[] = (aquisData ?? []).map((a: {
      id: string; pedido_id: string; nome: string; quantidade: number;
      unidade: string; fornecedor: string | null; custo_unitario: number | null; status: string; criado_em: string;
    }) => {
      // Fallback: buscar custo no catálogo de suprimentos pelo nome
      const custoFallback = suprimentos.find(s => s.nome.toLowerCase() === a.nome.toLowerCase())?.custo_unitario ?? null;
      return {
        id: a.id,
        descricao: a.nome,
        quantidade: a.quantidade,
        unidade: a.unidade || "un",
        fornecedor: a.fornecedor,
        custo_unitario: a.custo_unitario ?? custoFallback,
        urgencia: "normal" as const,
        status: statusAquis[a.status] ?? "Pendente",
        observacoes: null,
        criado_em: a.criado_em,
        atualizado_em: a.criado_em,
        vinculados: [],
        _origem: "pedido" as const,
        _pedido_nome: mapaPedido[a.pedido_id] ?? "Pedido",
        _pedido_id: a.pedido_id,
      };
    });

    setMatComprar([...manuais, ...dePedidos]);
    setCarregandoMatC(false);
  }

  async function salvarMatComprar() {
    if (!formMatC.descricao.trim()) return;
    setSalvandoMatC(true);
    const payload = {
      descricao: formMatC.descricao.trim(),
      quantidade: Number(formMatC.quantidade) || 1,
      unidade: formMatC.unidade || "un",
      fornecedor: formMatC.fornecedor || null,
      urgencia: formMatC.urgencia,
      status: formMatC.status,
      observacoes: formMatC.observacoes || null,
    };
    let matId = matCEditando;
    if (matCEditando) {
      await supabase.from("logistica_materiais_comprar").update(payload).eq("id", matCEditando);
      await supabase.from("logistica_materiais_comprar_atendimentos").delete().eq("material_id", matCEditando);
    } else {
      const { data } = await supabase.from("logistica_materiais_comprar").insert(payload).select().single();
      matId = data?.id ?? null;
    }
    if (matId && formMatC.atendSel.length) {
      await supabase.from("logistica_materiais_comprar_atendimentos").insert(
        formMatC.atendSel.map(aid => ({ material_id: matId, atendimento_id: aid }))
      );
    }
    setSalvandoMatC(false);
    setModalMatC(false);
    setMatCEditando(null);
    setFormMatC({ ...EMPTY_MATC });
    carregarMatComprar();
  }

  async function excluirMatComprar(id: string) {
    if (!confirm("Excluir este material?")) return;
    await supabase.from("logistica_materiais_comprar").delete().eq("id", id);
    carregarMatComprar();
  }

  async function avancarStatusMatC(m: MatComprar) {
    const proximo: Record<MatComprar["status"], MatComprar["status"]> = {
      "Pendente": "Comprado",
      "Comprado": "Recebido",
      "Recebido": "Recebido",
    };
    const novo = proximo[m.status];
    if (novo === m.status) return;

    if (m._origem === "pedido") {
      // Atualiza logistica_aquisicoes (mapeamento inverso de status)
      const statusInv: Record<MatComprar["status"], string> = {
        "Pendente": "pendente",
        "Comprado": "pedido",
        "Recebido": "recebido",
      };
      await supabase.from("logistica_aquisicoes").update({ status: statusInv[novo] }).eq("id", m.id);
    } else {
      await supabase.from("logistica_materiais_comprar").update({ status: novo }).eq("id", m.id);
    }
    setMatComprar(ms => ms.map(x => x.id === m.id ? { ...x, status: novo } : x));
  }

  function abrirNovaMatC() {
    setMatCEditando(null);
    setFormMatC({ ...EMPTY_MATC });
    setModalMatC(true);
  }

  function abrirEditarMatC(m: MatComprar) {
    setMatCEditando(m.id);
    setFormMatC({
      descricao: m.descricao,
      quantidade: m.quantidade.toString(),
      unidade: m.unidade,
      fornecedor: m.fornecedor ?? "",
      urgencia: m.urgencia,
      status: m.status,
      observacoes: m.observacoes ?? "",
      atendSel: m.vinculados?.map(v => v.id) ?? [],
    });
    setModalMatC(true);
  }

  // ── Compras consolidadas (novo modelo) ────────────────────────────────────
  type Compra = {
    id: string;
    titulo: string;
    fornecedor: string | null;
    materiais: string | null;
    custo: number | null;
    status_entrega: "Não iniciada" | "Em andamento" | "Concluído";
    finalizado: boolean;
    previsao_chegada: string | null;
    data_recebido: string | null;
    quem_recebeu: string | null;
    observacoes: string | null;
    criado_em: string;
    pedidos?: { id: string; titulo: string; classificacao: string }[];
  };
  const FORNECEDORES_PADRAO = ["G Sardou", "Disafe", "GUBLER", "DW15", "Original Portas"];
  const [fornecedoresLista, setFornecedoresLista] = useState<string[]>(FORNECEDORES_PADRAO);
  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "logistica_fornecedores")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.valor) {
          try { setFornecedoresLista(JSON.parse(data.valor)); } catch { /* mantém padrão */ }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const FORNECEDORES = fornecedoresLista;
  const STATUS_COMPRA_COR: Record<string, string> = {
    "Não iniciada": "bg-gray-100 text-gray-600",
    "Em andamento": "bg-blue-100 text-blue-700",
    "Concluído":    "bg-green-100 text-green-700",
  };
  const EMPTY_COMPRA = {
    titulo: "", fornecedoresSel: [] as string[], materiais: "", custo: "",
    status_entrega: "Não iniciada" as Compra["status_entrega"],
    previsao_chegada: "", data_recebido: "", quem_recebeu: "",
    observacoes: "", pedidosSel: [] as string[],
  };
  const [compras, setCompras] = useState<Compra[]>([]);
  const [carregandoCompras, setCarregandoCompras] = useState(false);
  const [modalCompra, setModalCompra] = useState(false);
  const [compraEditando, setCompraEditando] = useState<string | null>(null);
  const [formCompra, setFormCompra] = useState({ ...EMPTY_COMPRA });
  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [compraAberta, setCompraAberta] = useState<string | null>(null);

  async function carregarCompras() {
    setCarregandoCompras(true);
    const { data } = await supabase
      .from("logistica_compras")
      .select("*")
      .order("criado_em", { ascending: false });
    if (!data) { setCarregandoCompras(false); return; }
    // Buscar vínculos
    const ids = data.map((c: Compra) => c.id);
    const { data: vinculos } = ids.length
      ? await supabase.from("logistica_compras_atendimentos").select("compra_id, pedido_id").in("compra_id", ids)
      : { data: [] };
    // Montar mapa
    const mapaVinculos: Record<string, string[]> = {};
    for (const v of (vinculos ?? [])) {
      if (!mapaVinculos[v.compra_id]) mapaVinculos[v.compra_id] = [];
      mapaVinculos[v.compra_id].push(v.pedido_id);
    }
    // Enriquecer com atendimentos
    const comprasEnriquecidas = data.map((c: Compra) => ({
      ...c,
      pedidos: (mapaVinculos[c.id] ?? [])
        .map(pid => atendimentos.find(a => a.id === pid))
        .filter(Boolean)
        .map(a => ({ id: a!.id, titulo: a!.titulo, classificacao: a!.classificacao })),
    }));
    setCompras(comprasEnriquecidas);
    setCarregandoCompras(false);
  }

  async function salvarCompra() {
    if (!formCompra.titulo.trim()) return;
    setSalvandoCompra(true);
    const payload = {
      titulo: formCompra.titulo.trim(),
      fornecedor: formCompra.fornecedoresSel.length ? formCompra.fornecedoresSel.join(", ") : null,
      materiais: formCompra.materiais || null,
      custo: formCompra.custo ? Number(formCompra.custo) : null,
      status_entrega: formCompra.status_entrega,
      previsao_chegada: formCompra.previsao_chegada || null,
      data_recebido: formCompra.data_recebido || null,
      quem_recebeu: formCompra.quem_recebeu || null,
      observacoes: formCompra.observacoes || null,
    };
    let compraId = compraEditando;
    if (compraEditando) {
      await supabase.from("logistica_compras").update(payload).eq("id", compraEditando);
      // Remover vínculos antigos
      await supabase.from("logistica_compras_atendimentos").delete().eq("compra_id", compraEditando);
    } else {
      const { data } = await supabase.from("logistica_compras").insert(payload).select().single();
      compraId = data?.id ?? null;
    }
    // Inserir novos vínculos
    if (compraId && formCompra.pedidosSel.length) {
      await supabase.from("logistica_compras_atendimentos").insert(
        formCompra.pedidosSel.map(pid => ({ compra_id: compraId, pedido_id: pid }))
      );
    }
    setSalvandoCompra(false);
    setModalCompra(false);
    setCompraEditando(null);
    setFormCompra({ ...EMPTY_COMPRA });
    carregarCompras();
  }

  async function excluirCompra(id: string) {
    if (!confirm("Excluir esta compra?")) return;
    await supabase.from("logistica_compras").delete().eq("id", id);
    carregarCompras();
  }

  async function toggleFinalizadoCompra(id: string, atual: boolean) {
    await supabase.from("logistica_compras").update({ finalizado: !atual }).eq("id", id);
    setCompras(cs => cs.map(c => c.id === id ? { ...c, finalizado: !atual } : c));
  }

  function abrirNovaCompra() {
    setCompraEditando(null);
    setFormCompra({ ...EMPTY_COMPRA });
    setModalCompra(true);
  }

  function abrirEditarCompra(c: Compra) {
    setCompraEditando(c.id);
    setFormCompra({
      titulo: c.titulo,
      fornecedoresSel: c.fornecedor ? c.fornecedor.split(", ").map(s => s.trim()) : [],
      materiais: c.materiais ?? "",
      custo: c.custo?.toString() ?? "",
      status_entrega: c.status_entrega,
      previsao_chegada: c.previsao_chegada ?? "",
      data_recebido: c.data_recebido ?? "",
      quem_recebeu: c.quem_recebeu ?? "",
      observacoes: c.observacoes ?? "",
      pedidosSel: c.pedidos?.map(p => p.id) ?? [],
    });
    setModalCompra(true);
  }

  useEffect(() => {
    if (aba === "pedidos") carregarPedidosLog();
    if (aba === "atendimentos") { carregarAtendimentos(); carregarPedidosFechados(); }
    if (aba === "gantt") carregarAtendimentos();
    if (aba === "compras") { carregarAtendimentos().then(() => { carregarCompras(); carregarMatComprar(); }); }
    if (aba === "estoque") carregarEstoque();
    if (aba === "vistorias") carregarVistorias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  // Listen for ticket created from sidebar
  useEffect(() => {
    const handler = () => { if (aba === "pedidos") carregarPedidosLog(); else setAba("pedidos"); };
    window.addEventListener("portibras:ticket-criado", handler);
    return () => window.removeEventListener("portibras:ticket-criado", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  async function carregarVistorias() {
    setCarregandoVistorias(true);
    const { data } = await supabase
      .from("vistorias")
      .select("*")
      .order("criado_em", { ascending: false });
    if (data) setVistorias(data as Vistoria[]);
    setCarregandoVistorias(false);
  }

  async function agendarVistoria(id: string) {
    if (!dataAgendada) return;
    await supabase.from("vistorias").update({
      status: "agendada",
      data_agendada: dataAgendada,
      tecnico_nome: tecnicoNome || null,
      observacoes: observacoes || null,
    }).eq("id", id);

    // Envia email de confirmação ao cliente (se tiver email)
    const vistoria = vistorias.find(v => v.id === id);
    if (vistoria?.cliente_email) {
      supabase.functions.invoke("send-agendamento-email", {
        body: {
          cliente_email: vistoria.cliente_email,
          cliente_nome: vistoria.cliente_nome,
          data_agendada: dataAgendada,
          hora_inicio: null,
          hora_fim: null,
          endereco: vistoria.cliente_endereco,
          tecnico_nome: tecnicoNome || null,
          tipo: "vistoria",
          observacoes: observacoes || null,
        },
      }).catch(err => console.warn("Falha ao enviar email de agendamento:", err));
    }

    setAgendandoId(null);
    setDataAgendada("");
    setTecnicoNome("");
    setObservacoes("");
    await carregarVistorias();
  }

  async function uploadDts(vistoriaId: string, file: File) {
    setUploadingDts(vistoriaId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${vistoriaId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("dts-documentos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("dts-documentos").getPublicUrl(path);

      await supabase.from("vistorias").update({
        dts_url: publicUrl,
        dts_nome: file.name,
        status: "em_andamento",
      }).eq("id", vistoriaId);

      // Aciona análise IA em background
      supabase.functions.invoke("analyze-dts", {
        body: { vistoria_id: vistoriaId, dts_url: publicUrl },
      }).then(() => carregarVistorias());

      await carregarVistorias();
    } catch (e: any) {
      alert("Erro ao fazer upload: " + e.message);
    } finally {
      setUploadingDts(null);
    }
  }

  async function concluirVistoria(v: Vistoria) {
    if (!confirm(`Confirmar conclusão da vistoria de "${v.cliente_nome}"?`)) return;
    setConcluindoId(v.id);
    try {
      await supabase.from("vistorias").update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
      }).eq("id", v.id);

      // Notifica Marilia por email
      await supabase.functions.invoke("notify-vistoria", {
        body: {
          evento: "concluida",
          vistoria: {
            id: v.id,
            cliente_nome: v.cliente_nome,
            cliente_endereco: v.cliente_endereco,
            cliente_telefone: v.cliente_telefone,
            cliente_email: v.cliente_email,
            dts_resumo_ia: v.dts_resumo_ia,
          },
        },
      });

      await carregarVistorias();
    } finally {
      setConcluindoId(null);
    }
  }

  async function carregarAtendimentos() {
    setCarregandoAtend(true);
    const [{ data }, { data: tickets }] = await Promise.all([
      supabase.from("atendimentos").select("*").order("data_agendada", { ascending: false }),
      supabase.from("logistica_pedidos")
        .select("*")
        .eq("is_ticket", true)
        .not("etapa", "in", "(concluido,cancelado)")
        .order("criado_em", { ascending: false }),
    ]);
    if (data) setAtendimentos(data as Atendimento[]);
    if (tickets) setTicketsAbertos(tickets as PedidoLogistico[]);
    setCarregandoAtend(false);
  }

  function gerarIcal(atend: Atendimento): void {
    const uid = `atend-${atend.id}@portibras.com.br`;
    const dtstart = atend.data_agendada
      ? atend.hora_inicio
        ? atend.data_agendada.replace(/-/g, "") + "T" + atend.hora_inicio.replace(/:/g, "") + "00"
        : atend.data_agendada.replace(/-/g, "")
      : new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dtend = atend.hora_fim
      ? atend.data_agendada!.replace(/-/g, "") + "T" + atend.hora_fim.replace(/:/g, "") + "00"
      : dtstart;
    const isAllDay = !atend.hora_inicio;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PORTIBRAS//Sistema//PT",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${atend.titulo}`,
      isAllDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
      isAllDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
      atend.endereco ? `LOCATION:${atend.endereco}` : "",
      atend.descricao ? `DESCRIPTION:${atend.descricao.replace(/\n/g, "\\n")}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${atend.titulo.replace(/\s+/g, "_")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function carregarPedidosLog() {
    setCarregandoPedLog(true);
    const { data } = await supabase
      .from("logistica_pedidos")
      .select("*")
      .not("etapa", "in", "(cancelado)")
      .order("criado_em", { ascending: false });
    if (data) {
      setPedidosLog(data as PedidoLogistico[]);
      // Carrega progresso em batch
      const ids = data.map((p: PedidoLogistico) => p.id);
      if (ids.length > 0) {
        const [{ data: aqData }, { data: tData }, { data: chData }] = await Promise.all([
          supabase.from("logistica_aquisicoes").select("pedido_id, status").in("pedido_id", ids),
          supabase.from("logistica_tarefas").select("pedido_id, concluida").in("pedido_id", ids),
          supabase.from("logistica_checks").select("pedido_id, aba, checked, checked_em").in("pedido_id", ids).order("checked_em", { ascending: false }),
        ]);
        const prog: Record<string, { info: boolean; aquisicao: boolean; tarefas: boolean }> = {};
        for (const id of ids) {
          const aqItens = (aqData ?? []).filter((a: { pedido_id: string }) => a.pedido_id === id);
          const tItens  = (tData  ?? []).filter((t: { pedido_id: string }) => t.pedido_id === id);
          const chItens = (chData ?? []).filter((c: { pedido_id: string }) => c.pedido_id === id);
          // Último check de cada aba para este pedido
          const lastInfo = chItens.find((c: { aba: string }) => c.aba === "info");
          const lastAquis = chItens.find((c: { aba: string }) => c.aba === "aquisicao");
          const lastTaref = chItens.find((c: { aba: string }) => c.aba === "tarefas");
          prog[id] = {
            info:      lastInfo?.checked  === true,  // check manual clicado
            aquisicao: lastAquis?.checked === true || aqItens.length > 0,
            tarefas:   lastTaref?.checked === true || tItens.length > 0,
          };
        }
        setProgressoCards(prog);
      }
    }
    setCarregandoPedLog(false);
  }

  async function carregarAquisicoes(pedidoId: string) {
    setCarregandoAquis(true);
    const { data } = await supabase
      .from("logistica_aquisicoes")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: true });
    if (data) setAquisicoes(data as ItemAquisicao[]);
    setCarregandoAquis(false);
  }

  async function carregarTarefas(pedidoId: string) {
    setCarregandoTarefas(true);
    const { data } = await supabase
      .from("logistica_tarefas")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("ordem", { ascending: true });
    if (data) setTarefas(data as TarefaPedido[]);
    setCarregandoTarefas(false);
  }

  async function adicionarTarefa() {
    if (!pedidoAberto || !novaTarefa.trim()) return;
    setSalvandoTarefa(true);
    const maxOrdem = tarefas.length > 0 ? Math.max(...tarefas.map(t => t.ordem)) + 1 : 0;
    const { data } = await supabase.from("logistica_tarefas").insert({
      pedido_id: pedidoAberto.id,
      descricao: novaTarefa.trim(),
      concluida: false,
      ordem: maxOrdem,
    }).select().single();
    if (data) setTarefas(ts => [...ts, data as TarefaPedido]);
    setNovaTarefa("");
    setSalvandoTarefa(false);
  }

  function atualizarProgressoCard(pedidoId: string, novasTarefas?: TarefaPedido[], novasAquis?: ItemAquisicao[]) {
    const tItens = novasTarefas ?? tarefas;
    const aItens = novasAquis ?? aquisicoes;
    setProgressoCards(p => ({
      ...p,
      [pedidoId]: {
        info:      p[pedidoId]?.info ?? false,
        aquisicao: aItens.length > 0,
        tarefas:   tItens.length > 0,
      },
    }));
  }

  async function carregarChecks(pedidoId: string) {
    const { data } = await supabase
      .from("logistica_checks")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("checked_em", { ascending: false });
    if (data) setChecksAbas(data as CheckAba[]);
  }

  async function toggleCheckAba(aba: "info" | "aquisicao" | "tarefas") {
    if (!pedidoAberto || salvandoCheck) return;
    // Pega o último check desta aba
    const ultimo = checksAbas.find(c => c.aba === aba);
    const novoEstado = !ultimo?.checked;
    setSalvandoCheck(aba);
    const { data, error } = await supabase
      .from("logistica_checks")
      .insert({ pedido_id: pedidoAberto.id, aba, checked: novoEstado })
      .select()
      .single();
    if (!error && data) {
      const novos = [data as CheckAba, ...checksAbas];
      setChecksAbas(novos);
      // Atualiza bolinha do kanban card com base nos checks
      setProgressoCards(p => ({
        ...p,
        [pedidoAberto.id]: {
          info:      aba === "info"      ? novoEstado : (p[pedidoAberto.id]?.info ?? false),
          aquisicao: aba === "aquisicao" ? novoEstado : (p[pedidoAberto.id]?.aquisicao ?? false),
          tarefas:   aba === "tarefas"   ? novoEstado : (p[pedidoAberto.id]?.tarefas ?? false),
        },
      }));
    }
    setSalvandoCheck(null);
  }

  async function toggleTarefa(t: TarefaPedido) {
    const concluida = !t.concluida;
    await supabase.from("logistica_tarefas").update({
      concluida,
      concluida_em: concluida ? new Date().toISOString() : null,
    }).eq("id", t.id);
    const novas = tarefas.map(x => x.id === t.id ? { ...x, concluida, concluida_em: concluida ? new Date().toISOString() : null } : x);
    setTarefas(novas);
    if (pedidoAberto) atualizarProgressoCard(pedidoAberto.id, novas);
  }

  async function excluirTarefa(id: string) {
    await supabase.from("logistica_tarefas").delete().eq("id", id);
    setTarefas(ts => ts.filter(t => t.id !== id));
  }

  async function abrirPedido(p: PedidoLogistico) {
    setPedidoAberto(p);
    setAbaPedido("info");
    setAquisicoes([]);
    setTarefas([]);
    setChecksAbas([]);
    setNovaTarefa("");
    carregarAquisicoes(p.id);
    carregarTarefas(p.id);
    carregarChecks(p.id);
  }

  async function moverEtapa(pedido: PedidoLogistico, novaEtapa: EtapaLogistica) {
    setAtualizandoEtapa(pedido.id);
    const updates: Partial<PedidoLogistico> = { etapa: novaEtapa };
    if (novaEtapa === "aguard_cobranca") updates.tipo_cobranca = "apos";
    await supabase.from("logistica_pedidos").update(updates).eq("id", pedido.id);
    setPedidosLog(ps => ps.map(p => p.id === pedido.id ? { ...p, ...updates } : p));
    if (pedidoAberto?.id === pedido.id) setPedidoAberto(p => p ? { ...p, ...updates } : p);
    setAtualizandoEtapa(null);
  }

  async function salvarAquisicao() {
    if (!pedidoAberto || !formAquis.nome.trim()) return;
    setSalvandoAquis(true);
    const { data } = await supabase.from("logistica_aquisicoes").insert({
      pedido_id: pedidoAberto.id,
      nome: formAquis.nome.trim(),
      quantidade: parseFloat(formAquis.quantidade) || 1,
      unidade: formAquis.unidade || "un",
      custo_unitario: formAquis.custo_unitario ? parseFloat(formAquis.custo_unitario.replace(",", ".")) : null,
      fornecedor: formAquis.fornecedor || null,
      link_compra: formAquis.link_compra || null,
      observacoes: formAquis.observacoes || null,
      status: "pendente",
    }).select().single();
    if (data) setAquisicoes(aq => [...aq, data as ItemAquisicao]);
    setFormAquis({ nome: "", quantidade: "1", unidade: "un", custo_unitario: "", fornecedor: "", link_compra: "", observacoes: "" });
    setSupSelecionado(null);
    setBuscaSupAquis("");
    setSalvandoAquis(false);
  }

  async function atualizarStatusAquis(id: string, status: ItemAquisicao["status"]) {
    await supabase.from("logistica_aquisicoes").update({ status }).eq("id", id);
    setAquisicoes(aq => aq.map(a => a.id === id ? { ...a, status } : a));
  }

  async function removerAquisicao(id: string) {
    await supabase.from("logistica_aquisicoes").delete().eq("id", id);
    setAquisicoes(aq => aq.filter(a => a.id !== id));
  }

  async function excluirPedido(pedido: PedidoLogistico) {
    if (!window.confirm(`Excluir o pedido de "${pedido.cliente_empresa || pedido.cliente_nome}"? Esta ação não pode ser desfeita.`)) return;
    // Remove aquisições vinculadas primeiro
    await supabase.from("logistica_aquisicoes").delete().eq("pedido_id", pedido.id);
    await supabase.from("logistica_pedidos").delete().eq("id", pedido.id);
    setPedidosLog(ps => ps.filter(p => p.id !== pedido.id));
    setPedidoAberto(null);
  }

  async function carregarPedidosFechados() {
    setCarregandoPedidos(true);
    const { data } = await supabase
      .from("crm_propostas")
      .select("*, lead:crm_leads(nome, empresa)")
      .eq("status", "fechado")
      .order("atualizado_em", { ascending: false });
    if (data) setPedidosFechados(data as PedidoFechado[]);
    setCarregandoPedidos(false);
  }

  async function excluirPedidoFechado() {
    if (!excluindoPedidoFechado) return;
    setProcessandoExclusaoPF(true);
    await supabase.from("crm_propostas").delete().eq("id", excluindoPedidoFechado.id);
    setProcessandoExclusaoPF(false);
    setExcluindoPedidoFechado(null);
    await carregarPedidosFechados();
  }

  async function carregarMateriais() {
    setCarregandoMat(true);
    const { data } = await supabase.from("atendimentos_materiais").select("*").order("criado_em", { ascending: false });
    if (data) setMateriais(data as Material[]);
    setCarregandoMat(false);
  }

  function abrirModalAtend(atend?: Atendimento) {
    setBuscaVinculo("");
    if (atend) {
      setSelAtend(atend);
      setFormAtend({
        titulo: atend.titulo, classificacao: atend.classificacao, status: atend.status,
        data_agendada: atend.data_agendada || "", hora_inicio: atend.hora_inicio || "",
        hora_fim: atend.hora_fim || "", responsaveis: atend.responsaveis || [],
        endereco: atend.endereco || "", atividade: atend.atividade || "",
        descricao: atend.descricao || "", agendado_com_cliente: atend.agendado_com_cliente,
        em_sistema: atend.em_sistema,
        cliente_email: (atend as any).cliente_email || "",
        cliente_nome: (atend as any).cliente_nome || "",
        cliente_email_cc: (atend as any).cliente_email_cc || "",
      });
    } else {
      setSelAtend(null);
      setFormAtend({ ...EMPTY_ATEND });
    }
    setModalAtend(true);
  }

  async function salvarAtend() {
    if (!formAtend.titulo.trim()) return;
    setSalvandoAtend(true);
    const payload = {
      titulo: formAtend.titulo.trim(),
      classificacao: formAtend.classificacao,
      status: formAtend.status,
      data_agendada: formAtend.data_agendada || null,
      hora_inicio: formAtend.hora_inicio || null,
      hora_fim: formAtend.hora_fim || null,
      responsaveis: formAtend.responsaveis,
      endereco: formAtend.endereco || null,
      atividade: formAtend.atividade || null,
      descricao: formAtend.descricao || null,
      agendado_com_cliente: formAtend.agendado_com_cliente,
      em_sistema: formAtend.em_sistema,
      cliente_nome: formAtend.cliente_nome?.trim() || null,
      cliente_email: formAtend.cliente_email?.trim() || null,
      cliente_email_cc: formAtend.cliente_email_cc?.trim() || null,
    };

    // Detecta reagendamento: se edição e data mudou
    const isReagendamento =
      !!selAtend &&
      !!formAtend.cliente_email?.trim() &&
      !!formAtend.data_agendada &&
      selAtend.data_agendada !== formAtend.data_agendada;

    if (selAtend) await supabase.from("atendimentos").update(payload).eq("id", selAtend.id);
    else await supabase.from("atendimentos").insert(payload);

    // Envia email ao cliente se agendamento confirmado com ele e há data + email
    const emailCliente = formAtend.cliente_email?.trim();
    if (formAtend.agendado_com_cliente && formAtend.data_agendada && emailCliente) {
      const ccList = formAtend.cliente_email_cc
        ?.split(",")
        .map(e => e.trim())
        .filter(e => e.includes("@")) ?? [];
      supabase.functions.invoke("send-agendamento-email", {
        body: {
          cliente_email: emailCliente,
          cliente_email_cc: ccList,
          cliente_nome: formAtend.cliente_nome?.trim() || null,
          data_agendada: formAtend.data_agendada,
          hora_inicio: formAtend.hora_inicio || null,
          hora_fim: formAtend.hora_fim || null,
          endereco: formAtend.endereco || null,
          tecnico_nome: formAtend.responsaveis?.join(", ") || null,
          tipo: "atendimento",
          titulo: formAtend.titulo,
          observacoes: formAtend.descricao || null,
        },
      }).catch(err => console.warn("Falha ao enviar email de agendamento:", err));
    }

    // Envia email de reagendamento se a data mudou
    if (isReagendamento) {
      const atendAtualizado: Atendimento = {
        ...selAtend!,
        ...payload,
        data_agendada: formAtend.data_agendada,
        hora_inicio: formAtend.hora_inicio || null,
        hora_fim: formAtend.hora_fim || null,
      };
      enviarEmailStatusAtend("reagendamento", atendAtualizado, {
        data_agendada: formAtend.data_agendada,
        hora_inicio: formAtend.hora_inicio || null,
        hora_fim: formAtend.hora_fim || null,
      });
    }

    setModalAtend(false);
    await carregarAtendimentos();
    setSalvandoAtend(false);
  }

  function enviarEmailStatusAtend(
    evento: "reagendamento" | "cancelamento" | "conclusao_total" | "conclusao_parcial",
    atend: Atendimento,
    opts?: { data_agendada?: string; hora_inicio?: string | null; hora_fim?: string | null }
  ) {
    if (!atend.cliente_email) return;
    const ccList = atend.cliente_email_cc
      ?.split(",").map(e => e.trim()).filter(e => e.includes("@")) ?? [];
    supabase.functions.invoke("send-atendimento-status-email", {
      body: {
        evento,
        cliente_email: atend.cliente_email,
        ...(ccList.length > 0 ? { cliente_email_cc: ccList } : {}),
        cliente_nome: atend.cliente_nome || null,
        titulo: atend.titulo,
        data_agendada: opts?.data_agendada ?? atend.data_agendada,
        hora_inicio: opts?.hora_inicio !== undefined ? opts.hora_inicio : atend.hora_inicio,
        hora_fim: opts?.hora_fim !== undefined ? opts.hora_fim : atend.hora_fim,
        endereco: atend.endereco,
        tecnico_nome: atend.responsaveis?.join(", ") || null,
      },
    }).catch(err => console.warn("Falha ao enviar email de status:", err));
  }

  async function confirmarCancelamento() {
    if (!modalCancelar) return;
    setProcessandoStatusAtend(true);
    await supabase.from("atendimentos").delete().eq("id", modalCancelar.id);
    enviarEmailStatusAtend("cancelamento", modalCancelar);
    setModalCancelar(null);
    setProcessandoStatusAtend(false);
    await carregarAtendimentos();
  }

  async function confirmarConclusao(tipo: "total" | "parcial") {
    if (!modalConcluir) return;
    setProcessandoStatusAtend(true);
    const novoStatus = "Concluído";
    await supabase.from("atendimentos").update({ status: novoStatus }).eq("id", modalConcluir.id);
    setAtendimentos(prev => prev.map(a => a.id === modalConcluir.id ? { ...a, status: novoStatus } : a));
    enviarEmailStatusAtend(tipo === "total" ? "conclusao_total" : "conclusao_parcial", modalConcluir);
    setModalConcluir(null);
    setProcessandoStatusAtend(false);
  }

  async function atualizarStatusAtend(id: string, status: Atendimento["status"]) {
    const atend = atendimentos.find(a => a.id === id);
    // Conclusão e cancelamento agora passam pelos modais com email
    if (status === "Concluído" && atend) { setModalConcluir(atend); return; }
    if (status === "Cancelado" && atend) { setModalCancelar(atend); return; }
    await supabase.from("atendimentos").update({ status }).eq("id", id);
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  function excluirAtend(id: string) {
    const atend = atendimentos.find(a => a.id === id);
    if (atend) setModalCancelar(atend);
  }

  function abrirModalMat(atendimentoId: string) {
    setFormMat({ ...EMPTY_MAT });
    setModalMat({ aberto: true, atendimentoId });
  }

  async function salvarMat() {
    if (!formMat.descricao.trim() || !modalMat.atendimentoId) return;
    setSalvandoMat(true);
    await supabase.from("atendimentos_materiais").insert({
      atendimento_id: modalMat.atendimentoId,
      descricao: formMat.descricao.trim(),
      codigo: formMat.codigo || null,
      quantidade: Number(formMat.quantidade) || 1,
      unidade: formMat.unidade,
      valor_unitario: formMat.valor_unitario ? Number(formMat.valor_unitario) : null,
      fornecedor: formMat.fornecedor || null,
      link_compra: formMat.link_compra || null,
      status: formMat.status,
      observacoes: formMat.observacoes || null,
    });
    setModalMat({ aberto: false, atendimentoId: null });
    await carregarMateriais();
    setSalvandoMat(false);
  }

  async function atualizarStatusMat(id: string, status: Material["status"]) {
    await supabase.from("atendimentos_materiais").update({ status }).eq("id", id);
    setMateriais(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }

  async function excluirMat(id: string) {
    if (!confirm("Excluir este material?")) return;
    await supabase.from("atendimentos_materiais").delete().eq("id", id);
    await carregarMateriais();
  }

  async function carregarEstoque() {
    setCarregandoEstoque(true);
    const { data } = await supabase.from("logistica_estoque").select("*").order("nome");
    if (data) setItens(data as ItemEstoque[]);
    setCarregandoEstoque(false);
  }

  function abrirEstoque(item?: ItemEstoque) {
    if (item) { setSelEstoque(item); setFormEstoque({ ...item }); }
    else { setSelEstoque(null); setFormEstoque({ nome: "", codigo: "", categoria: "", quantidade: 0, estoque_minimo: 0, unidade: "un", localizacao: "" }); }
    setModalEstoque(true);
  }

  async function salvarEstoque() {
    if (!formEstoque.nome?.trim()) return;
    if (selEstoque) await supabase.from("logistica_estoque").update(formEstoque).eq("id", selEstoque.id);
    else await supabase.from("logistica_estoque").insert(formEstoque);
    setModalEstoque(false);
    carregarEstoque();
  }

  const abaixoMinimo = itens.filter(i => i.quantidade <= i.estoque_minimo);

  // ── Suprimentos ────────────────────────────────────────────────────────────
  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [carregandoSup, setCarregandoSup] = useState(true);
  const [modalSup, setModalSup] = useState(false);
  const [selSup, setSelSup] = useState<Suprimento | null>(null);
  const [buscaSup, setBuscaSup] = useState("");
  const [formSup, setFormSup] = useState<Partial<Suprimento>>({
    nome: "", codigo: "", categoria: "", unidade: "un",
    custo_unitario: 0, link_compra: "",
  });

  // carregarSuprimentos e profissionais são gerenciados pelo useEffect do bloco de profissionais

  async function carregarSuprimentos() {
    setCarregandoSup(true);
    const { data } = await supabase.from("logistica_suprimentos").select("*").order("nome");
    if (data) setSuprimentos(data as Suprimento[]);
    setCarregandoSup(false);
  }

  function abrirSup(s?: Suprimento) {
    if (s) { setSelSup(s); setFormSup({ ...s }); }
    else { setSelSup(null); setFormSup({ nome: "", codigo: "", categoria: "", unidade: "un", custo_unitario: 0, tempo_instalacao_min: 0, profissionais_ids: [], link_compra: "" }); }
    setModalSup(true);
  }

  async function salvarSup() {
    if (!formSup.nome?.trim()) return;
    const payload = { ...formSup, atualizado_em: new Date().toISOString() };
    if (selSup) await supabase.from("logistica_suprimentos").update(payload).eq("id", selSup.id);
    else await supabase.from("logistica_suprimentos").insert(payload);
    setModalSup(false);
    carregarSuprimentos();
  }

  async function excluirSup(id: string) {
    if (!confirm("Excluir este suprimento?")) return;
    await supabase.from("logistica_suprimentos").delete().eq("id", id);
    carregarSuprimentos();
  }

  const supFiltrados = suprimentos.filter(s =>
    !buscaSup ||
    s.nome.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.codigo?.toLowerCase().includes(buscaSup.toLowerCase()) ||
    s.categoria?.toLowerCase().includes(buscaSup.toLowerCase())
  );

  const precosDesatualizados = suprimentos.filter(s => s.atualizado_em && diasDesdeAtualizacao(s.atualizado_em) > DIAS_ALERTA);

  // ── Profissionais Terceirizados ─────────────────────────────────────────────
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregandoProf, setCarregandoProf] = useState(true);
  const [modalProf, setModalProf] = useState(false);
  const [selProf, setSelProf] = useState<Profissional | null>(null);
  const [formProf, setFormProf] = useState<Partial<Profissional>>({
    nome: "", especialidade: "", tipo_cobranca: "diaria", custo_diario: 0, custo_unitario: 0, ativo: true, terceirizado: true,
  });

  // ── Valor de MO Padrão (para orçamentos CRM) ───────────────────────────────
  const [moPadrao, setMoPadrao] = useState<number>(0);
  const [salvandoMo, setSalvandoMo] = useState(false);
  const [moSalvo, setMoSalvo] = useState(false);

  async function carregarMoPadrao() {
    const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "mo_padrao_valor").single();
    if (data) setMoPadrao(Number(data.valor) || 0);
  }

  async function salvarMoPadrao() {
    setSalvandoMo(true);
    await supabase.from("configuracoes").upsert({ chave: "mo_padrao_valor", valor: String(moPadrao) }, { onConflict: "chave" });
    setSalvandoMo(false);
    setMoSalvo(true);
    setTimeout(() => setMoSalvo(false), 2500);
  }

  useEffect(() => {
    if (aba === "equipe") { carregarProfissionais(); carregarMoPadrao(); }
    if (aba === "suprimentos") { carregarSuprimentos(); carregarProfissionais(); }
    if (aba === "pedidos") { carregarSuprimentos(); } // pré-carrega catálogo para o seletor de aquisição
    if (aba === "compras") { carregarSuprimentos(); } // necessário para autocomplete em Materiais a Comprar
  }, [aba]);

  async function carregarProfissionais() {
    setCarregandoProf(true);
    const { data } = await supabase.from("logistica_profissionais").select("*").order("nome");
    if (data) setProfissionais(data as Profissional[]);
    setCarregandoProf(false);
  }

  function abrirProf(p?: Profissional) {
    if (p) { setSelProf(p); setFormProf({ ...p }); }
    else { setSelProf(null); setFormProf({ nome: "", especialidade: "", tipo_cobranca: "diaria", custo_diario: 0, custo_unitario: 0, ativo: true, terceirizado: true }); }
    setModalProf(true);
  }

  async function salvarProf() {
    if (!formProf.nome?.trim()) return;
    if (selProf) await supabase.from("logistica_profissionais").update(formProf).eq("id", selProf.id);
    else await supabase.from("logistica_profissionais").insert(formProf);
    setModalProf(false);
    carregarProfissionais();
  }

  async function excluirProf(id: string) {
    if (!confirm("Excluir este profissional?")) return;
    await supabase.from("logistica_profissionais").delete().eq("id", id);
    carregarProfissionais();
  }

  function toggleProfissionalNoSup(profId: string) {
    const atual = formSup.profissionais_ids ?? [];
    const novo = atual.includes(profId)
      ? atual.filter(id => id !== profId)
      : [...atual, profId];
    setFormSup({ ...formSup, profissionais_ids: novo });
  }

  // ── Técnico ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketTecnico[]>([]);
  const [carregandoTickets, setCarregandoTickets] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("aberto");

  // ── Fila unificada de agendáveis ───────────────────────────────────────────
  interface ItemAgendavel {
    id: string;
    tipo: "vistoria" | "atendimento" | "manutencao";
    cliente: string;
    endereco: string | null;
    bairro: string | null;
    data: string | null;
    status: string;
    tecnico: string | null;
    descricao?: string;
  }
  const [agendaveis, setAgendaveis] = useState<ItemAgendavel[]>([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);

  // Google Calendar
  interface EventoGoogle {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    local: string | null;
    descricao: string | null;
    link: string;
    dia_todo: boolean;
  }
  const [eventosGoogle, setEventosGoogle] = useState<EventoGoogle[]>([]);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [googleConectado, setGoogleConectado] = useState<boolean | null>(null);

  useEffect(() => { if (aba === "tecnico") { carregarTickets(); carregarAgendaveis(); carregarEventosGoogle(); } }, [aba]);

  // Detecta redirect de conexão bem-sucedida
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      carregarEventosGoogle();
    }
  }, []);

  async function carregarTickets() {
    setCarregandoTickets(true);
    const { data } = await supabase
      .from("tickets_tecnicos")
      .select("*")
      .order("agendado_para", { ascending: true });
    if (data) setTickets(data as TicketTecnico[]);
    setCarregandoTickets(false);
  }

  function extrairBairro(endereco: string | null): string | null {
    if (!endereco) return null;
    // Tenta extrair bairro de endereços no formato "Rua X, N - Bairro, Cidade - UF"
    const partes = endereco.split(/[-,]/);
    if (partes.length >= 3) return partes[partes.length - 3]?.trim() || null;
    if (partes.length === 2) return partes[1]?.trim() || null;
    return null;
  }

  async function carregarAgendaveis() {
    setCarregandoAgenda(true);
    const itens: ReturnType<typeof useState<any[]>>[0] = [];

    // Vistorias pendentes e agendadas
    const { data: vis } = await supabase
      .from("vistorias")
      .select("id, cliente_nome, cliente_endereco, status, data_agendada, tecnico_nome")
      .in("status", ["pendente", "agendada", "em_andamento"]);

    (vis ?? []).forEach((v: any) => {
      itens.push({
        id: v.id,
        tipo: "vistoria",
        cliente: v.cliente_nome,
        endereco: v.cliente_endereco,
        bairro: extrairBairro(v.cliente_endereco),
        data: v.data_agendada,
        status: v.status,
        tecnico: v.tecnico_nome,
        descricao: "Vistoria técnica",
      });
    });

    // Atendimentos programados ou em andamento
    const { data: atend } = await supabase
      .from("atendimentos")
      .select("id, titulo, endereco, status, data_agendada, responsaveis")
      .in("status", ["Programado", "Em andamento"]);

    (atend ?? []).forEach((a: any) => {
      itens.push({
        id: a.id,
        tipo: "atendimento",
        cliente: a.titulo,
        endereco: a.endereco,
        bairro: extrairBairro(a.endereco),
        data: a.data_agendada,
        status: a.status,
        tecnico: Array.isArray(a.responsaveis) ? a.responsaveis[0] : null,
        descricao: "Atendimento",
      });
    });

    // Contratos ativos (manutenções recorrentes)
    const { data: contr } = await supabase
      .from("ca_contratos")
      .select("id, nome, cliente_nome")
      .eq("status", "active")
      .limit(30);

    (contr ?? []).forEach((c: any) => {
      itens.push({
        id: c.id,
        tipo: "manutencao",
        cliente: c.cliente_nome,
        endereco: null,
        bairro: null,
        data: null,
        status: "ativo",
        tecnico: null,
        descricao: c.nome,
      });
    });

    // Ordenar: sem data primeiro (pendentes), depois por data
    itens.sort((a: any, b: any) => {
      if (!a.data && !b.data) return a.cliente.localeCompare(b.cliente);
      if (!a.data) return -1;
      if (!b.data) return 1;
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });

    setAgendaveis(itens as any);
    setCarregandoAgenda(false);
  }

  function abrirGoogleCalendar(item: any) {
    const titulo = encodeURIComponent(`[${item.tipo === "vistoria" ? "Vistoria" : item.tipo === "atendimento" ? "Atendimento" : "Manutenção"}] ${item.cliente}`);
    const local = encodeURIComponent(item.endereco ?? "");
    const detalhe = encodeURIComponent(`Tipo: ${item.descricao}\nEndereço: ${item.endereco ?? "—"}\nTécnico: ${item.tecnico ?? "—"}`);
    // Data base: amanhã ao meio-dia se não tiver data
    const base = item.data ? new Date(item.data) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; })();
    const fim = new Date(base.getTime() + 2 * 60 * 60 * 1000); // +2h
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${fmt(base)}/${fmt(fim)}&location=${local}&details=${detalhe}`;
    window.open(url, "_blank");
  }

  async function carregarEventosGoogle() {
    setCarregandoGoogle(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(
        `https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/google-calendar-proxy`,
        { headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      console.log("[GoogleCalendar] status:", res.status, "body:", json);
      if (json.error === "not_connected" || json.error === "token_expired") {
        setGoogleConectado(false);
        setEventosGoogle([]);
      } else if (res.ok && "eventos" in json) {
        setGoogleConectado(true);
        setEventosGoogle(json.eventos ?? []);
      } else {
        // resposta inesperada — trata como não conectado
        setGoogleConectado(false);
      }
    } catch (e) {
      console.error("[GoogleCalendar] erro:", e);
      setGoogleConectado(false);
    }
    setCarregandoGoogle(false);
  }

  function iniciarConexaoGoogle() {
    const clientId = "740070288777-1093sn92agd0i4dpi6d9kie0ni8aomln.apps.googleusercontent.com";
    const redirectUri = encodeURIComponent("https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/google-calendar-callback");
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.readonly");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }

  const ticketsFiltrados = tickets.filter(t =>
    filtroStatus === "todos" || t.status === filtroStatus
  );

  const ticketsSuporte = tickets.filter(t =>
    t.status === "aberto" || t.status === "em_andamento" || t.status === "aguardando"
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logística</h1>
        <p className="mt-1 text-sm text-gray-500">Estoque, suprimentos e agenda técnica</p>
      </div>

      {/* Abas */}
      {/* ── Navegação por abas ── */}
      <div className="mb-6">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 scrollbar-none pb-px">
          {([
            { key: "pedidos",      label: "Pedidos",      icon: FileCheck },
            { key: "compras",      label: "Compras",      icon: ShoppingBag },
            { key: "atendimentos", label: "Atendimentos", icon: ClipboardList },
            { key: "gantt",        label: "Gantt",        icon: BarChart2 },
            { key: "estoque",      label: "Estoque",      icon: Package },
            { key: "equipe",       label: "Equipe",       icon: HardHat },
            { key: "tecnico",      label: "Área Técnica", icon: Wrench },
          ] as const).map(({ key, label, icon: Icon }) => {
            const ativo = aba === key;
            const badges: { count: number; cor: string; title?: string }[] = [];
            if (key === "pedidos") {
              const tratamento = pedidosLog.filter(p => p.etapa === "tratamento").length;
              if (tratamento > 0) badges.push({ count: tratamento, cor: "bg-orange-500", title: "Em tratamento" });
            }
            if (key === "compras") {
              // badge de itens pendentes de compra (buscado via pedidosLog indiretamente — simplificado)
            }
            if (key === "estoque" && abaixoMinimo.length > 0) badges.push({ count: abaixoMinimo.length, cor: "bg-orange-500" });

            if (key === "atendimentos") {
              const ativos = atendimentos.filter(a => a.status === "Programado" || a.status === "Em andamento").length;
              if (ativos > 0) badges.push({ count: ativos, cor: "bg-emerald-500" });
            }
            if (key === "tecnico" && ticketsAbertos.length > 0) badges.push({ count: ticketsAbertos.length, cor: "bg-blue-500" });
            return (
              <button key={key} onClick={() => setAba(key)}
                className={cn(
                  "relative flex flex-shrink-0 flex-col items-center gap-1 px-4 py-2.5 border-b-2 -mb-px transition-all duration-150",
                  ativo
                    ? "border-[#1a6b2f] text-[#1a6b2f]"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                )}>
                <div className="relative">
                  <Icon className={cn("h-4 w-4", ativo ? "text-[#1a6b2f]" : "text-gray-400")} />
                  {badges.length > 0 && (
                    <span className={cn("absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-bold text-white leading-none", badges[0].cor)}>
                      {badges.reduce((s, b) => s + b.count, 0)}
                    </span>
                  )}
                </div>
                <span className={cn("text-[11px] font-medium whitespace-nowrap", ativo ? "text-[#1a6b2f]" : "text-gray-400")}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════ ABA PEDIDOS (Kanban de Tratamento) ═══════ */}
      {aba === "pedidos" && (() => {
        const ETAPAS: { key: EtapaLogistica; label: string; acento: string; pill: string; dot: string }[] = [
          { key: "tratamento",      label: "Tratamento",       acento: "border-t-orange-400",  pill: "bg-orange-100 text-orange-700",  dot: "bg-orange-400" },
          { key: "aguard_material", label: "Aguard. Material", acento: "border-t-amber-400",   pill: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
          { key: "aguard_cobranca", label: "Aguard. Cobrança", acento: "border-t-blue-400",    pill: "bg-blue-100 text-blue-700",      dot: "bg-blue-400" },
          { key: "em_execucao",     label: "Em Execução",      acento: "border-t-violet-400",  pill: "bg-violet-100 text-violet-700",  dot: "bg-violet-400" },
          { key: "concluido",       label: "Concluído",        acento: "border-t-emerald-400", pill: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
        ];
        const PROX: Record<EtapaLogistica, EtapaLogistica | null> = {
          tratamento: "aguard_material", aguard_material: "em_execucao",
          aguard_cobranca: "em_execucao", em_execucao: "concluido",
          concluido: null, cancelado: null,
        };
        const COB_STYLE: Record<TipoCobranca, { label: string; cls: string }> = {
          antes:        { label: "Cobrar antes",  cls: "bg-sky-100 text-sky-700" },
          apos:         { label: "Cobrar após",   cls: "bg-violet-100 text-violet-700" },
          sem_cobranca: { label: "Sem cobrança",  cls: "bg-gray-100 text-gray-500" },
        };
        const fmt = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
        const totalAtivos = pedidosLog.length;
        const totalValor  = pedidosLog.reduce((s, p) => s + (p.valor_venda ?? 0), 0);
        const emExec      = pedidosLog.filter(p => p.etapa === "em_execucao").length;

        return (
          <>
            {/* ── KPIs ── */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              {[
                { label: "Pedidos ativos",  value: totalAtivos,              fmt: (v: number) => String(v),                             cor: "text-gray-900" },
                { label: "Volume em aberto",value: totalValor,               fmt: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), cor: "text-[#1a6b2f]" },
                { label: "Em execução",     value: emExec,                   fmt: (v: number) => String(v),                             cor: "text-violet-700" },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{kpi.label}</p>
                  <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", kpi.cor)}>
                    {carregandoPedLog ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-gray-100" /> : kpi.fmt(kpi.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Toggle Kanban / Lista ── */}
            <div className="mb-4 flex items-center justify-end">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => setViewPedidos("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    viewPedidos === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 14 14">
                    <rect x="1" y="1" width="4" height="12" rx="1" fill="currentColor" opacity=".4"/>
                    <rect x="6" y="1" width="4" height="8" rx="1" fill="currentColor"/>
                    <rect x="11" y="1" width="2" height="10" rx="1" fill="currentColor" opacity=".4"/>
                  </svg>
                  Kanban
                </button>
                <button
                  onClick={() => setViewPedidos("lista")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    viewPedidos === "lista" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 14 14">
                    <rect x="1" y="1" width="12" height="2.5" rx="1" fill="currentColor"/>
                    <rect x="1" y="5.5" width="12" height="2.5" rx="1" fill="currentColor" opacity=".6"/>
                    <rect x="1" y="10" width="12" height="2.5" rx="1" fill="currentColor" opacity=".3"/>
                  </svg>
                  Lista
                </button>
              </div>
            </div>

            {/* ── Kanban ── */}
            {viewPedidos === "kanban" && (
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 420 }}>
              {ETAPAS.map(etapa => {
                const cards = pedidosLog.filter(p => p.etapa === etapa.key);
                const volCol = cards.reduce((s, p) => s + (p.valor_venda ?? 0), 0);
                return (
                  <div key={etapa.key} className="flex flex-col flex-shrink-0 w-64">
                    {/* Cabeçalho coluna */}
                    <div className={cn("rounded-xl border-t-2 border border-gray-200 bg-white px-3 pt-3 pb-2.5 mb-2 shadow-sm", etapa.acento)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", etapa.dot)} />
                          <span className="text-xs font-semibold text-gray-700">{etapa.label}</span>
                        </div>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", etapa.pill)}>
                          {cards.length}
                        </span>
                      </div>
                      {volCol > 0 && (
                        <p className="text-[10px] text-gray-400 tabular-nums">
                          {volCol.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-gray-50/80 p-2">
                      {cards.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                          <span className="text-2xl opacity-20">○</span>
                          <p className="text-[11px] text-gray-300">Nenhum pedido</p>
                        </div>
                      )}
                      {cards.map(p => {
                        const cliente = p.cliente_empresa || p.cliente_nome || "—";
                        const tipo = p.tipo_servico === "manutencao" ? "Manut." : "Orç.";
                        const prox = PROX[p.etapa];
                        const dias = Math.floor((Date.now() - new Date(p.criado_em).getTime()) / 86_400_000);
                        const cob = COB_STYLE[p.tipo_cobranca];
                        const isTicket = !!p.is_ticket;

                        // SLA countdown for tickets
                        let slaLabel = "";
                        let slaExpired = false;
                        if (isTicket && p.ticket_sla_at) {
                          const diff = new Date(p.ticket_sla_at).getTime() - Date.now();
                          const daysLeft = Math.ceil(diff / 86_400_000);
                          slaExpired = diff < 0;
                          slaLabel = slaExpired
                            ? `SLA vencido`
                            : daysLeft === 0 ? "vence hoje" : `${daysLeft}d restante${daysLeft > 1 ? "s" : ""}`;
                        }

                        if (isTicket) {
                          return (
                            <div
                              key={p.id}
                              className={cn(
                                "group rounded-xl border-2 p-3 shadow-md transition-all cursor-pointer",
                                slaExpired
                                  ? "border-red-600 bg-red-600 animate-pulse"
                                  : "border-red-400 bg-red-50 hover:border-red-500 hover:shadow-lg"
                              )}
                              onClick={() => abrirPedido(p)}
                            >
                              {/* Badge TICKET + SLA */}
                              <div className="flex items-center justify-between mb-2">
                                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide", slaExpired ? "bg-white/20 text-white" : "bg-red-600 text-white")}>
                                  🎫 TICKET
                                </span>
                                {slaLabel && (
                                  <span className={cn("text-[9px] font-bold tabular-nums", slaExpired ? "text-white" : "text-red-700")}>
                                    {slaLabel}
                                  </span>
                                )}
                              </div>

                              {/* Nome cliente */}
                              <p className={cn("text-xs font-semibold leading-tight line-clamp-2 mb-1.5", slaExpired ? "text-white" : "text-red-900")}>{cliente}</p>

                              {/* Motivo */}
                              {p.ticket_motivo && (
                                <p className={cn("text-[10px] leading-tight line-clamp-2 mb-2", slaExpired ? "text-white/80" : "text-red-700/80")}>
                                  {p.ticket_motivo}
                                </p>
                              )}

                              {/* Prioridade + avançar */}
                              <div className="flex items-center justify-between">
                                {p.ticket_prioridade && (
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                                    slaExpired ? "bg-white/20 text-white" :
                                    p.ticket_prioridade === "alta" ? "bg-red-200 text-red-800" :
                                    p.ticket_prioridade === "media" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"
                                  )}>
                                    {p.ticket_prioridade === "alta" ? "Alta" : p.ticket_prioridade === "media" ? "Média" : "Baixa"}
                                  </span>
                                )}
                                {prox && (
                                  <button
                                    onClick={e => { e.stopPropagation(); moverEtapa(p, prox); }}
                                    disabled={atualizandoEtapa === p.id}
                                    className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors opacity-0 group-hover:opacity-100",
                                      slaExpired ? "bg-white/20 text-white hover:bg-white/30" : "bg-red-200 text-red-800 hover:bg-red-300"
                                    )}
                                  >
                                    {atualizandoEtapa === p.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ChevronRight className="h-2.5 w-2.5" />}
                                    Avançar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                                        const prog = progressoCards[p.id];
                        // Bolinhas refletem o check manual clicado pelo usuário
                        const infoOk  = prog?.info      ?? false;
                        const aquisOk = prog?.aquisicao ?? false;
                        const tarefOk = prog?.tarefas   ?? false;

                        return (
                          <div
                            key={p.id}
                            className="group rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-[#1a6b2f]/30 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => abrirPedido(p)}
                          >
                            {/* Tipo + dias */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">{tipo}</span>
                              <span className={cn("text-[9px] font-medium", dias > 7 ? "text-orange-500" : "text-gray-300")}>
                                {dias === 0 ? "hoje" : `${dias}d`}
                              </span>
                            </div>

                            {/* Nome cliente */}
                            <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 mb-2">{cliente}</p>

                            {/* Valor */}
                            {p.valor_venda != null && (
                              <p className="text-sm font-bold text-[#1a6b2f] tabular-nums mb-2">{fmt(p.valor_venda)}</p>
                            )}

                            {/* Footer: bolinhas de preenchimento + avançar */}
                            <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                              {/* 3 bolinhas — azul = aba preenchida, cinza = falta preencher */}
                              <div className="flex items-center gap-1">
                                <div className={cn(
                                  "h-2.5 w-2.5 rounded-full transition-colors",
                                  infoOk ? "bg-blue-500" : "bg-gray-200"
                                )} title="Informações" />
                                <div className={cn(
                                  "h-2.5 w-2.5 rounded-full transition-colors",
                                  aquisOk ? "bg-blue-500" : "bg-gray-200"
                                )} title="Aquisição" />
                                <div className={cn(
                                  "h-2.5 w-2.5 rounded-full transition-colors",
                                  tarefOk ? "bg-blue-500" : "bg-gray-200"
                                )} title="Tarefas" />
                              </div>
                              {prox && (
                                <button
                                  onClick={e => { e.stopPropagation(); moverEtapa(p, prox); }}
                                  disabled={atualizandoEtapa === p.id}
                                  className="flex items-center gap-0.5 rounded-full bg-[#1a6b2f]/8 px-2 py-0.5 text-[9px] font-semibold text-[#1a6b2f] hover:bg-[#1a6b2f]/15 disabled:opacity-40 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  {atualizandoEtapa === p.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ChevronRight className="h-2.5 w-2.5" />}
                                  Avançar
                                </button>
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
            )} {/* fim viewPedidos === "kanban" */}

            {/* ── Vista Lista ── */}
            {viewPedidos === "lista" && (
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {/* Cabeçalho da tabela */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-gray-100 px-4 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cliente</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Etapa</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Valor</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Tipo</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Check</span>
                </div>

                {carregandoPedLog ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                  </div>
                ) : pedidosLog.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-300">Nenhum pedido ativo</div>
                ) : (
                  ETAPAS.map(etapa => {
                    const grupo = pedidosLog.filter(p => p.etapa === etapa.key);
                    if (grupo.length === 0) return null;
                    return (
                      <div key={etapa.key}>
                        {/* Separador de etapa */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 border-b border-gray-100">
                          <span className={cn("h-2 w-2 rounded-full flex-shrink-0", etapa.dot)} />
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{etapa.label}</span>
                          <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold", etapa.pill)}>{grupo.length}</span>
                        </div>
                        {grupo.map((p, i) => {
                          const cliente = p.cliente_empresa || p.cliente_nome || "—";
                          const tipo = p.tipo_servico === "manutencao" ? "Manut." : "Orç.";
                          const dias = Math.floor((Date.now() - new Date(p.criado_em).getTime()) / 86_400_000);
                          const prog = progressoCards[p.id];
                          const infoOk  = prog?.info      ?? false;
                          const aquisOk = prog?.aquisicao ?? false;
                          const tarefOk = prog?.tarefas   ?? false;
                          return (
                            <div
                              key={p.id}
                              onClick={() => abrirPedido(p)}
                              className={cn(
                                "grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors",
                                i < grupo.length - 1 && "border-b border-gray-50"
                              )}
                            >
                              {/* Cliente */}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{cliente}</p>
                                <p className="text-[10px] text-gray-400">{dias === 0 ? "hoje" : `há ${dias}d`}</p>
                              </div>
                              {/* Etapa */}
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium w-fit", etapa.pill)}>
                                {etapa.label}
                              </span>
                              {/* Valor */}
                              <span className={cn("text-sm font-semibold tabular-nums", p.valor_venda ? "text-[#1a6b2f]" : "text-gray-300")}>
                                {fmt(p.valor_venda)}
                              </span>
                              {/* Tipo */}
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 w-fit">
                                {tipo}
                              </span>
                              {/* 3 bolinhas */}
                              <div className="flex items-center gap-1">
                                <div className={cn("h-2.5 w-2.5 rounded-full", infoOk  ? "bg-blue-500" : "bg-gray-200")} title="Informações" />
                                <div className={cn("h-2.5 w-2.5 rounded-full", aquisOk ? "bg-blue-500" : "bg-gray-200")} title="Aquisição" />
                                <div className={cn("h-2.5 w-2.5 rounded-full", tarefOk ? "bg-blue-500" : "bg-gray-200")} title="Tarefas" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Painel lateral do card */}
            {pedidoAberto && (
              <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={e => e.target === e.currentTarget && setPedidoAberto(null)}>
                <div className="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
                    <div>
                      <p className="font-semibold text-gray-900">{pedidoAberto.cliente_empresa || pedidoAberto.cliente_nome || "Pedido"}</p>
                      <p className="text-xs text-gray-400">{pedidoAberto.tipo_servico === "manutencao" ? "Manutenção" : "Orçamento"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => excluirPedido(pedidoAberto)}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir pedido (somente administradores)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      )}
                      <button onClick={() => setPedidoAberto(null)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                    </div>
                  </div>

                  {/* Abas internas */}
                  <div className="flex border-b border-gray-100 shrink-0">
                    {([{ key: "info", label: "Informações" }, { key: "aquisicao", label: "Aquisição" }, { key: "tarefas", label: "Tarefas" }] as const).map(t => {
                      // Último check desta aba (checked = true significa "ok, revisado")
                      const ultimoCheck = checksAbas
                        .filter(c => c.aba === t.key)
                        .sort((a, b) => new Date(b.checked_em).getTime() - new Date(a.checked_em).getTime())[0];
                      const estaChecked = ultimoCheck?.checked === true;
                      const carregandoEsteCheck = salvandoCheck === t.key;

                      return (
                      <div key={t.key} className="flex items-stretch">
                        {/* Botão de check clicável — separado do label */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleCheckAba(t.key); }}
                          disabled={!!carregandoEsteCheck}
                          title={estaChecked ? "Marcar como pendente" : "Marcar aba como revisada"}
                          className={cn(
                            "flex items-center justify-center pl-3 pr-1 py-2.5 transition-colors group/check",
                            abaPedido === t.key ? "text-[#1a6b2f]" : "text-gray-300 hover:text-gray-500"
                          )}
                        >
                          <span className={cn(
                            "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all",
                            estaChecked
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300 bg-white group-hover/check:border-blue-300",
                            carregandoEsteCheck && "opacity-50"
                          )}>
                            {estaChecked && (
                              <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 8 8">
                                <path d="M1.5 4L3.5 6L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                        </button>

                        {/* Label da aba — abre a aba */}
                        <button
                          onClick={() => setAbaPedido(t.key)}
                          className={cn(
                            "flex items-center gap-1.5 pr-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                            abaPedido === t.key ? "border-[#1a6b2f] text-[#1a6b2f]" : "border-transparent text-gray-400 hover:text-gray-700"
                          )}
                        >
                          {t.key === "aquisicao" && aquisicoes.filter(a => a.status === "pendente").length > 0 && (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                              {aquisicoes.filter(a => a.status === "pendente").length}
                            </span>
                          )}
                          {t.key === "tarefas" && tarefas.length > 0 && (() => {
                            const done = tarefas.filter(x => x.concluida).length;
                            const pct = Math.round((done / tarefas.length) * 100);
                            return (
                              <span className={cn(
                                "inline-flex h-4 items-center justify-center rounded-full px-1.5 text-[9px] font-bold",
                                pct === 100 ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-700"
                              )}>
                                {pct}%
                              </span>
                            );
                          })()}
                          {t.label}
                        </button>
                      </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* ─ ABA INFORMAÇÕES ─ */}
                    {abaPedido === "info" && (
                      <>
                        {/* Etapa + cobrança */}
                        <div className="flex gap-3">
                          <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Etapa</p>
                            <select
                              value={pedidoAberto.etapa}
                              onChange={e => moverEtapa(pedidoAberto, e.target.value as EtapaLogistica)}
                              className="text-sm font-semibold text-gray-800 bg-transparent w-full outline-none"
                            >
                              {(["tratamento","aguard_material","aguard_cobranca","em_execucao","concluido","cancelado"] as EtapaLogistica[]).map(e => (
                                <option key={e} value={e}>{
                                  { tratamento:"Tratamento", aguard_material:"Aguard. Material",
                                    aguard_cobranca:"Aguard. Cobrança", em_execucao:"Em Execução",
                                    concluido:"Concluído", cancelado:"Cancelado" }[e]
                                }</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Tipo de Cobrança</p>
                            <select
                              value={pedidoAberto.tipo_cobranca}
                              onChange={async e => {
                                const tc = e.target.value as TipoCobranca;
                                await supabase.from("logistica_pedidos").update({ tipo_cobranca: tc }).eq("id", pedidoAberto.id);
                                setPedidoAberto(p => p ? { ...p, tipo_cobranca: tc } : p);
                                setPedidosLog(ps => ps.map(p => p.id === pedidoAberto.id ? { ...p, tipo_cobranca: tc } : p));
                              }}
                              className="text-sm font-semibold text-gray-800 bg-transparent w-full outline-none"
                            >
                              <option value="antes">Cobrar antes</option>
                              <option value="apos">Cobrar após</option>
                              <option value="sem_cobranca">Sem cobrança</option>
                            </select>
                          </div>
                        </div>

                        {/* Classificação operacional */}
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Classificação operacional</p>
                          <div className="flex gap-2">
                            {(["instalacao", "fornecimento"] as const).map(op => {
                              const ativo = (pedidoAberto.classificacao_op ?? "instalacao") === op;
                              return (
                                <button
                                  key={op}
                                  onClick={async () => {
                                    await supabase.from("logistica_pedidos").update({ classificacao_op: op }).eq("id", pedidoAberto.id);
                                    setPedidoAberto(p => p ? { ...p, classificacao_op: op } : p);
                                    setPedidosLog(ps => ps.map(p => p.id === pedidoAberto.id ? { ...p, classificacao_op: op } : p));
                                  }}
                                  className={cn(
                                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                                    ativo
                                      ? "border-[#1a6b2f] bg-[#1a6b2f]/10 text-[#1a6b2f]"
                                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                  )}
                                >
                                  {op === "instalacao" ? "🔧 Com instalação" : "📦 Apenas fornecimento"}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Status de compra + cobrança */}
                        {(() => {
                          const compraItens = aquisicoes;
                          const totalItens = compraItens.length;
                          const recebidos = compraItens.filter(a => a.status === "recebido").length;
                          const pedidos   = compraItens.filter(a => a.status === "pedido").length;
                          const pendentes = compraItens.filter(a => a.status === "pendente").length;
                          const compraLabel = totalItens === 0 ? null
                            : recebidos === totalItens ? { label: "Tudo recebido", cls: "bg-emerald-100 text-emerald-700" }
                            : pedidos + recebidos === totalItens ? { label: "Pedido realizado", cls: "bg-blue-100 text-blue-700" }
                            : pendentes === totalItens ? { label: "Aguard. compra", cls: "bg-orange-100 text-orange-700" }
                            : { label: `${recebidos}/${totalItens} recebidos`, cls: "bg-yellow-100 text-yellow-700" };
                          const cobLabel: Record<StatusCobranca, { label: string; cls: string }> = {
                            aguardando:     { label: "Aguard. cobrança", cls: "bg-orange-100 text-orange-700" },
                            cobrado_parcial:{ label: "Cobrado parcial",  cls: "bg-yellow-100 text-yellow-700" },
                            cobrado_total:  { label: "Cobrado",          cls: "bg-emerald-100 text-emerald-700" },
                          };
                          const cobInfo = pedidoAberto.status_cobranca ? cobLabel[pedidoAberto.status_cobranca] : null;
                          if (!compraLabel && !cobInfo) return null;
                          return (
                            <div className="flex gap-3">
                              {compraLabel && totalItens > 0 && (
                                <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Status de Compra</p>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", compraLabel.cls)}>{compraLabel.label}</span>
                                    <span className="text-[10px] text-gray-400">{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
                                  </div>
                                </div>
                              )}
                              {cobInfo && (
                                <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Status de Cobrança</p>
                                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cobInfo.cls)}>{cobInfo.label}</span>
                                  <p className="text-[9px] text-gray-400 mt-1">Gerenciado em Financeiro</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Valores */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Valor Venda</p>
                            <p className="text-sm font-bold text-[#1a6b2f]">{fmt(pedidoAberto.valor_venda)}</p>
                          </div>
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Custo Est.</p>
                            <p className="text-sm font-bold text-gray-700">{fmt(pedidoAberto.custo_estimado)}</p>
                          </div>
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Margem</p>
                            <p className="text-sm font-bold text-emerald-600">{pedidoAberto.margem_pct != null ? `${pedidoAberto.margem_pct.toFixed(1)}%` : "—"}</p>
                          </div>
                        </div>

                        {/* Escopo do pedido fechado */}
                        {(pedidoAberto.tipo_servico || pedidoAberto.portas != null || pedidoAberto.parcela_mensal != null) && (
                          <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Escopo Fechado</p>
                            <div className="space-y-2 text-sm">
                              {pedidoAberto.tipo_servico && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Tipo</span>
                                  <span className="font-medium text-gray-800 capitalize">
                                    {pedidoAberto.tipo_servico === "manutencao" ? "Manutenção 12×" : pedidoAberto.tipo_servico === "orcamento" ? "Orçamento" : pedidoAberto.tipo_servico}
                                  </span>
                                </div>
                              )}
                              {pedidoAberto.portas != null && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Portas</span>
                                  <span className="font-bold text-gray-900">{pedidoAberto.portas} portas</span>
                                </div>
                              )}
                              {pedidoAberto.parcela_mensal != null && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Parcela mensal</span>
                                  <span className="font-bold text-[#1a6b2f]">{fmt(pedidoAberto.parcela_mensal)}/mês</span>
                                </div>
                              )}
                              {pedidoAberto.portas != null && pedidoAberto.parcela_mensal != null && (
                                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                                  <span className="text-gray-400">Valor total 12×</span>
                                  <span className="font-semibold text-gray-700">{fmt(pedidoAberto.parcela_mensal * 12)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dados do cliente */}
                        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cliente</p>
                          <div className="space-y-1.5 text-sm">
                            {pedidoAberto.cliente_nome && (
                              <div className="flex items-center gap-2 text-gray-700"><User className="h-3.5 w-3.5 text-gray-400 shrink-0" />{pedidoAberto.cliente_nome}</div>
                            )}
                            {pedidoAberto.cliente_empresa && (
                              <div className="flex items-center gap-2 text-gray-700"><Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />{pedidoAberto.cliente_empresa}</div>
                            )}
                            {pedidoAberto.cliente_telefone && (
                              <div className="flex items-center gap-2 text-gray-700"><Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />{pedidoAberto.cliente_telefone}</div>
                            )}
                            {pedidoAberto.cliente_email && (
                              <div className="flex items-center gap-2 text-gray-700"><Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />{pedidoAberto.cliente_email}</div>
                            )}
                            {pedidoAberto.cliente_endereco && (
                              <div className="flex items-center gap-2 text-gray-700"><MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />{pedidoAberto.cliente_endereco}</div>
                            )}
                          </div>
                        </div>

                        {/* Ticket info */}
                        {pedidoAberto.is_ticket && (
                          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white tracking-wide">🎫 TICKET EMERGENCIAL</span>
                              {pedidoAberto.ticket_sla_at && (() => {
                                const diff = new Date(pedidoAberto.ticket_sla_at!).getTime() - Date.now();
                                const expired = diff < 0;
                                const daysLeft = Math.ceil(diff / 86_400_000);
                                return (
                                  <span className={cn("text-xs font-bold", expired ? "text-red-700 animate-pulse" : "text-red-600")}>
                                    {expired ? "⚠ SLA vencido" : daysLeft === 0 ? "Vence hoje" : `${daysLeft}d p/ SLA`}
                                  </span>
                                );
                              })()}
                            </div>
                            {pedidoAberto.ticket_motivo && (
                              <p className="text-sm text-red-900 whitespace-pre-wrap">{pedidoAberto.ticket_motivo}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-red-800">
                              {pedidoAberto.ticket_prioridade && (
                                <span>Prioridade: <strong>{pedidoAberto.ticket_prioridade === "alta" ? "Alta" : pedidoAberto.ticket_prioridade === "media" ? "Média" : "Baixa"}</strong></span>
                              )}
                              {pedidoAberto.ticket_contato_nome && (
                                <span>Contato: <strong>{pedidoAberto.ticket_contato_nome}</strong></span>
                              )}
                              {pedidoAberto.ticket_contato_tel && (
                                <span>Tel: <strong>{pedidoAberto.ticket_contato_tel}</strong></span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Obs do CRM */}
                        {pedidoAberto.observacoes_crm && (
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Observações do CRM</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{pedidoAberto.observacoes_crm}</p>
                          </div>
                        )}

                        {/* Link CRM */}
                        {pedidoAberto.crm_lead_id && (
                          <a
                            href={`/painel/crm?lead=${pedidoAberto.crm_lead_id}`}
                            className="flex items-center gap-1.5 text-xs text-[#1a6b2f] hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Ver lead no CRM
                          </a>
                        )}

                        {/* ─ CERTIFICADO DE GARANTIA — só quando concluído ─ */}
                        {pedidoAberto.etapa === "concluido" && (
                          <div className="rounded-xl border border-[#1a6b2f]/20 bg-[#f0faf4] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <FileCheck className="h-4 w-4 text-[#1a6b2f]" />
                              <p className="text-sm font-semibold text-[#1a6b2f]">Emitir Documentos de Garantia</p>
                            </div>
                            <p className="text-xs text-gray-500">Serviço concluído. Gere o certificado NBR 11.742:2018 (6 meses de cobertura) e o manual de boas práticas para o cliente.</p>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                disabled={emitindoCert}
                                onClick={async () => {
                                  setEmitindoCert(true);
                                  try {
                                    await carregarPdfMakeLog();
                                    const logoB64 = await carregarLogoPortibras();
                                    gerarCertificadoPdf(pedidoAberto, aquisicoes, logoB64);
                                    // Registra renovação automática (vence em 6 meses)
                                    const hoje = new Date();
                                    const vence = new Date(hoje);
                                    vence.setMonth(vence.getMonth() + 6);
                                    const toDate = (d: Date) => d.toISOString().slice(0, 10);
                                    await supabase.from("crm_renovacoes").insert({
                                      pedido_id: pedidoAberto.id,
                                      cliente_nome: pedidoAberto.cliente_nome ?? null,
                                      cliente_empresa: pedidoAberto.cliente_empresa ?? null,
                                      cliente_telefone: pedidoAberto.cliente_telefone ?? null,
                                      cliente_email: pedidoAberto.cliente_email ?? null,
                                      cliente_endereco: pedidoAberto.cliente_endereco ?? null,
                                      emitido_em: toDate(hoje),
                                      vence_em: toDate(vence),
                                      status: "pendente",
                                    });
                                  } catch(err) { console.error("[Cert] erro:", err); alert("Erro ao gerar PDF: " + String(err)); }
                                  finally { setEmitindoCert(false); }
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f] px-3 py-2 text-xs font-medium text-white hover:bg-[#155a26] disabled:opacity-60 transition-colors"
                              >
                                {emitindoCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                                Certificado de Garantia
                              </button>
                              <button
                                disabled={emitindoCert}
                                onClick={async () => {
                                  setEmitindoCert(true);
                                  try {
                                    await carregarPdfMakeLog();
                                    const logoB64m = await carregarLogoPortibras();
                                    gerarManualPdf(pedidoAberto, logoB64m);
                                  } catch(err) { console.error("[Manual] erro:", err); alert("Erro ao gerar PDF: " + String(err)); }
                                  finally { setEmitindoCert(false); }
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-[#1a6b2f] px-3 py-2 text-xs font-medium text-[#1a6b2f] hover:bg-[#1a6b2f]/10 disabled:opacity-60 transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Manual de Boas Práticas
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ─ LOG DE REVISÕES ─ */}
                        {checksAbas.length > 0 && (
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Histórico de revisões</p>
                            <div className="space-y-2">
                              {checksAbas.slice(0, 10).map(c => {
                                const abaLabel = { info: "Informações", aquisicao: "Aquisição", tarefas: "Tarefas" }[c.aba];
                                const data = new Date(c.checked_em);
                                const dataFmt = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                                const horaFmt = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                                return (
                                  <div key={c.id} className="flex items-center gap-2.5 text-xs text-gray-600">
                                    <span className={cn(
                                      "h-2 w-2 rounded-full flex-shrink-0",
                                      c.checked ? "bg-blue-500" : "bg-gray-300"
                                    )} />
                                    <span className="font-medium text-gray-800">{abaLabel}</span>
                                    <span className={cn(
                                      "text-[10px] rounded-full px-1.5 py-0.5 font-medium",
                                      c.checked ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                                    )}>
                                      {c.checked ? "revisada" : "desmarcada"}
                                    </span>
                                    <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{dataFmt} {horaFmt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ─ ABA AQUISIÇÃO ─ */}
                    {abaPedido === "aquisicao" && (
                      <>
                        <p className="text-xs text-gray-400">Peças e materiais que precisam ser comprados para este pedido.</p>

                        {/* Lista de itens */}
                        {carregandoAquis ? (
                          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
                        ) : aquisicoes.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-300">
                            Nenhuma peça lançada ainda
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {aquisicoes.map(a => (
                              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium text-gray-900 truncate">{a.nome}</p>
                                    <span className="text-xs text-gray-400">{a.quantidade} {a.unidade}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-400">
                                    {a.custo_unitario != null && <span>{fmt(a.custo_unitario)}/un</span>}
                                    {a.fornecedor && <span>{a.fornecedor}</span>}
                                    {a.link_compra && <a href={a.link_compra} target="_blank" rel="noopener noreferrer" className="text-[#1a6b2f] hover:underline flex items-center gap-0.5"><ExternalLink className="h-3 w-3" />Link</a>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Status somente leitura — alterado em Compras > Materiais a Comprar */}
                                  <span className={cn(
                                    "text-[10px] font-semibold rounded-full px-2.5 py-0.5",
                                    a.status === "pendente" ? "bg-orange-100 text-orange-700"
                                      : a.status === "pedido" ? "bg-blue-100 text-blue-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  )}>
                                    {a.status === "pendente" ? "Pendente" : a.status === "pedido" ? "Pedido" : "Recebido"}
                                  </span>
                                  <button onClick={() => removerAquisicao(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Formulário novo item — baseado no Catálogo */}
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Adicionar peça</p>

                          {/* Seletor do catálogo */}
                          <div className="relative">
                            <div
                              className={cn(
                                "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 cursor-pointer",
                                supAquisAberto ? "border-[#1a6b2f] ring-1 ring-[#1a6b2f]/20" : "border-gray-200"
                              )}
                              onClick={() => { setSupAquisAberto(o => !o); setBuscaSupAquis(""); }}
                            >
                              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              {supSelecionado ? (
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-900">{supSelecionado.nome}</span>
                                  <span className="ml-2 text-[10px] text-gray-400">{supSelecionado.codigo}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 flex-1">Buscar no catálogo…</span>
                              )}
                              {supSelecionado && (
                                <button onClick={e => { e.stopPropagation(); setSupSelecionado(null); setFormAquis(f => ({ ...f, nome: "", unidade: "un", custo_unitario: "", link_compra: "" })); }} className="text-gray-300 hover:text-gray-500">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {supAquisAberto && (
                              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                                <div className="p-2 border-b border-gray-100">
                                  <input
                                    autoFocus
                                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#1a6b2f]"
                                    placeholder="Buscar por nome ou código…"
                                    value={buscaSupAquis}
                                    onChange={e => setBuscaSupAquis(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                  {suprimentos
                                    .filter(s => {
                                      const q = buscaSupAquis.toLowerCase();
                                      return !q || s.nome.toLowerCase().includes(q) || s.codigo?.toLowerCase().includes(q) || s.categoria?.toLowerCase().includes(q);
                                    })
                                    .map(s => (
                                      <button
                                        key={s.id}
                                        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                                        onClick={() => {
                                          setSupSelecionado(s);
                                          setFormAquis(f => ({
                                            ...f,
                                            nome: s.nome,
                                            unidade: s.unidade || "un",
                                            custo_unitario: s.custo_unitario ? String(s.custo_unitario) : "",
                                            link_compra: s.link_compra || "",
                                          }));
                                          setSupAquisAberto(false);
                                        }}
                                      >
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{s.nome}</p>
                                          <p className="text-[10px] text-gray-400">{s.codigo} · {s.categoria}</p>
                                        </div>
                                        {s.custo_unitario > 0 && (
                                          <span className="shrink-0 text-xs font-semibold text-[#1a6b2f]">
                                            R$ {s.custo_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  {suprimentos.filter(s => {
                                    const q = buscaSupAquis.toLowerCase();
                                    return !q || s.nome.toLowerCase().includes(q) || s.codigo?.toLowerCase().includes(q);
                                  }).length === 0 && (
                                    <p className="px-3 py-4 text-center text-xs text-gray-400">Nenhum item encontrado</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quantidade + unidade (sempre visível após seleção) */}
                          {supSelecionado && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 mb-1 block">Quantidade</label>
                                  <input className="input-field text-sm" type="number" min="1" step="any" value={formAquis.quantidade} onChange={e => setFormAquis(f => ({ ...f, quantidade: e.target.value }))} />
                                </div>
                                <div className="w-20">
                                  <label className="text-[10px] text-gray-400 mb-1 block">Unidade</label>
                                  <input className="input-field text-sm" value={formAquis.unidade} onChange={e => setFormAquis(f => ({ ...f, unidade: e.target.value }))} />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 mb-1 block">Custo unit. (R$)</label>
                                  <input className="input-field text-sm" value={formAquis.custo_unitario} onChange={e => setFormAquis(f => ({ ...f, custo_unitario: e.target.value }))} />
                                </div>
                              </div>
                              {formAquis.custo_unitario && parseFloat(formAquis.custo_unitario) > 0 && (
                                <p className="text-[11px] text-[#1a6b2f] font-semibold">
                                  Total: R$ {(parseFloat(formAquis.custo_unitario.replace(",", ".")) * (parseFloat(formAquis.quantidade) || 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                          )}

                          <button
                            onClick={salvarAquisicao}
                            disabled={salvandoAquis || !formAquis.nome.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-[#1a6b2f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155824] disabled:opacity-40 transition-colors"
                          >
                            {salvandoAquis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Adicionar
                          </button>
                        </div>
                      </>
                    )}

                    {/* ─ ABA TAREFAS ─ */}
                    {abaPedido === "tarefas" && (() => {
                      // Sugestões geradas a partir das aquisições + tarefa fixa de cobrança
                      const descricoesCadastradas = new Set(tarefas.map(t => t.descricao));
                      // "Com instalação" → Instalar; "Apenas fornecimento" → Entregar
                      const isInstalacao = (pedidoAberto.classificacao_op ?? "instalacao") === "instalacao";
                      const sugestoes: { descricao: string; icone: string; cor: string }[] = [
                        { descricao: "Adquirir materiais", icone: "🛒", cor: "blue" },
                        ...aquisicoes.map(a => ({
                          descricao: isInstalacao ? `Instalar: ${a.nome}` : `Entregar: ${a.nome}`,
                          icone: isInstalacao ? "🔧" : "📦",
                          cor: isInstalacao ? "orange" : "purple",
                        })),
                        { descricao: "Realizar cobrança", icone: "💰", cor: "emerald" },
                      ].filter(s => !descricoesCadastradas.has(s.descricao));

                      const done = tarefas.filter(t => t.concluida).length;
                      const pct = tarefas.length > 0 ? Math.round((done / tarefas.length) * 100) : 0;

                      return (
                        <>
                          {/* Barra de progresso */}
                          {tarefas.length > 0 && (
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-600">Progresso de entrega</span>
                                <span className={cn(
                                  "text-sm font-bold",
                                  pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-blue-600" : "text-orange-500"
                                )}>{pct}%</span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-orange-400"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="mt-1.5 text-[10px] text-gray-400">{done} de {tarefas.length} {tarefas.length === 1 ? "tarefa concluída" : "tarefas concluídas"}</p>
                            </div>
                          )}

                          {/* Lista de tarefas cadastradas */}
                          {carregandoTarefas ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                            </div>
                          ) : tarefas.length > 0 && (
                            <div className="space-y-1.5">
                              {tarefas.map(t => (
                                <div
                                  key={t.id}
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                                    t.concluida
                                      ? "border-emerald-100 bg-emerald-50/60"
                                      : "border-gray-100 bg-white hover:bg-gray-50/50"
                                  )}
                                >
                                  <button
                                    onClick={() => toggleTarefa(t)}
                                    className={cn(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                      t.concluida
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-gray-300 hover:border-emerald-400"
                                    )}
                                  >
                                    {t.concluida && <Check className="h-3 w-3" />}
                                  </button>
                                  <span className={cn(
                                    "flex-1 text-sm",
                                    t.concluida ? "text-gray-400 line-through" : "text-gray-800"
                                  )}>
                                    {t.descricao}
                                  </span>
                                  {t.concluida && t.concluida_em && (
                                    <span className="text-[10px] text-emerald-500 shrink-0">
                                      {new Date(t.concluida_em).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => excluirTarefa(t.id)}
                                    className="shrink-0 rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Sugestões a adicionar */}
                          {sugestoes.length > 0 && (
                            <div className="space-y-1.5">
                              {tarefas.length === 0 && !carregandoTarefas && (
                                <p className="text-xs text-gray-400 mb-2">Escolha as tarefas deste pedido:</p>
                              )}
                              {tarefas.length > 0 && (
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 mt-1 mb-1.5">Adicionar à lista</p>
                              )}
                              {sugestoes.map(s => (
                                <button
                                  key={s.descricao}
                                  onClick={() => {
                                    setNovaTarefa(s.descricao);
                                    // dispara imediatamente
                                    if (!pedidoAberto) return;
                                    setSalvandoTarefa(true);
                                    const maxOrdem = tarefas.length > 0 ? Math.max(...tarefas.map(t => t.ordem)) + 1 : 0;
                                    supabase.from("logistica_tarefas").insert({
                                      pedido_id: pedidoAberto.id,
                                      descricao: s.descricao,
                                      concluida: false,
                                      ordem: maxOrdem,
                                    }).select().single().then(({ data }) => {
                                      if (data) setTarefas(ts => [...ts, data as TarefaPedido]);
                                      setSalvandoTarefa(false);
                                      setNovaTarefa("");
                                    });
                                  }}
                                  disabled={salvandoTarefa}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-sm text-left transition-colors disabled:opacity-40",
                                    s.cor === "blue"    && "border-blue-200 text-blue-600 hover:bg-blue-50",
                                    s.cor === "orange"  && "border-orange-200 text-orange-600 hover:bg-orange-50",
                                    s.cor === "emerald" && "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
                                  )}
                                >
                                  <span>{s.icone}</span>
                                  <span className="flex-1">{s.descricao}</span>
                                  <Plus className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                </button>
                              ))}
                            </div>
                          )}

                          {tarefas.length === 0 && sugestoes.length === 0 && !carregandoTarefas && (
                            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-300">
                              Nenhuma tarefa ainda
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ═══════ ABA ATENDIMENTOS ═══════ */}
      {aba === "atendimentos" && (
        <>
          {/* ── Tickets em Aberto ── */}
          {ticketsAbertos.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold text-gray-700">Tickets em Aberto</h2>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{ticketsAbertos.length}</span>
              </div>
              <div className="space-y-2">
                {ticketsAbertos.map(t => {
                  const slaAt = t.ticket_sla_at ? new Date(t.ticket_sla_at) : null;
                  const slaExpired = slaAt ? slaAt < new Date() : false;
                  const slaDias = slaAt ? Math.ceil((slaAt.getTime() - Date.now()) / 86_400_000) : null;
                  return (
                    <div key={t.id} className={cn(
                      "rounded-xl border-2 p-4 flex items-start justify-between gap-4",
                      slaExpired ? "border-red-400 bg-red-50" : "border-orange-200 bg-orange-50"
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900">{t.cliente_empresa || t.cliente_nome || "—"}</span>
                          {t.ticket_prioridade && (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                              t.ticket_prioridade === "alta" ? "bg-red-200 text-red-800" :
                              t.ticket_prioridade === "media" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"
                            )}>
                              {t.ticket_prioridade === "alta" ? "🔴 Alta" : t.ticket_prioridade === "media" ? "🟡 Média" : "⚪ Baixa"}
                            </span>
                          )}
                          {slaAt && (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              slaExpired ? "bg-red-600 text-white" : slaDias! <= 1 ? "bg-orange-200 text-orange-800" : "bg-green-100 text-green-700"
                            )}>
                              {slaExpired ? "⚠️ SLA vencido" : slaDias === 0 ? "Vence hoje" : `${slaDias}d restante${slaDias !== 1 ? "s" : ""}`}
                            </span>
                          )}
                        </div>
                        {t.ticket_motivo && <p className="text-xs text-gray-600 truncate">{t.ticket_motivo}</p>}
                        {t.ticket_contato_nome && <p className="text-xs text-gray-500 mt-0.5">Contato: {t.ticket_contato_nome}{t.ticket_contato_tel ? ` · ${t.ticket_contato_tel}` : ""}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-gray-400">
                        <span>{new Date(t.criado_em).toLocaleDateString("pt-BR")}</span>
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                          {t.etapa === "tratamento" ? "Em tratamento" : t.etapa === "em_execucao" ? "Em execução" : t.etapa}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Sub-abas Lista / Calendário ── */}
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button onClick={() => setSubAbaAtend("lista")}
                className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  subAbaAtend === "lista" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                📋 Lista
              </button>
              <button onClick={() => setSubAbaAtend("calendario")}
                className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  subAbaAtend === "calendario" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                📅 Calendário
              </button>
            </div>
            <div className="flex items-center gap-2">
              {subAbaAtend === "lista" && (
                <div className="flex gap-1.5 flex-wrap">
                  {["todos", "Programado", "Em andamento", "Concluído", "Cancelado"].map(s => (
                    <button key={s} onClick={() => setFiltroStatusAtend(s)}
                      className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        filtroStatusAtend === s ? "bg-[#1a6b2f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                      {s === "todos" ? "Todos" : s}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setModalFeedUrl(true)}
                title="Sincronizar com Google Agenda / iCal"
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                <CalendarIcon className="h-4 w-4" /> Google Agenda
              </button>
              <button onClick={() => abrirModalAtend()}
                className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
                <Plus className="h-4 w-4" /> Novo Atendimento
              </button>
            </div>
          </div>

          {/* ── Calendário ── */}
          {subAbaAtend === "calendario" && (() => {
            const { ano, mes } = calMes;
            const primeiroDia = new Date(ano, mes, 1);
            const ultimoDia = new Date(ano, mes + 1, 0);
            const inicioGrade = new Date(primeiroDia);
            const dow0 = inicioGrade.getDay(); // 0=dom
            inicioGrade.setDate(inicioGrade.getDate() - (dow0 === 0 ? 6 : dow0 - 1));
            const nomeMes = primeiroDia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const semanas: Date[][] = [];
            let cur = new Date(inicioGrade);
            while (cur <= ultimoDia || semanas.length < 5) {
              const sem: Date[] = [];
              for (let d = 0; d < 7; d++) { sem.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
              semanas.push(sem);
              if (cur > ultimoDia && semanas.length >= 4) break;
            }
            const atendPorDia = (dia: Date) => atendimentos.filter(a => {
              if (!a.data_agendada) return false;
              const ad = new Date(a.data_agendada + "T00:00:00");
              return ad.toDateString() === dia.toDateString();
            });
            return (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Navegação */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <button onClick={() => setCalMes(c => { const d = new Date(c.ano, c.mes - 1); return { ano: d.getFullYear(), mes: d.getMonth() }; })}
                    className="rounded-lg p-1.5 hover:bg-gray-200 text-gray-500">‹</button>
                  <h3 className="text-sm font-semibold text-gray-800 capitalize">{nomeMes}</h3>
                  <button onClick={() => setCalMes(c => { const d = new Date(c.ano, c.mes + 1); return { ano: d.getFullYear(), mes: d.getMonth() }; })}
                    className="rounded-lg p-1.5 hover:bg-gray-200 text-gray-500">›</button>
                </div>
                {/* Cabeçalho dias */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
                    <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
                  ))}
                </div>
                {/* Semanas */}
                {semanas.map((sem, si) => (
                  <div key={si} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                    {sem.map((dia, di) => {
                      const eMes = dia.getMonth() === mes;
                      const eHoje = dia.toDateString() === hoje.toDateString();
                      const eventos = atendPorDia(dia);
                      return (
                        <div key={di} className={cn(
                          "min-h-[80px] p-1.5 border-r border-gray-100 last:border-r-0",
                          !eMes && "bg-gray-50/60",
                          eHoje && "bg-green-50"
                        )}>
                          <div className={cn(
                            "h-6 w-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1",
                            eHoje ? "bg-[#1a6b2f] text-white" : eMes ? "text-gray-700" : "text-gray-300"
                          )}>{dia.getDate()}</div>
                          <div className="space-y-0.5">
                            {eventos.slice(0, 3).map(a => (
                              <div key={a.id} title={a.titulo}
                                onClick={e => { e.stopPropagation(); setCalEventoPopup(a); }}
                                className={cn("rounded px-1 py-0.5 text-[9px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity",
                                  a.status === "Concluído" ? "bg-green-100 text-green-700" :
                                  a.status === "Em andamento" ? "bg-yellow-100 text-yellow-700" :
                                  a.status === "Cancelado" ? "bg-gray-100 text-gray-400" :
                                  CLASS_COR[a.classificacao] ?? "bg-blue-100 text-blue-700"
                                )}>
                                {a.hora_inicio ? `${a.hora_inicio} ` : ""}{a.titulo}
                              </div>
                            ))}
                            {eventos.length > 3 && (
                              <div className="text-[9px] text-gray-400 pl-1">+{eventos.length - 3} mais</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* Legenda */}
                <div className="flex items-center gap-4 flex-wrap px-4 py-3 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500">
                  {Object.entries(CLASS_COR).map(([k, v]) => (
                    <span key={k} className={cn("rounded px-1.5 py-0.5 font-medium", v)}>{k}</span>
                  ))}
                  <span className="ml-auto text-gray-400">{atendimentos.filter(a => a.data_agendada).length} agendados no total</span>
                </div>
              </div>
            );
          })()}

          {/* ── Lista ── */}
          {subAbaAtend === "lista" && (
          <>
          {carregandoAtend ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <div className="space-y-3">
              {atendimentos
                .filter(a => filtroStatusAtend === "todos" || a.status === filtroStatusAtend)
                .map(atend => (
                  <div key={atend.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{atend.titulo}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border", STATUS_ATEND_COR[atend.status])}>
                              {atend.status}
                            </span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_COR[atend.classificacao])}>
                              {atend.classificacao}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            {atend.data_agendada && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(atend.data_agendada + "T00:00:00").toLocaleDateString("pt-BR")}
                                {atend.hora_inicio && ` ${atend.hora_inicio}`}
                              </span>
                            )}
                            {atend.responsaveis?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {atend.responsaveis.join(", ")}
                              </span>
                            )}
                            {atend.endereco && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {atend.endereco}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setAtendAberto(atendAberto === atend.id ? null : atend.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          {atendAberto === atend.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button onClick={() => abrirModalAtend(atend)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => {
                          const titulo = encodeURIComponent(atend.titulo);
                          const local = encodeURIComponent(atend.endereco ?? "");
                          const desc = encodeURIComponent(atend.descricao ?? "");
                          const base = atend.data_agendada ? new Date(atend.data_agendada + "T" + (atend.hora_inicio ?? "09:00") + ":00") : (() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d; })();
                          const fim = atend.hora_fim ? new Date(atend.data_agendada + "T" + atend.hora_fim + ":00") : new Date(base.getTime() + 3600000);
                          const fmt = (d: Date) => d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
                          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${fmt(base)}/${fmt(fim)}&location=${local}&details=${desc}`, "_blank");
                        }}
                          title="Abrir no Google Agenda"
                          className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600">
                          <CalendarIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => gerarIcal(atend)}
                          title="Exportar iCal (.ics)"
                          className="rounded-lg p-1.5 text-purple-400 hover:bg-purple-50 hover:text-purple-600">
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button onClick={() => excluirAtend(atend.id)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {atendAberto === atend.id && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                        {/* Status rápido */}
                        <div className="mb-3 flex gap-2 flex-wrap">
                          {(["Programado", "Em andamento", "Concluído", "Cancelado"] as Atendimento["status"][]).map(s => (
                            <button key={s} onClick={() => atualizarStatusAtend(atend.id, s)}
                              className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                atend.status === s ? STATUS_ATEND_COR[s] : "border-gray-200 text-gray-500 hover:border-gray-300")}>
                              {s}
                            </button>
                          ))}
                        </div>
                        {/* Flags */}
                        <div className="mb-3 flex gap-4 text-xs text-gray-500">
                          <span className={cn("flex items-center gap-1", atend.agendado_com_cliente ? "text-green-600 font-medium" : "")}>
                            {atend.agendado_com_cliente ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 inline-block rounded-full border border-gray-300" />}
                            Agendado com cliente
                          </span>
                          <span className={cn("flex items-center gap-1", atend.em_sistema ? "text-green-600 font-medium" : "")}>
                            {atend.em_sistema ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 inline-block rounded-full border border-gray-300" />}
                            Em sistema
                          </span>
                        </div>
                        {atend.atividade && <p className="mb-1 text-xs text-gray-600"><span className="font-medium">Atividade:</span> {atend.atividade}</p>}
                        {atend.descricao && <p className="text-xs text-gray-600"><span className="font-medium">Descrição:</span> {atend.descricao}</p>}
                        {/* Materiais deste atendimento */}
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">Materiais</span>
                            <button onClick={() => abrirModalMat(atend.id)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#1a6b2f] hover:bg-green-50">
                              <Plus className="h-3 w-3" /> Adicionar
                            </button>
                          </div>
                          {materiais.filter(m => m.atendimento_id === atend.id).length === 0 ? (
                            <p className="text-xs text-gray-400">Nenhum material cadastrado</p>
                          ) : (
                            <div className="space-y-1">
                              {materiais.filter(m => m.atendimento_id === atend.id).map(mat => (
                                <div key={mat.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                                  <div>
                                    <span className="text-xs font-medium text-gray-800">{mat.descricao}</span>
                                    <span className="ml-2 text-xs text-gray-500">{mat.quantidade} {mat.unidade}</span>
                                    {mat.fornecedor && <span className="ml-2 text-xs text-gray-400">— {mat.fornecedor}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_MAT_COR[mat.status])}>
                                      {mat.status}
                                    </span>
                                    <button onClick={() => excluirMat(mat.id)} className="text-red-400 hover:text-red-600">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {atendimentos.filter(a => filtroStatusAtend === "todos" || a.status === filtroStatusAtend).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                  Nenhum atendimento encontrado
                </div>
              )}
            </div>
          )}
          </>
          )}

          {/* ── Pedidos Fechados do CRM ── */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-700">Pedidos Fechados</h2>
              {carregandoPedidos ? (
                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {pedidosFechados.length}
                </span>
              )}
              <span className="text-xs text-gray-400">— contratos fechados no CRM</span>
            </div>

            {carregandoPedidos ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : pedidosFechados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                Nenhum pedido fechado ainda
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Proposta</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pedidosFechados.map(p => {
                      const clienteNome = p.lead?.empresa || p.lead?.nome || "—";
                      const valorMensal = p.conteudo?.parcela ?? null;
                      const dataFecho = p.atualizado_em
                        ? new Date(p.atualizado_em).toLocaleDateString("pt-BR")
                        : new Date(p.criado_em).toLocaleDateString("pt-BR");
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{clienteNome}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              p.tipo === "manutencao"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              {p.tipo === "manutencao" ? "Manutenção 12×" : "Orçamento"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-500 truncate max-w-[180px]">
                            {p.nome_arquivo || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {valorMensal ? (
                              <span className="text-sm font-semibold text-gray-800">
                                {valorMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                <span className="text-xs font-normal text-gray-400">/mês</span>
                              </span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{dataFecho}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <a
                                href={`/painel/crm?lead=${p.lead_id}`}
                                className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> CRM
                              </a>
                              {isAdmin && (
                                <button
                                  onClick={() => setExcluindoPedidoFechado(p)}
                                  className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                  title="Excluir registro"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal de confirmação — excluir pedido fechado */}
          {excluindoPedidoFechado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">Excluir registro</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Tem certeza que deseja excluir o registro de{" "}
                      <span className="font-semibold text-gray-800">
                        {excluindoPedidoFechado.lead?.empresa || excluindoPedidoFechado.lead?.nome || "este cliente"}
                      </span>?
                      Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                  <button
                    onClick={() => setExcluindoPedidoFechado(null)}
                    disabled={processandoExclusaoPF}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluirPedidoFechado}
                    disabled={processandoExclusaoPF}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {processandoExclusaoPF ? "Excluindo…" : "Excluir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Popup evento do calendário */}
          {calEventoPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCalEventoPopup(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{calEventoPopup.titulo}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border", STATUS_ATEND_COR[calEventoPopup.status])}>{calEventoPopup.status}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_COR[calEventoPopup.classificacao])}>{calEventoPopup.classificacao}</span>
                    </div>
                  </div>
                  <button onClick={() => setCalEventoPopup(null)} className="ml-2 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-5 py-4 space-y-2 text-sm text-gray-700">
                  {calEventoPopup.data_agendada && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{new Date(calEventoPopup.data_agendada + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
                    </div>
                  )}
                  {(calEventoPopup.hora_inicio || calEventoPopup.hora_fim) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{calEventoPopup.hora_inicio || "—"}{calEventoPopup.hora_fim ? ` → ${calEventoPopup.hora_fim}` : ""}</span>
                    </div>
                  )}
                  {calEventoPopup.endereco && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{calEventoPopup.endereco}</span>
                    </div>
                  )}
                  {calEventoPopup.responsaveis?.length > 0 && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{calEventoPopup.responsaveis.join(", ")}</span>
                    </div>
                  )}
                  {calEventoPopup.atividade && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-600">{calEventoPopup.atividade}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 px-5 pb-5">
                  <div className="flex gap-2">
                    <button onClick={() => { abrirModalAtend(calEventoPopup); setCalEventoPopup(null); }}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Pencil className="h-3.5 w-3.5 inline mr-1" /> Editar
                    </button>
                    <button onClick={() => setCalEventoPopup(null)}
                      className="flex-1 rounded-lg bg-[#1a6b2f] px-3 py-2 text-sm font-medium text-white hover:bg-[#155824]">
                      Fechar
                    </button>
                  </div>
                  {calEventoPopup.status !== "Concluído" && calEventoPopup.status !== "Cancelado" && (
                    <div className="flex gap-2">
                      <button onClick={() => { setModalConcluir(calEventoPopup); setCalEventoPopup(null); }}
                        className="flex-1 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
                        ✓ Concluir
                      </button>
                      <button onClick={() => { setModalCancelar(calEventoPopup); setCalEventoPopup(null); }}
                        className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
                        <Trash2 className="h-3.5 w-3.5 inline mr-1" /> Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Confirmar Cancelamento */}
          {modalCancelar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !processandoStatusAtend && setModalCancelar(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-500" /> Remover Atendimento
                  </h3>
                  <button onClick={() => setModalCancelar(null)} disabled={processandoStatusAtend} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-gray-700">
                    Deseja remover <strong>{modalCancelar.titulo}</strong>?
                  </p>
                  {modalCancelar.cliente_email && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      📧 Um e-mail será enviado para <strong>{modalCancelar.cliente_email}</strong> informando que o atendimento foi removido e que entraremos em contato em breve.
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setModalCancelar(null)} disabled={processandoStatusAtend}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Voltar
                    </button>
                    <button onClick={confirmarCancelamento} disabled={processandoStatusAtend}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                      {processandoStatusAtend ? "Removendo…" : "Remover"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Concluir Atendimento (Parcial / Total) */}
          {modalConcluir && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !processandoStatusAtend && setModalConcluir(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <span className="text-green-600">✓</span> Concluir Atendimento
                  </h3>
                  <button onClick={() => setModalConcluir(null)} disabled={processandoStatusAtend} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-gray-700">
                    Como foi concluído o atendimento <strong>{modalConcluir.titulo}</strong>?
                  </p>
                  {modalConcluir.cliente_email && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                      📧 Um e-mail de conclusão será enviado para <strong>{modalConcluir.cliente_email}</strong>.
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => confirmarConclusao("parcial")} disabled={processandoStatusAtend}
                      className="flex-1 rounded-xl border border-purple-300 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60 flex flex-col items-center gap-1">
                      <span>Parcial</span>
                      <span className="text-xs font-normal text-purple-500">Nova visita necessária</span>
                    </button>
                    <button onClick={() => confirmarConclusao("total")} disabled={processandoStatusAtend}
                      className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 flex flex-col items-center gap-1">
                      <span>{processandoStatusAtend ? "Salvando…" : "Total"}</span>
                      <span className="text-xs font-normal text-green-200">Serviço finalizado</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal URL do Feed iCal */}
          {modalFeedUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalFeedUrl(false)}>
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-blue-600" /> Sincronizar com Google Agenda</h3>
                  <button onClick={() => setModalFeedUrl(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-gray-600">Cole esta URL no Google Agenda em <strong>Adicionar agenda → Do URL</strong>:</p>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <code className="flex-1 text-xs text-gray-700 break-all select-all">{FEED_URL}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(FEED_URL); }}
                      className="shrink-0 rounded-lg bg-[#1a6b2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155824]">
                      Copiar
                    </button>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">Como adicionar no Google Agenda:</p>
                    <p>1. Abra o Google Agenda no computador</p>
                    <p>2. Clique em <strong>+ Outras agendas → Do URL</strong></p>
                    <p>3. Cole a URL acima e clique em <strong>Adicionar agenda</strong></p>
                    <p>4. A agenda sincroniza automaticamente de hora em hora ✓</p>
                  </div>
                  <a href={`https://calendar.google.com/calendar/r/settings/addbyurl`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                    <CalendarIcon className="h-4 w-4" /> Abrir Google Agenda
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Modal Atendimento */}
          {modalAtend && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalAtend(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900">{selAtend ? "Editar Atendimento" : "Novo Atendimento"}</h3>
                  <button onClick={() => setModalAtend(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                  {/* ── Vínculo com pedido/vistoria/ticket ── */}
                  {!selAtend && (() => {
                    const q = buscaVinculo.toLowerCase();
                    const fontes: { label: string; tipo: string; id: string; cliente: string; cliente_email?: string | null; endereco?: string | null; classificacao: Atendimento["classificacao"]; descricao?: string }[] = [
                      ...pedidosLog.filter(p => !p.is_ticket && (p.etapa !== "concluido" && p.etapa !== "cancelado")).map(p => ({
                        label: "Serviço", tipo: "servico", id: p.id,
                        cliente: p.cliente_empresa || p.cliente_nome || "—",
                        cliente_email: p.cliente_email ?? null,
                        endereco: p.cliente_endereco ?? null,
                        classificacao: "Serviço" as const,
                        descricao: p.tipo_cobranca ? `Contrato ${p.tipo_cobranca}` : undefined,
                      })),
                      ...vistorias.filter(v => v.status === "pendente" || v.status === "agendada").map(v => ({
                        label: "Vistoria", tipo: "vistoria", id: v.id,
                        cliente: v.cliente_nome || "—",
                        cliente_email: v.cliente_email ?? null,
                        endereco: v.cliente_endereco ?? null,
                        classificacao: "Vistoria" as const,
                        descricao: `Vistoria — ${v.status}`,
                      })),
                      ...ticketsAbertos.map(t => ({
                        label: "Ticket", tipo: "ticket", id: t.id,
                        cliente: t.cliente_empresa || t.cliente_nome || "—",
                        cliente_email: t.cliente_email ?? null,
                        endereco: null,
                        classificacao: "Retorno" as const,
                        descricao: t.ticket_motivo ?? undefined,
                      })),
                    ];
                    const filtrados = q.length >= 2 ? fontes.filter(f => f.cliente.toLowerCase().includes(q) || (f.descricao ?? "").toLowerCase().includes(q)) : [];
                    return (
                      <div>
                        <label className="label-field">Vincular a pedido / vistoria / ticket</label>
                        <div className="relative">
                          <input className="input-field pr-8" value={buscaVinculo}
                            onChange={e => setBuscaVinculo(e.target.value)}
                            placeholder="Digite o nome do cliente ou palavra-chave..." />
                          {buscaVinculo && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" onClick={() => setBuscaVinculo("")}><X className="h-3.5 w-3.5" /></button>}
                        </div>
                        {buscaVinculo.length >= 2 && (
                          <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                            {filtrados.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-400">Nenhum resultado encontrado</p>
                            ) : filtrados.map(item => (
                              <button key={item.tipo + item.id} type="button"
                                onClick={() => {
                                  setFormAtend(f => ({
                                    ...f,
                                    titulo: f.titulo || item.cliente,
                                    classificacao: item.classificacao,
                                    endereco: f.endereco || item.endereco || "",
                                    descricao: f.descricao || item.descricao || "",
                                    cliente_nome: f.cliente_nome || item.cliente,
                                    cliente_email: f.cliente_email || item.cliente_email || "",
                                  }));
                                  setBuscaVinculo("");
                                }}
                                className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                                <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  item.tipo === "ticket" ? "bg-red-100 text-red-700" :
                                  item.tipo === "vistoria" ? "bg-orange-100 text-orange-700" :
                                  "bg-emerald-100 text-emerald-700"
                                )}>{item.label}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 truncate">{item.cliente}</p>
                                  {item.descricao && <p className="text-[10px] text-gray-400 truncate">{item.descricao}</p>}
                                  {item.endereco && <p className="text-[10px] text-gray-400 truncate">📍 {item.endereco}</p>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-gray-400">Opcional — ao selecionar, preenche título, endereço e classificação automaticamente</p>
                      </div>
                    );
                  })()}
                  <div>
                    <label className="label-field">Título *</label>
                    <input className="input-field" value={formAtend.titulo} onChange={e => setFormAtend(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Portão automático — Empresa ABC" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Classificação</label>
                      <select className="input-field" value={formAtend.classificacao} onChange={e => setFormAtend(f => ({ ...f, classificacao: e.target.value as Atendimento["classificacao"] }))}>
                        {["Serviço", "Vistoria", "Retorno", "Operacional", "Terceirizados"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-field">Status</label>
                      <select className="input-field" value={formAtend.status} onChange={e => setFormAtend(f => ({ ...f, status: e.target.value as Atendimento["status"] }))}>
                        {["Programado", "Em andamento", "Concluído", "Cancelado"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label-field">Data</label>
                      <input type="date" className="input-field" value={formAtend.data_agendada} onChange={e => setFormAtend(f => ({ ...f, data_agendada: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Hora início</label>
                      <input type="time" className="input-field" value={formAtend.hora_inicio} onChange={e => setFormAtend(f => ({ ...f, hora_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Hora fim</label>
                      <input type="time" className="input-field" value={formAtend.hora_fim} onChange={e => setFormAtend(f => ({ ...f, hora_fim: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Responsáveis</label>
                    <div className="flex flex-wrap gap-2">
                      {RESPONSAVEIS_OPCOES.map(r => (
                        <button key={r} type="button"
                          onClick={() => setFormAtend(f => ({ ...f, responsaveis: f.responsaveis.includes(r) ? f.responsaveis.filter(x => x !== r) : [...f.responsaveis, r] }))}
                          className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                            formAtend.responsaveis.includes(r) ? "bg-[#1a6b2f] text-white border-[#1a6b2f]" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Endereço</label>
                    <input className="input-field" value={formAtend.endereco} onChange={e => setFormAtend(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, cidade" />
                  </div>
                  <div>
                    <label className="label-field">Atividade</label>
                    <input className="input-field" value={formAtend.atividade} onChange={e => setFormAtend(f => ({ ...f, atividade: e.target.value }))} placeholder="O que será feito?" />
                  </div>
                  <div>
                    <label className="label-field">Descrição / Observações</label>
                    <textarea className="input-field" rows={3} value={formAtend.descricao} onChange={e => setFormAtend(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes adicionais..." />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formAtend.agendado_com_cliente} onChange={e => setFormAtend(f => ({ ...f, agendado_com_cliente: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700">Agendado com cliente</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formAtend.em_sistema} onChange={e => setFormAtend(f => ({ ...f, em_sistema: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700">Em sistema</span>
                    </label>
                  </div>
                  {formAtend.agendado_com_cliente && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-blue-700">📧 Confirmação por email ao cliente</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Nome</label>
                          <input
                            type="text"
                            placeholder="Nome do cliente"
                            value={formAtend.cliente_nome}
                            onChange={e => setFormAtend(f => ({ ...f, cliente_nome: e.target.value }))}
                            className="mt-0.5 w-full rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Email principal</label>
                          <input
                            type="email"
                            placeholder="email@cliente.com"
                            value={formAtend.cliente_email}
                            onChange={e => setFormAtend(f => ({ ...f, cliente_email: e.target.value }))}
                            className="mt-0.5 w-full rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Com cópia (CC) — separe por vírgula</label>
                        <input
                          type="text"
                          placeholder="outro@email.com, mais@email.com"
                          value={formAtend.cliente_email_cc}
                          onChange={e => setFormAtend(f => ({ ...f, cliente_email_cc: e.target.value }))}
                          className="mt-0.5 w-full rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-blue-500">
                        {formAtend.cliente_email ? "✓ Email de confirmação será enviado ao salvar." : "Preencha o email principal para enviar a confirmação."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                  <button onClick={() => setModalAtend(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarAtend} disabled={salvandoAtend || !formAtend.titulo.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoAtend ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Material */}
          {modalMat.aberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalMat({ aberto: false, atendimentoId: null })}>
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="font-semibold text-gray-900">Adicionar Material</h3>
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="label-field">Descrição *</label>
                    <input className="input-field" value={formMat.descricao} onChange={e => setFormMat(f => ({ ...f, descricao: e.target.value }))} placeholder="Nome do material" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Quantidade</label>
                      <input type="number" className="input-field" value={formMat.quantidade} onChange={e => setFormMat(f => ({ ...f, quantidade: Number(e.target.value) }))} min={1} />
                    </div>
                    <div>
                      <label className="label-field">Unidade</label>
                      <select className="input-field" value={formMat.unidade} onChange={e => setFormMat(f => ({ ...f, unidade: e.target.value }))}>
                        {["un", "m", "m²", "m³", "kg", "L", "cx", "pç", "par", "rolo"].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Fornecedor</label>
                    <input className="input-field" value={formMat.fornecedor} onChange={e => setFormMat(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
                  </div>
                  <div>
                    <label className="label-field">Status</label>
                    <select className="input-field" value={formMat.status} onChange={e => setFormMat(f => ({ ...f, status: e.target.value as Material["status"] }))}>
                      {["Solicitado", "Comprado", "Chegou no escritório", "Enviado ao campo", "Instalado"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Observações</label>
                    <textarea className="input-field" rows={2} value={formMat.observacoes} onChange={e => setFormMat(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                  <button onClick={() => setModalMat({ aberto: false, atendimentoId: null })} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarMat} disabled={salvandoMat || !formMat.descricao.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoMat ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ ABA GANTT ═══════ */}
      {aba === "gantt" && (
        <GanttView atendimentos={atendimentos} carregando={carregandoAtend} />
      )}

      {/* ═══════ ABA COMPRAS ═══════ */}
      {aba === "compras" && (
        <>
          {/* Sub-abas */}
          <div className="mb-5 flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setSubAbaCompras("pedidos")}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                subAbaCompras === "pedidos"
                  ? "border-[#1a6b2f] text-[#1a6b2f]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}>
              <ShoppingCart className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Pedidos de Compra
            </button>
            <button
              onClick={() => setSubAbaCompras("materiais")}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px relative",
                subAbaCompras === "materiais"
                  ? "border-[#1a6b2f] text-[#1a6b2f]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}>
              <ClipboardList className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Materiais a Comprar
              {matComprar.filter(m => m.status === "Pendente").length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  {matComprar.filter(m => m.status === "Pendente").length}
                </span>
              )}
            </button>
          </div>

          {/* ── Sub-aba: Pedidos de Compra ── */}
          {subAbaCompras === "pedidos" && (
          <>
          {/* Cabeçalho */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{compras.length} compra{compras.length !== 1 ? "s" : ""} registrada{compras.length !== 1 ? "s" : ""}</p>
            <button onClick={abrirNovaCompra}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Nova Compra
            </button>
          </div>

          {carregandoCompras ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : compras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
              Nenhuma compra registrada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {compras.map(c => {
                const aberta = compraAberta === c.id;
                const semaforo = c.previsao_chegada && !c.data_recebido
                  ? (() => {
                      const dias = Math.ceil((new Date(c.previsao_chegada).getTime() - Date.now()) / 86400000);
                      if (dias < 0) return "text-red-600";
                      if (dias <= 3) return "text-orange-500";
                      return "text-green-600";
                    })()
                  : null;

                return (
                  <div key={c.id} className={cn("rounded-xl border bg-white shadow-sm transition-all", c.finalizado ? "opacity-60" : "")}>
                    {/* Linha principal */}
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setCompraAberta(aberta ? null : c.id)}>
                      {/* Checkbox finalizado */}
                      <input type="checkbox" checked={c.finalizado} onChange={e => { e.stopPropagation(); toggleFinalizadoCompra(c.id, c.finalizado); }}
                        className="h-4 w-4 rounded accent-[#1a6b2f] cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{c.titulo}</span>
                          {c.fornecedor && <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{c.fornecedor}</span>}
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COMPRA_COR[c.status_entrega])}>{c.status_entrega}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          {c.materiais && <span className="truncate max-w-[200px]">{c.materiais}</span>}
                          {c.custo && <span className="font-medium text-gray-700">R$ {c.custo.toFixed(2)}</span>}
                          {c.previsao_chegada && !c.data_recebido && (
                            <span className={cn("font-medium", semaforo)}>
                              Prev. {new Date(c.previsao_chegada + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {c.data_recebido && <span className="text-green-600 font-medium">✓ Recebido {new Date(c.data_recebido + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                        </div>
                        {/* Atendimentos vinculados */}
                        {c.pedidos && c.pedidos.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.pedidos.map(p => (
                              <span key={p.id} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_COR[p.classificacao])}>
                                {p.titulo.length > 30 ? p.titulo.slice(0, 30) + "…" : p.titulo}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); abrirEditarCompra(c); }}
                          className="rounded p-1.5 text-gray-400 hover:text-[#1a6b2f] hover:bg-green-50">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); excluirCompra(c.id); }}
                          className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", aberta && "rotate-180")} />
                      </div>
                    </div>

                    {/* Detalhe expandido */}
                    {aberta && (
                      <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600">
                        {c.quem_recebeu && <div><span className="font-medium text-gray-500">Quem recebeu:</span> {c.quem_recebeu}</div>}
                        {c.observacoes && <div className="col-span-2"><span className="font-medium text-gray-500">Obs:</span> {c.observacoes}</div>}
                        <div><span className="font-medium text-gray-500">Status:</span>
                          <select value={c.status_entrega}
                            onChange={async e => {
                              const v = e.target.value as Compra["status_entrega"];
                              await supabase.from("logistica_compras").update({ status_entrega: v }).eq("id", c.id);
                              setCompras(cs => cs.map(x => x.id === c.id ? { ...x, status_entrega: v } : x));
                            }}
                            className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs focus:outline-none">
                            {["Não iniciada", "Em andamento", "Concluído"].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          </>
          )} {/* fim subAbaCompras === "pedidos" */}

          {/* ── Sub-aba: Materiais a Comprar ── */}
          {subAbaCompras === "materiais" && (
            <>
              {/* Cabeçalho */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {matComprar.filter(m => m.status === "Pendente").length} pendente{matComprar.filter(m => m.status === "Pendente").length !== 1 ? "s" : ""} · {matComprar.length} total
                </p>
                <button onClick={abrirNovaMatC}
                  className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
                  <Plus className="h-4 w-4" /> Novo Material
                </button>
              </div>

              {carregandoMatC ? (
                <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
              ) : matComprar.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-400">
                  <ClipboardList className="mb-3 h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhum material cadastrado</p>
                  <p className="text-xs text-gray-400 mt-1">Adicione materiais que precisam ser comprados</p>
                </div>
              ) : (
                /* ── Tabela por status → agrupada por cliente ── */
                (() => {
                  const statusCor: Record<string, string> = {
                    "Pendente": "bg-orange-50 border-orange-200",
                    "Comprado": "bg-blue-50 border-blue-200",
                    "Recebido": "bg-green-50 border-green-200",
                  };
                  const statusTitCor: Record<string, string> = {
                    "Pendente": "text-orange-700",
                    "Comprado": "text-blue-700",
                    "Recebido": "text-green-700",
                  };

                  // Helper: obter nome do cliente de um item
                  function nomeClienteItem(m: MatComprar): string {
                    if (m._origem === "pedido" && m._pedido_nome) return m._pedido_nome;
                    if (m.vinculados && m.vinculados.length > 0) return m.vinculados[0].titulo;
                    return "__sem_cliente__";
                  }

                  return (["Pendente", "Comprado", "Recebido"] as MatComprar["status"][]).map(status => {
                    const grupo = matComprar.filter(m => m.status === status);
                    if (grupo.length === 0) return null;

                    // Agrupar por cliente
                    const clienteMap: Record<string, MatComprar[]> = {};
                    grupo.forEach(m => {
                      const chave = nomeClienteItem(m);
                      if (!clienteMap[chave]) clienteMap[chave] = [];
                      clienteMap[chave].push(m);
                    });
                    // Ordenar: clientes nomeados primeiro, sem cliente por último
                    const clientesOrdenados = Object.keys(clienteMap).sort((a, b) => {
                      if (a === "__sem_cliente__") return 1;
                      if (b === "__sem_cliente__") return -1;
                      return a.localeCompare(b, "pt-BR");
                    });

                    // Somatório geral do status (qtd + valor)
                    const totais: Record<string, { qtd: number; unidade: string; valor: number; temPreco: boolean }> = {};
                    grupo.forEach(m => {
                      if (!totais[m.descricao]) totais[m.descricao] = { qtd: 0, unidade: m.unidade, valor: 0, temPreco: false };
                      const qty = Number(m.quantidade);
                      totais[m.descricao].qtd += qty;
                      if (m.custo_unitario != null && m.custo_unitario > 0) {
                        totais[m.descricao].valor += qty * Number(m.custo_unitario);
                        totais[m.descricao].temPreco = true;
                      }
                    });
                    const totalGrupo = Object.values(totais).reduce((sum, t) => sum + t.valor, 0);
                    const algumSemPreco = Object.values(totais).some(t => !t.temPreco);

                    return (
                      <div key={status} className="mb-6">
                        <div className={cn("rounded-xl border overflow-hidden shadow-sm", statusCor[status])}>
                          {/* Cabeçalho status */}
                          <div className={cn("px-4 py-2.5 flex items-center gap-2 border-b", statusCor[status])}>
                            <span className={cn("text-xs font-bold uppercase tracking-wide", statusTitCor[status])}>{status}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_MATC_COR[status])}>{grupo.length}</span>
                          </div>

                          {/* Tabela única com cabeçalho fixo — grupos de cliente como linhas separadoras */}
                          <div className="overflow-x-auto bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Material</th>
                                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">Qtd</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Urgência</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Fornecedor</th>
                                  <th className="px-4 py-2 w-20" />
                                </tr>
                              </thead>
                              <tbody>
                                {clientesOrdenados.map((cliente, cidx) => {
                                  const itensCliente = clienteMap[cliente];
                                  const nomeExibido = cliente === "__sem_cliente__" ? "Sem cliente" : cliente;
                                  const isPedido = itensCliente.some(m => m._origem === "pedido");
                                  return (
                                    <>
                                      {/* Linha separadora do cliente */}
                                      <tr key={`sep-${cliente}`} className={cidx > 0 ? "border-t border-gray-200" : ""}>
                                        <td colSpan={5} className="px-4 py-1.5 bg-gray-50">
                                          <div className="flex items-center gap-2">
                                            {isPedido
                                              ? <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">{nomeExibido}</span>
                                              : cliente === "__sem_cliente__"
                                                ? <span className="text-[11px] text-gray-400 italic">{nomeExibido}</span>
                                                : <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{nomeExibido}</span>
                                            }
                                            <span className="text-[10px] text-gray-400">{itensCliente.length} {itensCliente.length === 1 ? "item" : "itens"}</span>
                                          </div>
                                        </td>
                                      </tr>
                                      {/* Linhas dos itens */}
                                      {itensCliente.map(m => (
                                        <tr key={m.id} className={cn(
                                          "border-t border-gray-50 hover:bg-gray-50/60",
                                          m.status === "Recebido" && "opacity-60",
                                          m._origem === "pedido" && "bg-blue-50/20"
                                        )}>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium text-gray-900">{m.descricao}</span>
                                              {m._origem === "pedido" && (
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Pedido</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-center text-gray-700 font-mono">{m.quantidade} <span className="text-xs text-gray-400">{m.unidade}</span></td>
                                          <td className="px-4 py-3">
                                            {m._origem !== "pedido" && (
                                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", URGENCIA_COR[m.urgencia])}>
                                                {m.urgencia === "urgente" ? "🔴 Urgente" : m.urgencia === "normal" ? "Normal" : "Baixa"}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-xs text-gray-500">{m.fornecedor || <span className="text-gray-300">—</span>}</td>
                                          <td className="px-4 py-3">
                                            {/* Itens de pedido: somente leitura — status gerenciado em Compras > Pedido de Compras */}
                                            {m._origem !== "pedido" && (
                                              <div className="flex items-center gap-0.5 justify-end">
                                                {m.status !== "Recebido" && (
                                                  <button onClick={() => avancarStatusMatC(m)}
                                                    title={m.status === "Pendente" ? "Marcar como Comprado" : "Marcar como Recebido"}
                                                    className="rounded p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50">
                                                    <Check className="h-3.5 w-3.5" />
                                                  </button>
                                                )}
                                                <button onClick={() => abrirEditarMatC(m)}
                                                  className="rounded p-1.5 text-gray-400 hover:text-[#1a6b2f] hover:bg-green-50">
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => excluirMatComprar(m.id)}
                                                  className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50">
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Card de totais abaixo da tabela */}
                        <div className={cn("px-4 py-3 border-t", statusCor[status])}>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
                            <div className="flex-1 min-w-[200px]">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Resumo de quantidades</p>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(totais).map(([desc, { qtd, unidade }]) => (
                                  <span key={desc} className="rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
                                    {desc}: <span className="font-bold text-[#1a6b2f]">{qtd}</span> <span className="text-gray-400">{unidade}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Total a adquirir</p>
                              <div className="flex flex-col items-end gap-1">
                                {Object.entries(totais).map(([desc, { qtd, unidade, valor, temPreco }]) => (
                                  <div key={desc} className="flex items-center gap-2 text-xs text-gray-600">
                                    <span className="text-gray-400">{desc} ({qtd} {unidade}) =</span>
                                    {temPreco
                                      ? <span className="font-semibold text-gray-800">
                                          R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      : <span className="text-gray-400 italic text-[11px]">sem preço cadastrado</span>
                                    }
                                  </div>
                                ))}
                                {totalGrupo > 0 && (
                                  <div className="mt-1 pt-1.5 border-t border-gray-200 w-full text-right">
                                    <span className="text-xs text-gray-500 mr-2">Total do grupo:</span>
                                    <span className="text-sm font-bold text-[#1a6b2f]">
                                      R$ {totalGrupo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {algumSemPreco && (
                                      <p className="text-[10px] text-orange-500 mt-0.5">* alguns itens sem preço cadastrado não estão incluídos</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
              )}

              {/* Modal Nova/Editar Material */}
              {modalMatC && (() => {
                const supFiltradosC = suprimentos.filter(s =>
                  !formMatC.descricao || s.nome.toLowerCase().includes(formMatC.descricao.toLowerCase())
                );
                const mostraDropdown = formMatC.descricao.length > 0 && supFiltradosC.length > 0
                  && !suprimentos.some(s => s.nome === formMatC.descricao);
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalMatC(false)}>
                  <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
                      <h3 className="font-semibold text-gray-900">{matCEditando ? "Editar Material" : "Novo Material a Comprar"}</h3>
                      <button onClick={() => setModalMatC(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                      {/* Descrição com autocomplete de suprimentos */}
                      <div className="relative">
                        <label className="label-field">Material *</label>
                        <input className="input-field" value={formMatC.descricao}
                          onChange={e => setFormMatC(f => ({ ...f, descricao: e.target.value }))}
                          placeholder="Buscar produto/serviço do catálogo…" />
                        {mostraDropdown && (
                          <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            {supFiltradosC.slice(0, 8).map(s => (
                              <button key={s.id} type="button"
                                onClick={() => setFormMatC(f => ({
                                  ...f,
                                  descricao: s.nome,
                                  unidade: s.unidade || f.unidade,
                                }))}
                                className="w-full text-left px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2">
                                <span className="flex-1 font-medium">{s.nome}</span>
                                {s.categoria && <span className="text-xs text-gray-400 shrink-0">{s.categoria}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label-field">Quantidade</label>
                          <input type="number" className="input-field" value={formMatC.quantidade}
                            onChange={e => setFormMatC(f => ({ ...f, quantidade: e.target.value }))}
                            min={1} step={1} />
                        </div>
                        <div>
                          <label className="label-field">Unidade</label>
                          <input className="input-field" value={formMatC.unidade}
                            onChange={e => setFormMatC(f => ({ ...f, unidade: e.target.value }))}
                            placeholder="un, m, kg..." />
                        </div>
                      </div>
                      <div>
                        <label className="label-field">Fornecedor</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {[...FORNECEDORES, "Outro"].map(f => {
                            const sel = formMatC.fornecedor === f;
                            return (
                              <button key={f} type="button"
                                onClick={() => setFormMatC(fc => ({ ...fc, fornecedor: sel ? "" : f }))}
                                className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                  sel ? "bg-[#1a6b2f] text-white border-[#1a6b2f]" : "bg-white text-gray-600 border-gray-300 hover:border-[#1a6b2f]"
                                )}>
                                {f}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label-field">Urgência</label>
                          <select className="input-field" value={formMatC.urgencia}
                            onChange={e => setFormMatC(f => ({ ...f, urgencia: e.target.value as MatComprar["urgencia"] }))}>
                            <option value="baixa">Baixa</option>
                            <option value="normal">Normal</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                        <div>
                          <label className="label-field">Status</label>
                          <select className="input-field" value={formMatC.status}
                            onChange={e => setFormMatC(f => ({ ...f, status: e.target.value as MatComprar["status"] }))}>
                            <option value="Pendente">Pendente</option>
                            <option value="Comprado">Comprado</option>
                            <option value="Recebido">Recebido</option>
                          </select>
                        </div>
                      </div>
                      {/* Atendimentos vinculados */}
                      <div>
                        <label className="label-field">Clientes / Atendimentos vinculados</label>
                        <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                          {atendimentos.length === 0 && <p className="p-3 text-xs text-gray-400">Nenhum atendimento disponível</p>}
                          {atendimentos.filter(a => a.status !== "Cancelado").map(a => (
                            <label key={a.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                              <input type="checkbox"
                                checked={formMatC.atendSel.includes(a.id)}
                                onChange={e => setFormMatC(f => ({
                                  ...f,
                                  atendSel: e.target.checked
                                    ? [...f.atendSel, a.id]
                                    : f.atendSel.filter(id => id !== a.id)
                                }))}
                                className="accent-[#1a6b2f]" />
                              <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{a.titulo}</span>
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0", CLASS_COR[a.classificacao])}>{a.classificacao}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label-field">Observações</label>
                        <textarea className="input-field" rows={2} value={formMatC.observacoes}
                          onChange={e => setFormMatC(f => ({ ...f, observacoes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 sticky bottom-0 bg-white">
                      <button onClick={() => setModalMatC(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                      <button onClick={salvarMatComprar} disabled={salvandoMatC || !formMatC.descricao.trim()}
                        className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                        {salvandoMatC ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
            </>
          )} {/* fim subAbaCompras === "materiais" */}

          {/* Modal Nova/Editar Compra */}
          {modalCompra && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalCompra(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
                  <h3 className="font-semibold text-gray-900">{compraEditando ? "Editar Compra" : "Nova Compra"}</h3>
                  <button onClick={() => setModalCompra(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="label-field">Título / Referência *</label>
                    <input className="input-field" value={formCompra.titulo} onChange={e => setFormCompra(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Compra G Sardou — Nov/26" />
                  </div>
                  <div>
                    <label className="label-field">Fornecedor</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...FORNECEDORES, "Outro"].map(f => {
                        const sel = formCompra.fornecedoresSel.includes(f);
                        return (
                          <button key={f} type="button"
                            onClick={() => setFormCompra(fc => ({
                              ...fc,
                              fornecedoresSel: sel
                                ? fc.fornecedoresSel.filter(x => x !== f)
                                : [...fc.fornecedoresSel, f]
                            }))}
                            className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                              sel ? "bg-[#1a6b2f] text-white border-[#1a6b2f]" : "bg-white text-gray-600 border-gray-300 hover:border-[#1a6b2f]"
                            )}>
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Materiais</label>
                    <textarea className="input-field" rows={2} value={formCompra.materiais} onChange={e => setFormCompra(f => ({ ...f, materiais: e.target.value }))} placeholder="Ex: 12 fechaduras sem chave, 4 dobradiças" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Custo (R$)</label>
                      <input type="number" className="input-field" value={formCompra.custo} onChange={e => setFormCompra(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" min={0} step={0.01} />
                    </div>
                    <div>
                      <label className="label-field">Status</label>
                      <select className="input-field" value={formCompra.status_entrega} onChange={e => setFormCompra(f => ({ ...f, status_entrega: e.target.value as Compra["status_entrega"] }))}>
                        {["Não iniciada", "Em andamento", "Concluído"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Previsão de chegada</label>
                      <input type="date" className="input-field" value={formCompra.previsao_chegada} onChange={e => setFormCompra(f => ({ ...f, previsao_chegada: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Data recebido</label>
                      <input type="date" className="input-field" value={formCompra.data_recebido} onChange={e => setFormCompra(f => ({ ...f, data_recebido: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Quem recebeu</label>
                    <input className="input-field" value={formCompra.quem_recebeu} onChange={e => setFormCompra(f => ({ ...f, quem_recebeu: e.target.value }))} placeholder="Nome do responsável" />
                  </div>
                  {/* Atendimentos vinculados */}
                  <div>
                    <label className="label-field">Atendimentos vinculados</label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {atendimentos.length === 0 && <p className="p-3 text-xs text-gray-400">Nenhum atendimento disponível</p>}
                      {atendimentos.map(a => (
                        <label key={a.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox"
                            checked={formCompra.pedidosSel.includes(a.id)}
                            onChange={e => setFormCompra(f => ({
                              ...f,
                              pedidosSel: e.target.checked
                                ? [...f.pedidosSel, a.id]
                                : f.pedidosSel.filter(id => id !== a.id)
                            }))}
                            className="accent-[#1a6b2f]" />
                          <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{a.titulo}</span>
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0", CLASS_COR[a.classificacao])}>{a.classificacao}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Observações</label>
                    <textarea className="input-field" rows={2} value={formCompra.observacoes} onChange={e => setFormCompra(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 sticky bottom-0 bg-white">
                  <button onClick={() => setModalCompra(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={salvarCompra} disabled={salvandoCompra || !formCompra.titulo.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#155824] disabled:opacity-50">
                    {salvandoCompra ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ ABA ESTOQUE ═══════ */}
      {aba === "estoque" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{itens.length} item{itens.length !== 1 ? "s" : ""} no estoque</p>
            <button onClick={() => abrirEstoque()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Item
            </button>
          </div>

          {abaixoMinimo.length > 0 && (
            <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">{abaixoMinimo.length} item{abaixoMinimo.length !== 1 ? "s" : ""} abaixo do estoque mínimo</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {abaixoMinimo.map(i => (
                  <span key={i.id} className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    {i.nome} ({i.quantidade} {i.unidade})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoEstoque ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <Package className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum item cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Qtd</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Mín</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Localização</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itens.map((item) => {
                    const critico = item.quantidade <= item.estoque_minimo;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                          {item.codigo && <p className="text-xs text-gray-400">{item.codigo}</p>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.categoria || "—"}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">{item.quantidade} {item.unidade}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-400">{item.estoque_minimo}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.localizacao || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium",
                            critico ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                            {critico ? "⚠ Baixo" : "OK"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => abrirEstoque(item)} className="text-xs text-[#1a6b2f] hover:underline">Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════ ABA SUPRIMENTOS ═══════ */}
      {aba === "suprimentos" && (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <input type="text" placeholder="Buscar por nome, código ou categoria…" value={buscaSup}
                onChange={e => setBuscaSup(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20" />
            </div>
            <button onClick={() => abrirSup()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Suprimento
            </button>
          </div>

          {precosDesatualizados.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {precosDesatualizados.length} suprimento{precosDesatualizados.length > 1 ? "s" : ""} com preço não confirmado (mais de {DIAS_ALERTA} dias sem atualização)
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  {precosDesatualizados.map(s => s.nome).join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoSup ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
            ) : supFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum suprimento cadastrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Suprimento</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Categoria</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Custo Unit.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Tempo Inst.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Últ. Atualização</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Link</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {supFiltrados.map((s) => {
                    const dias = s.atualizado_em ? diasDesdeAtualizacao(s.atualizado_em) : 9999;
                    const desatualizado = dias > DIAS_ALERTA;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{s.nome}</p>
                          {s.codigo && <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 hidden md:table-cell">{s.categoria || "—"}</td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-gray-800">
                            {s.custo_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="ml-1 text-xs text-gray-400">/{s.unidade}</span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          {s.tempo_instalacao_min > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                              <Clock className="h-3 w-3 text-gray-400" />
                              {s.tempo_instalacao_min < 60
                                ? `${s.tempo_instalacao_min}min`
                                : `${Math.floor(s.tempo_instalacao_min / 60)}h${s.tempo_instalacao_min % 60 > 0 ? `${s.tempo_instalacao_min % 60}min` : ""}`}
                              <span className="text-gray-400">/{s.unidade}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          {s.atualizado_em ? (
                            <div className="flex items-center gap-2">
                              <span className={cn("flex items-center gap-1 text-xs", desatualizado ? "text-amber-600 font-medium" : "text-gray-400")}>
                                <Clock className="h-3 w-3" />
                                {new Date(s.atualizado_em).toLocaleDateString("pt-BR")}
                                {desatualizado && ` (${dias}d)`}
                              </span>
                              {desatualizado && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Preço não confirmado
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          {s.link_compra ? (
                            <a href={s.link_compra} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-[#1a6b2f] hover:underline">
                              <ExternalLink className="h-3 w-3" /> Ver link
                            </a>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => abrirSup(s)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => excluirSup(s.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════ ABA TÉCNICO ═══════ */}
      {aba === "tecnico" && (
        <>
          {/* Cards de acesso aos sistemas externos */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Sistemas de Campo</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SISTEMAS_EXTERNOS.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
                    s.cor
                  )}>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/60 shadow-sm">
                    <s.icone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.nome}</p>
                    <p className="text-xs opacity-70">{s.descricao}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-50" />
                </a>
              ))}
            </div>
          </div>

          {/* Google Calendar */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-700">Google Agenda</h2>
                {googleConectado && eventosGoogle.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {eventosGoogle.length} evento{eventosGoogle.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {googleConectado ? (
                <button onClick={carregarEventosGoogle}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                  <Loader2 className={cn("h-3 w-3", carregandoGoogle && "animate-spin")} /> Atualizar
                </button>
              ) : (
                <button onClick={iniciarConexaoGoogle}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                  <CalendarIcon className="h-3.5 w-3.5" /> Conectar Google Agenda
                </button>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {carregandoGoogle ? (
                <div className="py-10 text-center text-sm text-gray-400">Carregando agenda…</div>
              ) : googleConectado === false ? (
                <div className="flex flex-col items-center py-10 text-gray-400">
                  <CalendarIcon className="mb-3 h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">Google Agenda não conectada</p>
                  <p className="mt-1 text-xs text-gray-300">Clique em "Conectar" para ver os eventos da empresa</p>
                  <button onClick={iniciarConexaoGoogle}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                    <CalendarIcon className="h-4 w-4" /> Conectar Google Agenda
                  </button>
                </div>
              ) : eventosGoogle.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Nenhum evento nos próximos 30 dias</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {eventosGoogle.map((ev) => {
                    const dataInicio = new Date(ev.inicio);
                    const dataFim = new Date(ev.fim);
                    const hoje = new Date();
                    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
                    const isHoje = dataInicio.toDateString() === hoje.toDateString();
                    const isAmanha = dataInicio.toDateString() === amanha.toDateString();
                    return (
                      <a key={ev.id} href={ev.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                        {/* Data */}
                        <div className={cn(
                          "flex-shrink-0 w-14 text-center rounded-lg py-1.5",
                          isHoje ? "bg-emerald-50" : "bg-gray-50"
                        )}>
                          <p className={cn("text-lg font-bold leading-none", isHoje ? "text-emerald-700" : "text-gray-800")}>
                            {dataInicio.getDate()}
                          </p>
                          <p className="text-[10px] uppercase text-gray-400 font-medium mt-0.5">
                            {dataInicio.toLocaleDateString("pt-BR", { month: "short" })}
                          </p>
                          {!ev.dia_todo && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {dataInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>

                        <div className="flex-shrink-0 w-px self-stretch bg-gray-100 mx-1" />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800 truncate">{ev.titulo}</p>
                            {isHoje && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">Hoje</span>
                            )}
                            {isAmanha && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase">Amanhã</span>
                            )}
                          </div>
                          {ev.local && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3 flex-shrink-0" /> {ev.local}
                            </p>
                          )}
                          {ev.descricao && (
                            <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{ev.descricao}</p>
                          )}
                          {!ev.dia_todo && (
                            <p className="mt-0.5 text-xs text-gray-300">
                              até {dataFim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>

                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 group-hover:text-gray-500 mt-1" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Agenda de tickets */}
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Agenda de Serviços</h2>
              {ticketsSuporte.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {ticketsSuporte.length} aberto{ticketsSuporte.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                { v: "aberto",       l: "Abertos" },
                { v: "em_andamento", l: "Em andamento" },
                { v: "aguardando",   l: "Aguardando" },
                { v: "todos",        l: "Todos" },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => setFiltroStatus(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    filtroStatus === v
                      ? "bg-white shadow-sm text-gray-800"
                      : "text-gray-500 hover:text-gray-700"
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {carregandoTickets ? (
              <div className="py-16 text-center text-sm text-gray-400">Carregando agenda…</div>
            ) : ticketsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <CalendarIcon className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhum ticket encontrado</p>
                <p className="mt-1 text-xs text-gray-300">
                  Os tickets são cadastrados via AppSheet e sincronizados aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ticketsFiltrados.map((t) => {
                  const dataAgendada = t.agendado_para
                    ? new Date(t.agendado_para).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    : null;
                  const hora = t.agendado_para
                    ? new Date(t.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : null;
                  const statusLabel = t.status?.replace(/_/g, " ") ?? "—";
                  return (
                    <div key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60">
                      {/* data */}
                      <div className="flex-shrink-0 w-14 text-center">
                        {dataAgendada ? (
                          <>
                            <p className="text-lg font-bold text-gray-800 leading-none">
                              {new Date(t.agendado_para).getDate()}
                            </p>
                            <p className="text-[10px] uppercase text-gray-400 font-medium">
                              {new Date(t.agendado_para).toLocaleDateString("pt-BR", { month: "short" })}
                            </p>
                            {hora && <p className="text-[10px] text-gray-400 mt-0.5">{hora}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>

                      {/* linha vertical */}
                      <div className="flex-shrink-0 w-px self-stretch bg-gray-100 mx-1" />

                      {/* conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.titulo}</p>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {t.prioridade && (
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                                PRIORIDADE_CORES[t.prioridade] ?? "bg-gray-100 text-gray-500")}>
                                {t.prioridade}
                              </span>
                            )}
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                              STATUS_CORES[t.status] ?? "bg-gray-100 text-gray-500")}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {t.cliente && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <User className="h-3 w-3" /> {t.cliente}
                            </span>
                          )}
                          {t.tecnico && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Wrench className="h-3 w-3" /> {t.tecnico}
                            </span>
                          )}
                          {t.endereco && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3" /> {t.endereco}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nota informativa */}
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Os tickets são gerenciados nos aplicativos de campo (AppSheet) e sincronizados aqui pela tabela <code className="font-mono bg-gray-100 px-1 rounded">tickets_tecnicos</code> no Supabase.
            </p>
          </div>

          {/* ── Fila de Agendamentos ── */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-[#1a6b2f]" />
                <h2 className="text-sm font-semibold text-gray-700">Fila de Agendamentos</h2>
                {agendaveis.length > 0 && (
                  <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-xs font-medium text-[#1a6b2f]">
                    {agendaveis.length} {agendaveis.length === 1 ? "item" : "itens"}
                  </span>
                )}
              </div>
              <button onClick={carregarAgendaveis}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                <Loader2 className={cn("h-3 w-3", carregandoAgenda && "animate-spin")} /> Atualizar
              </button>
            </div>

            {carregandoAgenda ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : agendaveis.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
                <CalendarIcon className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhum item pendente de agendamento</p>
              </div>
            ) : (() => {
              // Agrupar por bairro
              const grupos: Record<string, typeof agendaveis> = {};
              agendaveis.forEach(item => {
                const bairro = item.bairro ?? "Sem bairro identificado";
                if (!grupos[bairro]) grupos[bairro] = [];
                grupos[bairro].push(item);
              });

              const TIPO_COR: Record<string, string> = {
                vistoria:    "bg-orange-50 text-orange-700 border-orange-200",
                atendimento: "bg-blue-50 text-blue-700 border-blue-200",
                manutencao:  "bg-purple-50 text-purple-700 border-purple-200",
              };
              const TIPO_LABEL: Record<string, string> = {
                vistoria:    "Vistoria",
                atendimento: "Atendimento",
                manutencao:  "Manutenção",
              };

              return (
                <div className="space-y-4">
                  {Object.entries(grupos).map(([bairro, itens]) => (
                    <div key={bairro} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{bairro}</span>
                        <span className="ml-auto text-xs text-gray-400">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {itens.map(item => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{item.cliente}</span>
                                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TIPO_COR[item.tipo])}>
                                  {TIPO_LABEL[item.tipo]}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                {item.endereco && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <MapPin className="h-3 w-3" /> {item.endereco}
                                  </span>
                                )}
                                {item.data && (
                                  <span className="flex items-center gap-1 text-xs text-blue-600">
                                    <CalendarIcon className="h-3 w-3" />
                                    {new Date(item.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {item.tecnico && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <User className="h-3 w-3" /> {item.tecnico}
                                  </span>
                                )}
                                {item.descricao && item.tipo === "manutencao" && (
                                  <span className="text-xs text-gray-400 italic">{item.descricao}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => abrirGoogleCalendar(item)}
                              title="Agendar no Google Calendar"
                              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <CalendarIcon className="h-3.5 w-3.5" /> Google Calendar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Modal Estoque ── */}
      {modalEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalEstoque(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selEstoque ? "Editar Item" : "Novo Item"}</h2>
              <button onClick={() => setModalEstoque(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Nome *", field: "nome" },
                { label: "Código / Referência", field: "codigo" },
                { label: "Categoria", field: "categoria" },
                { label: "Localização", field: "localizacao" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                  <input type="text"
                    value={(formEstoque as Record<string, unknown>)[field] as string || ""}
                    onChange={e => setFormEstoque({ ...formEstoque, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Qtd</label>
                  <input type="number" min={0} value={formEstoque.quantidade ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, quantidade: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mínimo</label>
                  <input type="number" min={0} value={formEstoque.estoque_minimo ?? 0}
                    onChange={e => setFormEstoque({ ...formEstoque, estoque_minimo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formEstoque.unidade || "un"}
                    onChange={e => setFormEstoque({ ...formEstoque, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEstoque(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarEstoque} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ABA EQUIPE ═══════ */}
      {aba === "equipe" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {profissionais.length} profissional{profissionais.length !== 1 ? "is" : ""} cadastrado{profissionais.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Cada profissional é vinculado aos suprimentos que ele instala</p>
            </div>
            <button onClick={() => abrirProf()}
              className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]">
              <Plus className="h-4 w-4" /> Novo Profissional
            </button>
          </div>

          {carregandoProf ? (
            <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
          ) : profissionais.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <HardHat className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Nenhum profissional cadastrado</p>
              <p className="text-xs mt-1 text-gray-300">Cadastre pedreiros, pintores, ajudantes e outros terceirizados</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profissionais.map(p => (
                <div key={p.id} className={cn(
                  "rounded-xl border bg-white p-4 shadow-sm",
                  p.ativo ? "border-gray-200" : "border-gray-100 opacity-60"
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-[#1a6b2f]/10 p-2">
                        <HardHat className="h-4 w-4 text-[#1a6b2f]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.nome}</p>
                        <p className="text-xs text-gray-400">{p.especialidade || "Sem especialidade"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => abrirProf(p)} className="rounded-md p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => excluirProf(p.id)} className="rounded-md p-1 text-gray-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400">
                      {p.tipo_cobranca === "por_unidade" ? "Custo por unidade" : "Custo diário"}
                    </span>
                    {p.terceirizado === false ? (
                      <span className="text-xs font-semibold text-gray-400 italic">próprio — R$ 0</span>
                    ) : (
                      <span className="text-sm font-bold text-[#1a6b2f]">
                        {(p.tipo_cobranca === "por_unidade" ? p.custo_unitario : p.custo_diario)
                          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          {p.tipo_cobranca === "por_unidade" ? "/un" : "/dia"}
                        </span>
                      </span>
                    )}
                  </div>
                  {!p.ativo && (
                    <span className="mt-2 block text-[10px] text-gray-300 font-medium text-center">Inativo — não entra nos orçamentos</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Valor de MO Padrão */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Valor de Mão de Obra para Orçamentos</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Valor padrão de MO que aparece pré-preenchido na calculadora do CRM (pode ser ajustado por orçamento)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">R$</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={moPadrao}
                  onChange={e => setMoPadrao(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-1 focus:ring-[#1a6b2f]/20"
                  placeholder="0"
                />
              </div>
              <button
                onClick={salvarMoPadrao}
                disabled={salvandoMo}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
                  moSalvo
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-[#1a6b2f] text-white hover:bg-[#155824] shadow-sm"
                )}
              >
                {moSalvo ? <><Check className="h-4 w-4" /> Salvo</> : salvandoMo ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>

          {/* Info sobre vinculação */}
          {profissionais.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Como vincular profissionais aos itens</p>
                  <p className="text-xs text-blue-500 mt-1">
                    Vá em <strong>Catálogo</strong> → edite um suprimento → na seção "Profissionais necessários", selecione quem é preciso para instalar aquele item.
                    O orçamento calculará automaticamente o custo de cada profissional com base nos dias de campo estimados.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal Profissional ── */}
      {modalProf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalProf(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selProf ? "Editar Profissional" : "Novo Profissional"}</h2>
              <button onClick={() => setModalProf(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formProf.nome || ""}
                  onChange={e => setFormProf({ ...formProf, nome: e.target.value })}
                  placeholder="Ex: João Pedreiro, Carlos Pintor…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Especialidade</label>
                <input type="text" value={formProf.especialidade || ""}
                  onChange={e => setFormProf({ ...formProf, especialidade: e.target.value })}
                  placeholder="Ex: Pedreiro, Pintor, Técnico fotoluminescente, Ajudante…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Forma de cobrança</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["diaria", "por_unidade"] as const).map(tipo => (
                    <button key={tipo} type="button"
                      onClick={() => setFormProf({ ...formProf, tipo_cobranca: tipo })}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                        formProf.tipo_cobranca === tipo
                          ? "border-[#1a6b2f] bg-[#1a6b2f]/10 text-[#1a6b2f]"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}>
                      {tipo === "diaria" ? "Por diária" : "Por unidade"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {formProf.tipo_cobranca === "por_unidade"
                    ? "Cobra por unidade instalada — ex: pintor cobra por porta"
                    : "Cobra por dia de campo — ex: pedreiro, técnico, ajudante"}
                </p>
              </div>
              {formProf.tipo_cobranca === "por_unidade" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo por unidade (R$)</label>
                  <input type="number" min={0} step={10} value={formProf.custo_unitario ?? 0}
                    onChange={e => setFormProf({ ...formProf, custo_unitario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo diário (R$)</label>
                  <input type="number" min={0} step={10} value={formProf.custo_diario ?? 0}
                    onChange={e => setFormProf({ ...formProf, custo_diario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="ativo-prof" checked={formProf.ativo ?? true}
                  onChange={e => setFormProf({ ...formProf, ativo: e.target.checked })}
                  className="rounded border-gray-300 text-[#1a6b2f]" />
                <label htmlFor="ativo-prof" className="text-sm text-gray-700">Profissional ativo (entra nos orçamentos)</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="terceirizado-prof" checked={formProf.terceirizado ?? true}
                  onChange={e => setFormProf({ ...formProf, terceirizado: e.target.checked })}
                  className="rounded border-gray-300 text-[#1a6b2f]" />
                <label htmlFor="terceirizado-prof" className="text-sm text-gray-700">
                  Terceirizado (tem custo)
                  <span className="ml-1 text-xs text-gray-400">— desmarque para "próprio" (R$ 0, tempo conta)</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalProf(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarProf} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suprimento ── */}
      {modalSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setModalSup(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selSup ? "Editar Suprimento" : "Novo Suprimento"}</h2>
              <button onClick={() => setModalSup(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" value={formSup.nome || ""}
                  onChange={e => setFormSup({ ...formSup, nome: e.target.value })}
                  placeholder="Ex: Dobradiça Corta-Fogo 3/4"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Código / Ref.</label>
                  <input type="text" value={formSup.codigo || ""}
                    onChange={e => setFormSup({ ...formSup, codigo: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
                  <input type="text" value={formSup.categoria || ""}
                    onChange={e => setFormSup({ ...formSup, categoria: e.target.value })}
                    placeholder="Ex: Ferragens"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
                  <input type="number" min={0} step={0.01} value={formSup.custo_unitario ?? 0}
                    onChange={e => setFormSup({ ...formSup, custo_unitario: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unidade</label>
                  <select value={formSup.unidade || "un"}
                    onChange={e => setFormSup({ ...formSup, unidade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]">
                    {["un", "cx", "pc", "m", "kg", "l", "rolo", "par", "jg"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tempo de instalação (minutos/unidade)
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} step={1} value={formSup.tempo_instalacao_min ?? 0}
                    onChange={e => setFormSup({ ...formSup, tempo_instalacao_min: Number(e.target.value) })}
                    className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
                  <span className="text-sm text-gray-400">min/{formSup.unidade || "un"}</span>
                  {(formSup.tempo_instalacao_min ?? 0) > 0 && (
                    <span className="text-xs text-[#1a6b2f] font-medium">
                      ≈ {(formSup.tempo_instalacao_min ?? 0) < 60
                        ? `${formSup.tempo_instalacao_min}min`
                        : `${Math.floor((formSup.tempo_instalacao_min ?? 0) / 60)}h${(formSup.tempo_instalacao_min ?? 0) % 60 > 0 ? `${(formSup.tempo_instalacao_min ?? 0) % 60}min` : ""}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Usado para estimar dias de roteiro no orçamento</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Link de compra</label>
                <input type="url" value={formSup.link_compra || ""}
                  onChange={e => setFormSup({ ...formSup, link_compra: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]" />
              </div>

              {/* ── Profissionais necessários ── */}
              {profissionais.filter(p => p.ativo).length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <HardHat className="h-3.5 w-3.5 text-gray-400" />
                      Profissionais necessários para instalar
                    </span>
                  </label>
                  <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {profissionais.filter(p => p.ativo).map(p => {
                      const selecionado = (formSup.profissionais_ids ?? []).includes(p.id);
                      return (
                        <label key={p.id} className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
                          selecionado ? "bg-[#1a6b2f]/10" : "hover:bg-white"
                        )}>
                          <input type="checkbox" checked={selecionado}
                            onChange={() => toggleProfissionalNoSup(p.id)}
                            className="rounded border-gray-300 text-[#1a6b2f]" />
                          <span className="flex-1 text-sm text-gray-700">{p.nome}</span>
                          {p.especialidade && <span className="text-xs text-gray-400">{p.especialidade}</span>}
                          <span className="text-xs font-medium text-[#1a6b2f]">
                            {(p.tipo_cobranca === "por_unidade" ? p.custo_unitario : p.custo_diario)
                              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            {p.tipo_cobranca === "por_unidade" ? "/un" : "/dia"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">O custo de cada profissional será calculado por dias de campo no orçamento</p>
                </div>
              )}

              {selSup?.atualizado_em && (
                <p className="text-xs text-gray-400">
                  Última atualização: {new Date(selSup.atualizado_em).toLocaleDateString("pt-BR")} — ao salvar, a data será atualizada para hoje.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalSup(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarSup} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
