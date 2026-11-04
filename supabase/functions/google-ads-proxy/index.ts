/**
 * google-ads-proxy — Edge Function
 * Proxy seguro para a Google Ads API.
 * Autentica com OAuth2 usando as credenciais salvas no Supabase.
 *
 * POST /functions/v1/google-ads-proxy
 * Body: { action: "campaigns" | "keywords" | "metrics" | "ai_insights" | "save_config" | "oauth_exchange" | "pause_campaign" | "enable_campaign" | "add_negative_keyword" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_API_BASE = "https://googleads.googleapis.com/v17";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    // ─── Salvar configuração OAuth ────────────────────────────────────────────
    if (action === "save_config") {
      const { customer_id, client_id, client_secret, developer_token, login_customer_id } = body;

      const { error } = await supabase
        .from("google_ads_config")
        .upsert({
          id: "00000000-0000-0000-0000-000000000001",
          customer_id,
          client_id,
          client_secret,
          developer_token,
          login_customer_id,
          conectado: false,
          atualizado_em: new Date().toISOString(),
        });

      if (error) throw new Error(`Erro ao salvar config: ${error.message}`);
      return json({ ok: true });
    }

    // ─── Trocar código de autorização por refresh_token ───────────────────────
    if (action === "oauth_exchange") {
      const { code, redirect_uri } = body;

      // Buscar client_id e client_secret do banco
      const { data: cfg, error: cfgErr } = await supabase
        .from("google_ads_config")
        .select("client_id, client_secret")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();

      if (cfgErr || !cfg) throw new Error("Configuração não encontrada. Salve primeiro.");

      const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.client_id,
          client_secret: cfg.client_secret,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResp.json();
      if (!tokenData.refresh_token) {
        throw new Error(`OAuth falhou: ${JSON.stringify(tokenData)}`);
      }

      // Salvar refresh_token e marcar como conectado
      await supabase
        .from("google_ads_config")
        .update({
          refresh_token: tokenData.refresh_token,
          conectado: true,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      return json({ ok: true, conectado: true });
    }

    // ─── Funções que precisam de acesso à API ────────────────────────────────
    const { data: cfg, error: cfgErr } = await supabase
      .from("google_ads_config")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (cfgErr || !cfg) return json({ error: "Google Ads não configurado." }, 400);
    if (!cfg.conectado || !cfg.refresh_token) return json({ error: "Google Ads não autenticado. Configure o OAuth." }, 401);

    // Obter access_token
    const accessToken = await getAccessToken(cfg);

    const customerId = cfg.customer_id.replace(/-/g, "");
    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": cfg.developer_token,
      "Content-Type": "application/json",
    } as Record<string, string>;

    if (cfg.login_customer_id) {
      headers["login-customer-id"] = cfg.login_customer_id.replace(/-/g, "");
    }

    // ─── Listar campanhas ─────────────────────────────────────────────────────
    if (action === "campaigns") {
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign_budget.amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
      `;

      const resp = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Google Ads API: ${JSON.stringify(data?.error || data)}`);

      const campaigns = (data.results || []).map((r: any) => ({
        id: r.campaign?.id,
        nome: r.campaign?.name,
        status: r.campaign?.status,
        tipo: r.campaign?.advertisingChannelType,
        orcamento_diario: (r.campaignBudget?.amountMicros || 0) / 1_000_000,
        impressoes: Number(r.metrics?.impressions || 0),
        cliques: Number(r.metrics?.clicks || 0),
        ctr: Number(r.metrics?.ctr || 0),
        cpc_medio: (r.metrics?.averageCpc || 0) / 1_000_000,
        custo_total: (r.metrics?.costMicros || 0) / 1_000_000,
        conversoes: Number(r.metrics?.conversions || 0),
        valor_conversao: Number(r.metrics?.conversionsValue || 0),
      }));

      // Atualiza snapshot no banco
      if (campaigns.length > 0) {
        await supabase.from("marketing_campanhas_ads").upsert(
          campaigns.map((c: any) => ({ ...c, campaign_id: String(c.id), data_snapshot: new Date().toISOString().split("T")[0] })),
          { onConflict: "campaign_id,data_snapshot" }
        );
        await supabase.from("google_ads_config").update({ ultimo_sync: new Date().toISOString() }).eq("id", "00000000-0000-0000-0000-000000000001");
      }

      return json({ campaigns, total: campaigns.length });
    }

    // ─── Listar keywords ──────────────────────────────────────────────────────
    if (action === "keywords") {
      const { campaign_id } = body;
      const campFilter = campaign_id ? `AND campaign.id = ${campaign_id}` : "";

      // Keywords positivas
      const posQuery = `
        SELECT
          ad_group_criterion.criterion_id,
          campaign.id,
          campaign.name,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          ad_group_criterion.quality_info.quality_score
        FROM keyword_view
        WHERE ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
          ${campFilter}
        ORDER BY metrics.cost_micros DESC
        LIMIT 200
      `;

      // Keywords negativas
      const negQuery = `
        SELECT
          campaign_criterion.criterion_id,
          campaign.id,
          campaign.name,
          campaign_criterion.keyword.text,
          campaign_criterion.keyword.match_type
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'KEYWORD'
          AND campaign_criterion.negative = true
          ${campFilter}
        LIMIT 200
      `;

      const [posResp, negResp] = await Promise.all([
        fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, { method: "POST", headers, body: JSON.stringify({ query: posQuery }) }),
        fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, { method: "POST", headers, body: JSON.stringify({ query: negQuery }) }),
      ]);

      const posData = await posResp.json();
      const negData = await negResp.json();

      const positivas = (posData.results || []).map((r: any) => ({
        id: String(r.adGroupCriterion?.criterionId),
        campaign_id: String(r.campaign?.id),
        campaign_nome: r.campaign?.name,
        keyword: r.adGroupCriterion?.keyword?.text,
        tipo: "positiva",
        match_type: r.adGroupCriterion?.keyword?.matchType,
        status: r.adGroupCriterion?.status,
        impressoes: Number(r.metrics?.impressions || 0),
        cliques: Number(r.metrics?.clicks || 0),
        ctr: Number(r.metrics?.ctr || 0),
        cpc_medio: (r.metrics?.averageCpc || 0) / 1_000_000,
        custo_total: (r.metrics?.costMicros || 0) / 1_000_000,
        conversoes: Number(r.metrics?.conversions || 0),
        quality_score: r.adGroupCriterion?.qualityInfo?.qualityScore || null,
      }));

      const negativas = (negData.results || []).map((r: any) => ({
        id: String(r.campaignCriterion?.criterionId),
        campaign_id: String(r.campaign?.id),
        campaign_nome: r.campaign?.name,
        keyword: r.campaignCriterion?.keyword?.text,
        tipo: "negativa",
        match_type: r.campaignCriterion?.keyword?.matchType,
        status: "ENABLED",
        impressoes: 0, cliques: 0, ctr: 0, cpc_medio: 0, custo_total: 0, conversoes: 0,
      }));

      return json({ positivas, negativas, total: positivas.length + negativas.length });
    }

    // ─── Pausar/Ativar campanha ───────────────────────────────────────────────
    if (action === "pause_campaign" || action === "enable_campaign") {
      const { campaign_id } = body;
      const novoStatus = action === "pause_campaign" ? "PAUSED" : "ENABLED";

      const resp = await fetch(`${ADS_API_BASE}/customers/${customerId}/campaigns:mutate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          operations: [{
            update: { resourceName: `customers/${customerId}/campaigns/${campaign_id}`, status: novoStatus },
            updateMask: "status",
          }],
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Erro ao ${action}: ${JSON.stringify(data?.error)}`);
      return json({ ok: true, novo_status: novoStatus });
    }

    // ─── Adicionar keyword negativa ───────────────────────────────────────────
    if (action === "add_negative_keyword") {
      const { campaign_id, keyword, match_type = "BROAD" } = body;

      const resp = await fetch(`${ADS_API_BASE}/customers/${customerId}/campaignCriteria:mutate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              campaign: `customers/${customerId}/campaigns/${campaign_id}`,
              negative: true,
              keyword: { text: keyword, matchType: match_type },
            },
          }],
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Erro ao adicionar keyword: ${JSON.stringify(data?.error)}`);

      // Salva no banco local
      await supabase.from("marketing_keywords").insert({
        campaign_id: String(campaign_id),
        keyword,
        tipo: "negativa",
        match_type,
        status: "ENABLED",
      });

      return json({ ok: true });
    }

    // ─── Gerar insights com IA ────────────────────────────────────────────────
    if (action === "ai_insights") {
      const { campanhas, metas } = body;

      const claudeApiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!claudeApiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

      const prompt = `Você é um especialista em Google Ads com foco em geração de leads B2B para empresas de serviços.

Analise estes dados de campanha e metas e forneça insights práticos e recomendações prioritizadas.

METAS DO PERÍODO:
${JSON.stringify(metas, null, 2)}

DADOS DAS CAMPANHAS:
${JSON.stringify(campanhas, null, 2)}

Retorne um JSON com este formato EXATO:
{
  "resumo": "2-3 frases sobre o estado geral das campanhas",
  "score_geral": 75,
  "insights": [
    {
      "tipo": "campanha" | "keyword" | "orcamento" | "meta",
      "prioridade": "alta" | "media" | "baixa",
      "titulo": "Título curto do insight",
      "descricao": "Descrição do problema ou oportunidade",
      "recomendacao": "Ação específica a tomar",
      "impacto_estimado": "Descrição do impacto esperado"
    }
  ],
  "alertas": ["alerta 1", "alerta 2"],
  "proximos_passos": ["passo 1", "passo 2", "passo 3"]
}`;

      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const aiData = await aiResp.json();
      const rawText = aiData?.content?.[0]?.text || "{}";

      let analysis;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resumo: rawText, insights: [] };
      } catch {
        analysis = { resumo: rawText, insights: [] };
      }

      // Salva insights no banco
      if (analysis.insights?.length > 0) {
        await supabase.from("marketing_insights_ia").insert(
          analysis.insights.map((ins: any) => ({
            tipo: ins.tipo || "analise_geral",
            insight: ins.descricao,
            recomendacao: ins.recomendacao,
            prioridade: ins.prioridade || "media",
          }))
        );
      }

      return json({ analysis });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function getAccessToken(cfg: any): Promise<string> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      refresh_token: cfg.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!data.access_token) throw new Error(`Falha ao renovar token: ${JSON.stringify(data)}`);
  return data.access_token;
}
