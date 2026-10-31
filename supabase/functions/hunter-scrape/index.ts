/**
 * hunter-scrape — Edge Function
 * Busca empresas no Google Maps via Apify (Google Maps Scraper Actor).
 * Chamada pelo Hunter do site; o token Apify fica só aqui, nunca no frontend.
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

// Actor oficial do Apify para Google Maps
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
  const partes = [p.street, p.address].filter(Boolean);
  const endFull = partes.length ? partes[0]! : "";
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

async function runApify(query: string, maxItems: number, token: string): Promise<Resultado[]> {
  // 1. Inicia o actor
  const runResp = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: maxItems,
        language: "pt",
        countryCode: "BR",
        includeHistogram: false,
        includeOpeningHours: false,
        includePeopleAlsoSearch: false,
        maxImages: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        scrapeDirectories: false,
        deeperCityScrape: false,
      }),
    }
  );

  if (!runResp.ok) {
    const err = await runResp.text();
    throw new Error(`Apify run failed: ${runResp.status} ${err}`);
  }

  const runData = await runResp.json();
  const runId   = runData?.data?.id;
  if (!runId) throw new Error("Apify não retornou run ID.");

  // 2. Aguarda conclusão (poll até 3 min)
  let status = "RUNNING";
  let attempts = 0;
  while (status === "RUNNING" || status === "READY") {
    await new Promise(r => setTimeout(r, 6000));
    attempts++;
    if (attempts > 30) throw new Error("Timeout aguardando Apify (3 min).");

    const statusResp = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    );
    const statusData = await statusResp.json();
    status = statusData?.data?.status ?? "RUNNING";

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status}.`);
    }
  }

  // 3. Baixa os resultados do dataset
  const datasetId = runData?.data?.defaultDatasetId;
  const itemsResp = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&limit=${maxItems}`
  );
  if (!itemsResp.ok) throw new Error("Erro ao baixar dataset do Apify.");

  const items: ApifyPlace[] = await itemsResp.json();
  return items.map(mapPlace).filter(r => r.nome);
}

serve(async (req) => {
  // CORS preflight
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

    const body = await req.json();
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

    const results = await runApify(searchQuery, Math.min(maxItems, 50), token);

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
