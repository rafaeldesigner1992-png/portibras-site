/**
 * sync-google-ads — Edge Function
 * Sincroniza dados do Google Ads via Windsor.ai para a tabela mkt_google_ads.
 *
 * POST /functions/v1/sync-google-ads
 * Body (opcional): { days?: number }  — padrão: últimos 90 dias
 *
 * Requer secret: WINDSOR_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDSOR_KEY = Deno.env.get("WINDSOR_API_KEY") ?? "";
const WINDSOR_API = "https://connectors.windsor.ai/api/v1/data";
const GOOGLE_ADS_ACCOUNT = "569-519-6221";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!WINDSOR_KEY) {
    return new Response(JSON.stringify({ error: "WINDSOR_API_KEY não configurada" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Number(body.days ?? 90);

    const hoje = new Date();
    const dataFim = hoje.toISOString().slice(0, 10);
    const dataInicio = new Date(hoje.getTime() - days * 86400000).toISOString().slice(0, 10);

    console.log(`Sincronizando Google Ads: ${dataInicio} → ${dataFim}`);

    const params = new URLSearchParams({
      api_key: WINDSOR_KEY,
      connector: "google_ads",
      date_from: dataInicio,
      date_to: dataFim,
      fields: "campaign,date,impressions,clicks,spend,conversions,ctr,cpc,cpa",
      account_id: GOOGLE_ADS_ACCOUNT,
    });

    const res = await fetch(`${WINDSOR_API}?${params}`);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Windsor API ${res.status}: ${txt}`);
    }

    const json = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? json.results ?? []);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "Nenhum dado retornado" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Normalizar e upsert
    const records = rows.map(r => ({
      date: String(r.date ?? r.Date ?? ""),
      campaign: String(r.campaign ?? r.campaign_name ?? ""),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      spend: Number(r.spend ?? r.cost ?? 0),
      conversions: Number(r.conversions ?? 0),
      ctr: Number(r.ctr ?? 0),
      cpc: r.cpc != null ? Number(r.cpc) : null,
      cpa: r.cpa != null ? Number(r.cpa) : null,
      synced_at: new Date().toISOString(),
    })).filter(r => r.date && r.campaign);

    const { error } = await supabase
      .from("mkt_google_ads")
      .upsert(records, { onConflict: "date,campaign" });

    if (error) throw error;

    console.log(`Sincronizados ${records.length} registros`);
    return new Response(JSON.stringify({ synced: records.length, date_from: dataInicio, date_to: dataFim }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-google-ads error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
