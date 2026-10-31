/**
 * hunter-usage — Edge Function
 * Retorna o uso atual do Apify (USD gasto / limite mensal).
 * GET /functions/v1/hunter-usage
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const token = Deno.env.get("APIFY_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "APIFY_TOKEN não configurado." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`);
    if (!resp.ok) throw new Error(`Apify ${resp.status}`);

    const body = await resp.json();
    const current = body?.data?.current ?? {};
    const limits  = body?.data?.limits  ?? {};
    const cycle   = body?.data?.monthlyUsageCycle ?? {};

    return new Response(
      JSON.stringify({
        usadoUsd:   current.monthlyUsageUsd   ?? 0,
        limiteUsd:  limits.maxMonthlyUsageUsd ?? 5,
        cicloFim:   cycle.endAt               ?? null,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
