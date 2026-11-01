/**
 * bpo-chat — Edge Function
 * BPO de vendas: calcula meta e responde perguntas via ChatGPT (GPT-4o-mini).
 *
 * POST /functions/v1/bpo-chat
 * Body:
 *   { mode: "meta" }                          → retorna metaDados calculada
 *   { mode: "chat", mensagem: string, historico: [{role,content}] }
 *                                              → resposta do GPT-4o-mini
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
    const { mode } = body;

    // ── Calcula dados da meta ──────────────────────────────────────────────
    async function calcularMeta() {
      // Custos fixos ativos
      const { data: custos } = await sb
        .from("financeiro_custos_fixos")
        .select("valor_mensal")
        .eq("ativo", true);
      const totalCustos = (custos ?? []).reduce((s: number, c: { valor_mensal: number }) => s + c.valor_mensal, 0);

      // Parcelas de dívidas
      const { data: dividas } = await sb
        .from("financeiro_dividas")
        .select("parcela_mensal")
        .eq("ativa", true);
      const totalDividas = (dividas ?? []).reduce((s: number, d: { parcela_mensal: number }) => s + d.parcela_mensal, 0);

      // Ponto de equilíbrio
      const pontoEquilibrio = totalCustos + totalDividas;

      // Margem configurada
      const { data: cfgRows } = await sb
        .from("configuracoes")
        .select("valor")
        .eq("chave", "margem_meta_pct")
        .single();
      const margemPct = Number(cfgRows?.valor ?? 20);

      // Meta = ponto_equilíbrio × (1 + margem/100)
      const metaVendas = pontoEquilibrio * (1 + margemPct / 100);

      // Receitas do mês atual (campo data é tipo DATE — comparar como YYYY-MM-DD)
      const agora = new Date();
      const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
      const inicioMesStr = `${anoMes}-01`;

      const { data: lancamentos } = await sb
        .from("financeiro_lancamentos")
        .select("valor")
        .eq("tipo", "receita")
        .gte("data", inicioMesStr);
      const receitaAtual = (lancamentos ?? []).reduce((s: number, l: { valor: number }) => s + l.valor, 0);

      return { totalCustos, totalDividas, pontoEquilibrio, margemPct, metaVendas, receitaAtual };
    }

    // ── Modo: retornar apenas a meta ──────────────────────────────────────
    if (mode === "meta") {
      const meta = await calcularMeta();
      return json(meta);
    }

    // ── Modo: chat com GPT ────────────────────────────────────────────────
    if (mode === "chat") {
      const { mensagem, historico = [] } = body;
      if (!mensagem) return json({ error: "mensagem obrigatória." }, 400);

      const meta = await calcularMeta();

      const systemPrompt = `Você é o BPO (Business Process Outsourcing) de vendas da PORTIBRAS,
empresa de manutenção e instalação de portas corta-fogo no Rio de Janeiro.

Dados financeiros atuais do mês:
- Custos fixos mensais: R$ ${meta.totalCustos.toFixed(2)}
- Parcelas de dívidas: R$ ${meta.totalDividas.toFixed(2)}
- Ponto de equilíbrio: R$ ${meta.pontoEquilibrio.toFixed(2)}
- Margem de lucro alvo: ${meta.margemPct}%
- META DE VENDAS DO MÊS: R$ ${meta.metaVendas.toFixed(2)}
- Receita já realizada este mês: R$ ${meta.receitaAtual.toFixed(2)}
- Faltam para bater a meta: R$ ${Math.max(meta.metaVendas - meta.receitaAtual, 0).toFixed(2)}

Seu papel:
1. Ajudar a equipe de vendas a entender e bater a meta
2. Sugerir estratégias práticas e realistas para o setor de portas corta-fogo
3. Analisar o desempenho atual e recomendar ações
4. Responder de forma direta, em português brasileiro
5. Quando relevante, citar os números reais acima

Seja objetivo, motivador e pragmático. Evite respostas genéricas.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...historico.slice(-8), // últimas 8 mensagens de contexto
        { role: "user", content: mensagem },
      ];

      const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 600,
          temperature: 0.7,
        }),
      });

      if (!openaiResp.ok) {
        const err = await openaiResp.text();
        throw new Error(`OpenAI ${openaiResp.status}: ${err}`);
      }

      const openaiData = await openaiResp.json();
      const resposta = openaiData.choices?.[0]?.message?.content ?? "";

      return json({ resposta, meta });
    }

    return json({ error: "mode inválido. Use 'meta' ou 'chat'." }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
