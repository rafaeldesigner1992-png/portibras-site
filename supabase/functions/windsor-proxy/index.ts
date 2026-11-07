/**
 * windsor-proxy — Edge Function
 * Proxy seguro para a Windsor.ai API.
 * Busca dados de marketing (Google Ads, etc.) usando a API key do Windsor.
 *
 * POST /functions/v1/windsor-proxy
 * Body: {
 *   connector: "google_ads",
 *   fields: string[],
 *   date_from: "YYYY-MM-DD",
 *   date_to: "YYYY-MM-DD",
 *   account_id?: string   // opcional, usa o padrão se não informado
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDSOR_API = "https://connectors.windsor.ai/api/v1/data";
const WINDSOR_KEY = Deno.env.get("WINDSOR_API_KEY") ?? "";
const GOOGLE_ADS_ACCOUNT = "569-519-6221";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!WINDSOR_KEY) {
    return new Response(JSON.stringify({ error: "WINDSOR_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      connector = "google_ads",
      fields = ["campaign", "date", "impressions", "clicks", "spend", "conversions", "ctr", "cpc"],
      date_from,
      date_to,
      account_id,
    } = body;

    if (!date_from || !date_to) {
      return new Response(JSON.stringify({ error: "date_from and date_to are required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Build Windsor.ai query params
    const params = new URLSearchParams({
      api_key: WINDSOR_KEY,
      connector,
      date_from,
      date_to,
      fields: fields.join(","),
    });

    // Add account filter for Google Ads
    if (connector === "google_ads") {
      params.set("account_id", account_id ?? GOOGLE_ADS_ACCOUNT);
    }

    const url = `${WINDSOR_API}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errText = await res.text();
      console.error("Windsor API error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Windsor API error: ${res.status}`, detail: errText }), {
        status: res.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();

    // Windsor returns { data: [...], meta: {...} } or just an array
    const data = Array.isArray(json) ? json : (json.data ?? json.results ?? json);

    // Normalize numeric fields
    const normalized = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      date: row.date ?? row.Date ?? null,
      campaign: row.campaign ?? row.campaign_name ?? row.Campaign ?? "",
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? row.cost ?? 0),
      conversions: Number(row.conversions ?? 0),
      ctr: Number(row.ctr ?? 0),
      cpc: row.cpc != null ? Number(row.cpc) : null,
      cpa: row.cpa != null ? Number(row.cpa) : null,
    }));

    return new Response(JSON.stringify({ data: normalized, total: normalized.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("windsor-proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
