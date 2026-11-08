/**
 * clevel-insights — Edge Function
 * Consultor C-Level via GPT-4o-mini.
 *
 * Lê o direcionamento estratégico da empresa + dados reais (equipe, financeiro,
 * marketing, logística) e entrega um plano estruturado com:
 * — Validação dos objetivos por horizonte
 * — Metas sugeridas por área (comercial, financeiro, marketing, logística)
 * — Rotinas recomendadas por área
 * — Prioridades imediatas (90 dias)
 * — Alertas e riscos
 *
 * POST /functions/v1/clevel-insights
 * Body: { } — sem parâmetros necessários, tudo vem do Supabase
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

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Buscar direcionamento estratégico ─────────────────────────────
    const { data: estrategia } = await sb
      .from("estrategia_empresa")
      .select("*")
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .single();

    if (!estrategia) return json({ error: "Preencha o direcionamento estratégico primeiro." }, 400);

    // ── 2. Dados reais da empresa ─────────────────────────────────────────
    // Equipe
    const { count: totalFuncionarios } = await sb
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true);

    // Mês atual
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2,"0")}-01`;
    const fimMes = new Date(anoAtual, mesAtual, 0).toISOString().slice(0,10);

    // Financeiro — últimos 3 meses
    const inicio3m = new Date(agora.getTime() - 90 * 86400000).toISOString().slice(0,10);
    const { data: lancamentos3m } = await sb
      .from("financeiro_lancamentos")
      .select("tipo, valor, data")
      .gte("data", inicio3m);

    const receita3m = (lancamentos3m ?? [])
      .filter(l => l.tipo === "receita")
      .reduce((s, l) => s + l.valor, 0);
    const despesa3m = (lancamentos3m ?? [])
      .filter(l => l.tipo === "despesa")
      .reduce((s, l) => s + l.valor, 0);

    const { data: custos } = await sb
      .from("financeiro_custos_fixos")
      .select("valor_mensal")
      .eq("ativo", true);
    const custoFixoMensal = (custos ?? []).reduce((s:number, c:{valor_mensal:number}) => s + c.valor_mensal, 0);

    // CRM — leads dos últimos 90 dias
    const { count: leads90d } = await sb
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .gte("criado_em", inicio3m + "T00:00:00");

    // Contratos — últimos 90 dias
    const { data: contratos90d } = await sb
      .from("contratos")
      .select("valor, status")
      .gte("criado_em", inicio3m + "T00:00:00")
      .neq("status", "cancelado");
    const faturamento3m = (contratos90d ?? []).reduce((s, c) => s + (c.valor ?? 0), 0);
    const numContratos3m = contratos90d?.length ?? 0;
    const ticketMedio = numContratos3m > 0 ? faturamento3m / numContratos3m : 0;

    // Google Ads — últimos 30 dias
    const { data: ads30d } = await sb
      .from("mkt_google_ads")
      .select("impressions, clicks, spend, conversions")
      .gte("date", inicioMes);
    const totalSpend = (ads30d ?? []).reduce((s,r) => s + r.spend, 0);
    const totalClicks = (ads30d ?? []).reduce((s,r) => s + r.clicks, 0);
    const totalImpress = (ads30d ?? []).reduce((s,r) => s + r.impressions, 0);
    const totalConversions = (ads30d ?? []).reduce((s,r) => s + r.conversions, 0);

    // Logística — mês atual
    const { data: pedidosMes } = await sb
      .from("logistica_pedidos")
      .select("etapa, is_ticket")
      .gte("criado_em", inicioMes + "T00:00:00")
      .lte("criado_em", fimMes + "T23:59:59");
    const osConcluidas = (pedidosMes ?? []).filter(p => p.etapa === "concluido" && !p.is_ticket).length;
    const osAbertas = (pedidosMes ?? []).filter(p => !["concluido","cancelado"].includes(p.etapa) && !p.is_ticket).length;
    const ticketsAbertos = (pedidosMes ?? []).filter(p => p.is_ticket && !["concluido","cancelado"].includes(p.etapa)).length;

    // Metas atuais cadastradas
    const { data: metasAtuais } = await sb
      .from("metas_kpis")
      .select("area, indicador, descricao, meta_valor, unidade")
      .eq("periodo_mes", mesAtual)
      .eq("periodo_ano", anoAtual);

    // ── 3. Montar contexto completo ───────────────────────────────────────
    const contextoEmpresa = {
      nome: "PORTIBRAS",
      segmento: estrategia.segmentos_atuacao || "Manutenção e instalação de portas corta-fogo",
      regioes: estrategia.regioes_atuacao || "RJ e SP",
      num_funcionarios: estrategia.num_funcionarios ?? totalFuncionarios ?? "não informado",
      desafios_atuais: estrategia.desafios_atuais || "não informado",
      diferenciais: estrategia.diferenciais || "não informado",
    };

    const dadosReais = {
      financeiro: {
        receita_3_meses: `R$${receita3m.toFixed(2)}`,
        despesa_3_meses: `R$${despesa3m.toFixed(2)}`,
        lucro_3_meses: `R$${(receita3m - despesa3m).toFixed(2)}`,
        custo_fixo_mensal: `R$${custoFixoMensal.toFixed(2)}`,
        margem_pct: receita3m > 0 ? `${(((receita3m - despesa3m) / receita3m) * 100).toFixed(1)}%` : "0%",
      },
      comercial: {
        leads_90_dias: leads90d ?? 0,
        contratos_90_dias: numContratos3m,
        faturamento_3_meses: `R$${faturamento3m.toFixed(2)}`,
        ticket_medio: `R$${ticketMedio.toFixed(2)}`,
        taxa_conversao: (leads90d ?? 0) > 0 ? `${((numContratos3m / (leads90d ?? 1)) * 100).toFixed(1)}%` : "0%",
      },
      marketing_google_ads: {
        investimento_mes: `R$${totalSpend.toFixed(2)}`,
        cliques: totalClicks,
        impressoes: totalImpress,
        conversoes: totalConversions,
        ctr: totalImpress > 0 ? `${((totalClicks / totalImpress) * 100).toFixed(2)}%` : "0%",
        cpl: totalClicks > 0 ? `R$${(totalSpend / totalClicks).toFixed(2)}` : "sem dados",
      },
      logistica: {
        os_concluidas_mes: osConcluidas,
        os_em_aberto: osAbertas,
        tickets_abertos: ticketsAbertos,
      },
    };

    // ── 4. System + User Prompt ───────────────────────────────────────────
    const systemPrompt = `Você é um consultor C-Level sênior com 20 anos de experiência em:
- Gestão estratégica e OKRs (Objectives and Key Results)
- Scaling de empresas de serviços B2B no Brasil
- Mercado de prevenção contra incêndio (portas corta-fogo, AVCB, NR-23, IT-11 do CBMERJ/CBMSP)
- Gestão financeira, comercial e operacional para PMEs
- Implementação de rotinas de alta performance em pequenas equipes

Você entende que a PORTIBRAS atua num mercado de necessidade legal/regulatória, onde:
1. O cliente busca por urgência (AVCB vencido, vistoria do Corpo de Bombeiros)
2. A sazonalidade é ditada por renovações e fiscalizações
3. O ticket médio é alto mas o ciclo de venda pode ser longo
4. A confiança e a rapidez são os principais diferenciadores

Sua análise deve ser PRÁTICA, DIRETA, REALISTA e ACIONÁVEL.
Responda em português brasileiro. Use markdown com seções claras.
Seja específico para o tamanho e realidade da empresa — não sugira estruturas gigantes para uma PME.`;

    const userPrompt = `Analise a situação da PORTIBRAS e crie um plano estratégico integrado.

## CONTEXTO DA EMPRESA
${JSON.stringify(contextoEmpresa, null, 2)}

## DIRECIONAMENTO ESTRATÉGICO (definido pelo CEO)

### Visão 5 anos:
${estrategia.visao_5anos || "(não preenchido)"}

### Visão 2 anos:
${estrategia.visao_2anos || "(não preenchido)"}

### Visão 1 ano:
${estrategia.visao_1ano || "(não preenchido)"}

### Prioridades 6 meses:
${estrategia.visao_6meses || "(não preenchido)"}

## DADOS REAIS DA EMPRESA (últimos 90 dias)
${JSON.stringify(dadosReais, null, 2)}

## METAS CADASTRADAS ESTE MÊS
${JSON.stringify(metasAtuais ?? [], null, 2)}

---

Com base nesses dados, entregue:

## 1. 🔍 DIAGNÓSTICO ESTRATÉGICO
Avalie a coerência entre o direcionamento do CEO e a realidade atual dos números. Seja direto sobre gaps, riscos e pontos fortes. Máximo 4 parágrafos.

## 2. 🎯 METAS SUGERIDAS POR HORIZONTE
Para cada horizonte (6 meses, 1 ano, 2 anos, 5 anos), liste 3-5 metas SMART específicas e realistas para a realidade atual. Use números concretos baseados nos dados reais.

## 3. 📋 ROTINAS RECOMENDADAS POR ÁREA
Para cada área abaixo, sugira 3-4 rotinas práticas (diária, semanal ou mensal) que uma equipe pequena consegue executar:
- **Comercial / Vendas**
- **Financeiro**
- **Marketing / Google Ads**
- **Logística / Operações (CQ/Compliance)**
- **C-Level / Gestão**

## 4. 🚀 TOP 5 AÇÕES DOS PRÓXIMOS 90 DIAS
As 5 ações de maior impacto para colocar a empresa no caminho certo agora. Prioridade, responsável sugerido e resultado esperado.

## 5. ⚠️ ALERTAS E RISCOS
Máximo 3 alertas críticos que o CEO deve monitorar com atenção.

## 6. 💡 OPORTUNIDADE ESTRATÉGICA
Uma oportunidade específica para o mercado de portas corta-fogo que a empresa provavelmente não está aproveitando ainda.`;

    // ── 5. Chamar GPT-4o-mini ─────────────────────────────────────────────
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
        temperature: 0.65,
        max_tokens: 3500,
      }),
    });

    if (!gptRes.ok) {
      const errText = await gptRes.text();
      throw new Error(`OpenAI error ${gptRes.status}: ${errText}`);
    }

    const gptData = await gptRes.json();
    const plano = gptData.choices?.[0]?.message?.content ?? "Sem resposta da IA.";

    return json({
      plano,
      gerado_em: new Date().toISOString(),
      contexto_usado: {
        funcionarios: contextoEmpresa.num_funcionarios,
        receita_3m: receita3m,
        leads_90d: leads90d ?? 0,
        contratos_90d: numContratos3m,
      },
    });

  } catch (e) {
    console.error("clevel-insights error:", e);
    return json({ error: String(e) }, 500);
  }
});
