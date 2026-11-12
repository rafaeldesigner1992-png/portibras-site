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
      // Busca todas as configs relevantes de uma vez
      const { data: cfgs } = await sb
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["margem_meta_pct", "pct_recebimento", "pct_custo_material"]);

      const cfg = Object.fromEntries((cfgs ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]));

      // Parâmetros do modelo financeiro da PORTIBRAS
      // pct_recebimento: % do valor bruto da NFS-e que a empresa efetivamente recebe (padrão 50%)
      const pctRecebimento = Number(cfg.pct_recebimento ?? 50) / 100;
      // pct_custo_material: % do valor bruto que vai para material (padrão 40%)
      const pctCustoMaterial = Number(cfg.pct_custo_material ?? 40) / 100;
      // margem_meta_pct: margem de lucro desejada sobre o valor bruto da NFS-e (padrão 38%)
      const margemPct = Number(cfg.margem_meta_pct ?? 38);
      const margemDecimal = margemPct / 100;

      // Margem bruta disponível antes dos custos fixos:
      //   recebe 50% → paga 40% de material → sobra 10% do bruto para fixos + lucro
      const margemBrutaDisponivel = pctRecebimento - pctCustoMaterial;

      // A meta de lucro líquido (38% sobre o bruto) deve ser separada dos custos fixos.
      // Para cobrir os fixos E ainda ter 38% de lucro sobre o bruto:
      //   meta_bruta × margemBrutaDisponivel = custos_fixos + meta_bruta × margemDecimal
      //   meta_bruta × (margemBrutaDisponivel − margemDecimal) = custos_fixos
      //   meta_bruta = custos_fixos / (margemBrutaDisponivel − margemDecimal)
      //
      // Se margemDecimal >= margemBrutaDisponivel (negócio inviável), usa fallback simples.

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

      // Ponto de equilíbrio (apenas custos fixos + dívidas, sem material — material já está no modelo)
      const pontoEquilibrio = totalCustos + totalDividas;

      // Cálculo da meta bruta de NFS-e
      // Fórmula: meta = pontoEquilibrio / max(margemBrutaDisponivel − margemDecimal, 0.01)
      const denominador = Math.max(margemBrutaDisponivel - margemDecimal, 0.01);
      const metaVendas = pontoEquilibrio > 0
        ? pontoEquilibrio / denominador
        : 0;

      // Receitas do mês atual = NFS-e emitidas no Conta Azul (fonte de verdade)
      const agora = new Date();
      const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
      const inicioMesStr = `${anoMes}-01`;
      // Fim do mês: primeiro dia do próximo mês
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
      const fimMesStr = fimMes.toISOString().slice(0, 10);

      const { data: nfse } = await sb
        .from("ca_nfse")
        .select("valor_servicos, situacao")
        .gte("data_emissao", inicioMesStr)
        .lt("data_emissao", fimMesStr);

      // Conta apenas NFS-e com situação EMITIDA (exclui canceladas, em processamento, etc.)
      const receitaAtual = (nfse ?? [])
        .filter((n: { situacao: string }) => {
          const s = (n.situacao ?? "").toUpperCase();
          return s === "EMITIDA" || s === "NORMAL" || s === "PROCESSADO" || s === "GERADA";
        })
        .reduce((s: number, n: { valor_servicos: number }) => s + (n.valor_servicos ?? 0), 0);

      return {
        totalCustos, totalDividas, pontoEquilibrio,
        margemPct, pctRecebimento: pctRecebimento * 100, pctCustoMaterial: pctCustoMaterial * 100,
        margemBrutaDisponivel: margemBrutaDisponivel * 100,
        metaVendas, receitaAtual,
      };
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

      const faltam = Math.max(meta.metaVendas - meta.receitaAtual, 0);
      const systemPrompt = `Você é o BPO (Business Process Outsourcing) de vendas da PORTIBRAS,
empresa de manutenção e instalação de portas corta-fogo no Rio de Janeiro.

Modelo financeiro da empresa:
- A PORTIBRAS recebe ${meta.pctRecebimento}% do valor bruto de cada NFS-e emitida
- Custo de materiais: ${meta.pctCustoMaterial}% do valor bruto (pago ao fornecedor)
- Margem bruta disponível (recebimento − material): ${meta.margemBrutaDisponivel.toFixed(1)}% do bruto
- Margem de lucro líquido alvo: ${meta.margemPct}% sobre o valor bruto da NFS-e

Dados financeiros atuais do mês:
- Custos fixos mensais: R$ ${meta.totalCustos.toFixed(2)}
- Parcelas de dívidas: R$ ${meta.totalDividas.toFixed(2)}
- Ponto de equilíbrio (fixos + dívidas): R$ ${meta.pontoEquilibrio.toFixed(2)}
- META DE NFS-e A EMITIR NO MÊS: R$ ${meta.metaVendas.toFixed(2)}
- NFS-e já emitidas este mês: R$ ${meta.receitaAtual.toFixed(2)}
- Faltam para bater a meta: R$ ${faltam.toFixed(2)}
- Receita líquida estimada deste mês: R$ ${(meta.receitaAtual * meta.pctRecebimento / 100).toFixed(2)} (${meta.pctRecebimento}% das NFS-e)

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
