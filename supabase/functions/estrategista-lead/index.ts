/**
 * estrategista-lead — Edge Function
 * Gestor comercial com IA: analisa dados do lead e sugere estratégia de fechamento.
 *
 * POST /functions/v1/estrategista-lead
 * Body:
 *   { mode: "analise", leadId: string }
 *     → análise automática completa do lead
 *   { mode: "chat", leadId: string, mensagem: string, historico: [{role,content}] }
 *     → resposta estratégica no contexto do lead
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY não configurado." }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { mode, leadId } = body;

    if (!leadId) return json({ error: "leadId obrigatório." }, 400);

    // ── Busca dados completos do lead ─────────────────────────────────────
    async function buscarDadosLead() {
      // Lead principal
      const { data: lead } = await sb
        .from("crm_leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (!lead) return null;

      // Conversas/histórico
      const { data: conversas } = await sb
        .from("crm_conversas")
        .select("autor, texto, criado_em")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: true })
        .limit(20);

      // Propostas enviadas
      const { data: propostas } = await sb
        .from("crm_orcamentos")
        .select("preco_final, margem_pct, status, criado_em, observacoes")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false })
        .limit(5);

      // Tempo na etapa atual (calculado pela data de criação do lead como proxy)
      const agora = new Date();
      const criadoEm = new Date(lead.criado_em);
      const diasNoCrm = Math.floor((agora.getTime() - criadoEm.getTime()) / (1000 * 60 * 60 * 24));

      // Último contato (última conversa)
      const ultimaConversa = conversas && conversas.length > 0
        ? conversas[conversas.length - 1]
        : null;
      const diasSemContato = ultimaConversa
        ? Math.floor((agora.getTime() - new Date(ultimaConversa.criado_em).getTime()) / (1000 * 60 * 60 * 24))
        : diasNoCrm;

      return { lead, conversas: conversas ?? [], propostas: propostas ?? [], diasNoCrm, diasSemContato };
    }

    // ── Monta contexto do lead em texto ───────────────────────────────────
    function montarContexto(dados: Awaited<ReturnType<typeof buscarDadosLead>>) {
      if (!dados) return "";
      const { lead, conversas, propostas, diasNoCrm, diasSemContato } = dados;

      const etapaLabels: Record<string, string> = {
        prospecto: "Prospecto (início)", contato: "Em contato", proposta: "Proposta enviada",
        negociacao: "Em negociação", fechado: "Fechado", perdido: "Perdido",
      };

      const tipoLabel = lead.tipo_negocio === "manutencao" ? "Manutenção"
        : lead.tipo_negocio === "orcamento" ? "Orçamento/Instalação" : "Tipo não definido";

      const conversasTexto = conversas.length > 0
        ? conversas.map((c: {autor: string; texto: string; criado_em: string}) =>
            `[${new Date(c.criado_em).toLocaleDateString("pt-BR")}] ${c.autor}: ${c.texto}`
          ).join("\n")
        : "Nenhuma conversa registrada.";

      const propostasTexto = propostas.length > 0
        ? propostas.map((p: {preco_final: number; margem_pct: number; status: string; criado_em: string; observacoes: string}) =>
            `- R$ ${p.preco_final?.toFixed(2)} | Margem: ${p.margem_pct?.toFixed(1)}% | Status: ${p.status} | Enviada: ${new Date(p.criado_em).toLocaleDateString("pt-BR")}`
          ).join("\n")
        : "Nenhuma proposta enviada.";

      return `
LEAD: ${lead.empresa || lead.nome}
Contato: ${lead.nome} | Tel: ${lead.telefone || "—"} | E-mail: ${lead.email || "—"}
Tipo de serviço: ${tipoLabel}
Etapa atual: ${etapaLabels[lead.etapa] || lead.etapa}
Valor estimado: ${lead.valor_estimado ? `R$ ${Number(lead.valor_estimado).toFixed(2)}` : "Não definido"}
Próximo contato agendado: ${lead.proximo_contato ? new Date(lead.proximo_contato).toLocaleDateString("pt-BR") : "NÃO AGENDADO ⚠️"}
Observações: ${lead.observacoes || "—"}
Dias no CRM: ${diasNoCrm} dias
Dias sem contato registrado: ${diasSemContato} dias

PROPOSTAS ENVIADAS:
${propostasTexto}

HISTÓRICO DE CONVERSAS (últimas 20):
${conversasTexto}
`.trim();
    }

    // ── System prompt do Estrategista ─────────────────────────────────────
    function systemPrompt(contexto: string) {
      return `Você é o Estrategista Comercial da PORTIBRAS, empresa especializada em manutenção e instalação de portas corta-fogo no Rio de Janeiro.

Seu papel é analisar cada lead e dar orientações PRECISAS e PRÁTICAS para os vendedores fecharem o negócio.

DADOS DO LEAD ATUAL:
${contexto}

COMO AGIR:
1. Seja direto e objetivo — nada de respostas genéricas
2. Cite os dados reais do lead (nome da empresa, valor, etapa, dias sem contato)
3. Identifique o risco principal (ex: lead esfriando, sem proposta enviada, sem próximo contato)
4. Sugira a PRÓXIMA AÇÃO CONCRETA com script de abordagem se necessário
5. Se o lead está há muitos dias sem contato, sinalize urgência
6. Fale como um gestor comercial experiente, motivando mas sendo realista
7. Responda em português brasileiro, sem formalidade excessiva`;
    }

    const dados = await buscarDadosLead();
    if (!dados) return json({ error: "Lead não encontrado." }, 404);
    const contexto = montarContexto(dados);

    // ── Modo: análise automática ──────────────────────────────────────────
    if (mode === "analise") {
      const messages = [
        { role: "system", content: systemPrompt(contexto) },
        {
          role: "user",
          content: `Faça uma análise estratégica completa deste lead e me diga:
1. 🎯 STATUS: Como está esse lead agora (risco alto/médio/baixo de fechar)
2. ⚠️ ALERTA PRINCIPAL: O maior problema ou oportunidade que você vê
3. ✅ PRÓXIMA AÇÃO: O que o vendedor deve fazer AGORA (seja específico)
4. 💬 SCRIPT: Uma mensagem ou abordagem pronta para usar com esse cliente`,
        },
      ];

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 800, temperature: 0.7 }),
      });

      if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      return json({
        analise: data.choices?.[0]?.message?.content ?? "",
        lead: dados.lead,
        diasSemContato: dados.diasSemContato,
      });
    }

    // ── Modo: chat estratégico ────────────────────────────────────────────
    if (mode === "chat") {
      const { mensagem, historico = [] } = body;
      if (!mensagem) return json({ error: "mensagem obrigatória." }, 400);

      const messages = [
        { role: "system", content: systemPrompt(contexto) },
        ...historico.slice(-10),
        { role: "user", content: mensagem },
      ];

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 600, temperature: 0.7 }),
      });

      if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      return json({ resposta: data.choices?.[0]?.message?.content ?? "" });
    }

    return json({ error: "mode inválido. Use 'analise' ou 'chat'." }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
