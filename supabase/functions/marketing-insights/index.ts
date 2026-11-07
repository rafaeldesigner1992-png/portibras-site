/**
 * marketing-insights — Edge Function
 * Analisa dados de Google Ads (campanhas + palavras-chave) e retorna
 * insights estratégicos via GPT-4o-mini com expertise em:
 * - Google Ads (otimização de campanhas, lances, qualidade)
 * - Neuromarketing e psicologia comportamental do consumidor
 * - Mercado de prevenção contra incêndio (portas corta-fogo, AVCB)
 *
 * POST /functions/v1/marketing-insights
 * Body: { periodo?: number }  — período em dias (default: 30)
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

    const body = await req.json().catch(() => ({}));
    const periodo: number = body.periodo ?? 30;

    // ── Buscar dados de campanhas ─────────────────────────────────────────────
    const dataInicio = new Date(Date.now() - periodo * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: campanhas, error: errCamp } = await sb
      .from("mkt_google_ads")
      .select("date, campaign, impressions, clicks, spend, conversions, ctr, cpc")
      .gte("date", dataInicio)
      .order("date", { ascending: true });

    if (errCamp) throw errCamp;

    // ── Buscar dados de palavras-chave ────────────────────────────────────────
    const { data: keywords, error: errKw } = await sb
      .from("mkt_google_ads_keywords")
      .select("keyword_text, keyword_match_type, campaign, clicks, impressions, spend, ctr, cpc, conversions")
      .order("clicks", { ascending: false });

    if (errKw) throw errKw;

    // ── Agregar métricas totais por campanha ──────────────────────────────────
    const agregado: Record<string, {
      impressions: number; clicks: number; spend: number;
      conversions: number; dias: number;
    }> = {};

    for (const r of (campanhas ?? [])) {
      if (!agregado[r.campaign]) {
        agregado[r.campaign] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, dias: 0 };
      }
      agregado[r.campaign].impressions += r.impressions;
      agregado[r.campaign].clicks += r.clicks;
      agregado[r.campaign].spend += r.spend;
      agregado[r.campaign].conversions += r.conversions;
      agregado[r.campaign].dias += 1;
    }

    const resumoCampanhas = Object.entries(agregado).map(([nome, m]) => ({
      campanha: nome,
      impressoes: m.impressions,
      cliques: m.clicks,
      investimento: m.spend.toFixed(2),
      conversoes: m.conversions,
      ctr: m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) + "%" : "0%",
      cpc: m.clicks > 0 ? "R$" + (m.spend / m.clicks).toFixed(2) : "—",
      cpa: m.conversions > 0 ? "R$" + (m.spend / m.conversions).toFixed(2) : "sem conversão",
    }));

    const resumoKeywords = (keywords ?? [])
      .filter(k => k.keyword_text)
      .map(k => ({
        keyword: k.keyword_text,
        tipo: k.keyword_match_type,
        cliques: k.clicks,
        impressoes: k.impressions,
        ctr: k.impressions > 0 ? ((k.ctr) * 100).toFixed(2) + "%" : "0%",
        cpc: k.cpc ? "R$" + Number(k.cpc).toFixed(2) : "—",
        investimento: k.spend > 0 ? "R$" + Number(k.spend).toFixed(2) : "R$0",
        conversoes: k.conversions,
      }));

    // ── Montar prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `Você é um especialista sênior em Google Ads com 15 anos de experiência,
com domínio profundo em neuromarketing, psicologia comportamental do consumidor e mercado de
prevenção contra incêndio no Brasil (portas corta-fogo, AVCB, NR-23, IT-11 do CBMERJ/CBMSP).

Você conhece o mercado B2B de serviços técnicos obrigatórios, onde o cliente não busca por desejo
e sim por necessidade legal/fiscal. Você entende que a jornada de compra é baseada em:
1. Urgência regulatória (AVCB vencido, vistoria do Corpo de Bombeiros)
2. Medo de multa ou interdição
3. Busca por fornecedor confiável com rapidez

Sua análise deve ser PRÁTICA, DIRETA e ACIONÁVEL — sem enrolação.
Responda sempre em português brasileiro.
Use emojis moderadamente para organização visual.
Estruture com seções claras usando markdown (## para títulos, **negrito** para pontos-chave).`;

    const userPrompt = `Analise os dados de Google Ads da PORTIBRAS (empresa de manutenção e instalação de portas corta-fogo no RJ e SP) dos últimos ${periodo} dias:

## CAMPANHAS ATIVAS
${JSON.stringify(resumoCampanhas, null, 2)}

## PALAVRAS-CHAVE
${JSON.stringify(resumoKeywords, null, 2)}

Entregue uma análise estruturada com:

1. **📊 Diagnóstico Rápido** — O que os números revelam sobre o momento atual das campanhas (máximo 3 parágrafos)

2. **🧠 Insights de Comportamento** — O que a jornada de busca dessas palavras-chave revela sobre a intenção do consumidor. Use princípios de neuromarketing (urgência, medo de perda, prova social, autoridade) para identificar oportunidades

3. **⚠️ Palavras-chave Problemáticas** — Liste as que estão desperdiçando verba ou com performance ruim, explique o porquê e o que fazer

4. **🚀 Top 3 Ações Prioritárias** — As 3 mudanças de maior impacto para aumentar captação de leads AGORA. Seja específico: qual campanha, qual keyword, qual ajuste, qual copy de anúncio

5. **💡 Oportunidade Inexplorada** — Uma oportunidade de keyword ou segmentação que provavelmente não estamos aproveitando, baseada no comportamento do mercado de prevenção contra incêndio`;

    // ── Chamar GPT-4o-mini ────────────────────────────────────────────────────
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!gptRes.ok) {
      const errText = await gptRes.text();
      throw new Error(`OpenAI error ${gptRes.status}: ${errText}`);
    }

    const gptData = await gptRes.json();
    const insight = gptData.choices?.[0]?.message?.content ?? "Sem resposta da IA.";

    return json({
      insight,
      gerado_em: new Date().toISOString(),
      periodo_dias: periodo,
      total_campanhas: resumoCampanhas.length,
      total_keywords: resumoKeywords.length,
    });

  } catch (e) {
    console.error("marketing-insights error:", e);
    return json({ error: String(e) }, 500);
  }
});
