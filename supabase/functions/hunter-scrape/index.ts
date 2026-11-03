/**
 * hunter-scrape — Edge Function
 * Busca empresas no Google Maps via Apify.
 * Usa run assíncrono: dispara o actor, faz polling até terminar (ou timeout),
 * e busca os itens do dataset — mesmo se o run der TIMED-OUT no Apify,
 * os resultados parciais já coletados são retornados.
 *
 * POST /functions/v1/hunter-scrape
 * Body: { query: string, cidade: string, bairro?: string, maxItems?: number }
 * Retorna: { results: Resultado[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_ACTOR = "compass~crawler-google-places";
const APIFY_BASE  = "https://api.apify.com/v2";

interface ApifyPlace {
  title?: string;
  name?: string;
  totalScore?: number;
  reviewsCount?: number;
  categoryName?: string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  phoneUnformatted?: string;
  phone?: string;
  website?: string;
  url?: string;
  emails?: string[];
  location?: { lat: number; lng: number };
}

interface Resultado {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  categoria: string;
  rating: number | null;
  reviews: number | null;
  website: string;
  maps_url: string;
  lat: number | null;
  lon: number | null;
}

function mapPlace(p: ApifyPlace): Resultado {
  const endFull = p.street || p.address || "";
  return {
    nome:      p.title || p.name || "",
    telefone:  p.phoneUnformatted || p.phone || "",
    email:     p.emails?.[0] || "",
    endereco:  endFull,
    categoria: p.categoryName || "",
    rating:    p.totalScore ?? null,
    reviews:   p.reviewsCount ?? null,
    website:   p.website || "",
    maps_url:  p.url || "",
    lat:       p.location?.lat ?? null,
    lon:       p.location?.lng ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const token = Deno.env.get("APIFY_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "APIFY_TOKEN não configurado no Supabase." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Body vazio recebido pela Edge Function." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const body = JSON.parse(rawText);
    const { query, cidade, bairro, maxItems = 20 } = body;

    if (!query || !cidade) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: query, cidade." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const searchQuery = bairro
      ? `${query} em ${bairro}, ${cidade}, Brasil`
      : `${query} em ${cidade}, Brasil`;

    const max = Math.min(maxItems, 20);

    // 1. Dispara o run de forma assíncrona (não bloqueia)
    const runResp = await fetch(
      `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: max,
          language: "pt-BR",
          countryCode: "br",
          includeHistogram: false,
          includeOpeningHours: false,
          includePeopleAlsoSearch: false,
          maxImages: 0,
          exportPlaceUrls: false,
          additionalInfo: false,
          scrapeDirectories: false,
          deeperCityScrape: false,
          memory: 2048,
        }),
      }
    );

    if (!runResp.ok) {
      const errText = await runResp.text();
      return new Response(
        JSON.stringify({ error: `Apify falhou ao iniciar: ${runResp.status}: ${errText}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const runData = await runResp.json();
    const runId = runData?.data?.id;
    const datasetId = runData?.data?.defaultDatasetId;

    if (!runId || !datasetId) {
      return new Response(
        JSON.stringify({ error: "Apify não retornou run ID." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2. Polling: aguarda até 120s, checando a cada 5s
    const POLL_INTERVAL = 5000;
    const MAX_WAIT = 120000;
    const startTime = Date.now();
    let status = "RUNNING";

    while (Date.now() - startTime < MAX_WAIT) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const statusResp = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
      );
      const statusData = await statusResp.json();
      status = statusData?.data?.status ?? "RUNNING";

      // Sai do loop se terminou (seja sucesso, timeout ou falha)
      if (status !== "RUNNING" && status !== "READY") break;
    }

    // 3. Busca os itens do dataset — funciona mesmo se status for TIMED-OUT
    const itemsResp = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&limit=${max}`
    );

    if (!itemsResp.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar resultados do Apify." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const items: ApifyPlace[] = await itemsResp.json();
    const results = items.map(mapPlace).filter(r => r.nome);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: `Nenhum resultado encontrado (status do run: ${status}).` }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ results, total: results.length }),
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
